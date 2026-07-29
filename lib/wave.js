const WAVE_API_URL = 'https://gql.waveapps.com/graphql/public';

async function graphqlRequest(query, variables) {
  const token = process.env.WAVE_FULL_ACCESS_TOKEN;
  if (!token) {
    throw new Error('WAVE_FULL_ACCESS_TOKEN is not set. Check your .env file.');
  }

  const response = await fetch(WAVE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();

  // Wave's schema is not versioned, so always check for top level GraphQL
  // errors before trusting the payload shape.
  if (json.errors && json.errors.length > 0) {
    const message = json.errors.map((err) => err.message).join('; ');
    throw new Error(`Wave API returned errors: ${message}`);
  }

  return json.data;
}

// Run once (e.g. with a small script) to confirm the exact field names Wave
// expects on InvoiceCreateInput and its item type before relying on the
// mutation below. Wave's docs are not versioned and can drift.
async function introspectInputType(typeName) {
  const query = `
    query IntrospectInput($typeName: String!) {
      __type(name: $typeName) {
        name
        inputFields {
          name
          type { name kind ofType { name kind } }
        }
      }
    }
  `;
  return graphqlRequest(query, { typeName });
}

async function createDraftInvoice(businessId, customerId, items) {
  const mutation = `
    mutation InvoiceCreate($input: InvoiceCreateInput!) {
      invoiceCreate(input: $input) {
        didSucceed
        inputErrors {
          message
          code
          path
        }
        invoice {
          id
          invoiceNumber
          status
          viewUrl
        }
      }
    }
  `;

  const input = {
    businessId,
    customerId,
    status: 'DRAFT',
    items: items.map((item) => ({
      productId: item.productId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  };

  const data = await graphqlRequest(mutation, { input });
  const result = data.invoiceCreate;

  if (!result.didSucceed) {
    const message = (result.inputErrors || []).map((err) => `${err.path || ''} ${err.message}`).join('; ');
    throw new Error(`Wave declined to create the invoice: ${message || 'unknown error'}`);
  }

  return result.invoice;
}

const PAGE_SIZE = 100;

async function paginateConnection(businessId, fieldName, nodeSelection) {
  const query = `
    query List${fieldName[0].toUpperCase()}${fieldName.slice(1)}($businessId: ID!, $page: Int!, $pageSize: Int!) {
      business(id: $businessId) {
        ${fieldName}(page: $page, pageSize: $pageSize) {
          edges { node { ${nodeSelection} } }
        }
      }
    }
  `;

  const results = [];
  let page = 1;

  for (;;) {
    const data = await graphqlRequest(query, { businessId, page, pageSize: PAGE_SIZE });
    const edges = data.business[fieldName].edges;
    results.push(...edges.map((edge) => edge.node));

    if (edges.length < PAGE_SIZE) break;
    page += 1;
  }

  return results;
}

async function getCustomers(businessId) {
  return paginateConnection(businessId, 'customers', 'id name');
}

async function getProducts(businessId) {
  return paginateConnection(businessId, 'products', 'id name');
}

async function getIncomeAccounts(businessId) {
  const accounts = await paginateConnection(businessId, 'accounts', 'id name isArchived type { name value }');
  return accounts.filter((account) => !account.isArchived && account.type && account.type.value === 'INCOME');
}

async function createProduct({ businessId, name, incomeAccountId }) {
  const mutation = `
    mutation ProductCreate($input: ProductCreateInput!) {
      productCreate(input: $input) {
        didSucceed
        inputErrors {
          message
          code
          path
        }
        product {
          id
          name
        }
      }
    }
  `;

  const input = {
    businessId,
    name,
    incomeAccountId,
    isSold: true,
  };

  const data = await graphqlRequest(mutation, { input });
  const result = data.productCreate;

  if (!result.didSucceed) {
    const message = (result.inputErrors || []).map((err) => `${err.path || ''} ${err.message}`).join('; ');
    throw new Error(`Wave declined to create the product "${name}": ${message || 'unknown error'}`);
  }

  return result.product;
}

module.exports = {
  createDraftInvoice,
  introspectInputType,
  graphqlRequest,
  getCustomers,
  getProducts,
  getIncomeAccounts,
  createProduct,
};
