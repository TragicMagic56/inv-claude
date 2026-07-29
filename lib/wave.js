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

module.exports = { createDraftInvoice, introspectInputType, graphqlRequest };
