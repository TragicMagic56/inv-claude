const fs = require('fs');
const path = require('path');

const RATES_PATH = path.join(__dirname, '..', 'rates.json');

function loadRates() {
  if (!fs.existsSync(RATES_PATH)) {
    return {};
  }
  const raw = fs.readFileSync(RATES_PATH, 'utf8');
  if (!raw.trim()) {
    return {};
  }
  return JSON.parse(raw);
}

function getRate(togglClientId) {
  const rates = loadRates();
  return rates[String(togglClientId)];
}

function setRate(togglClientId, rate) {
  const rates = loadRates();
  rates[String(togglClientId)] = rate;
  fs.writeFileSync(RATES_PATH, JSON.stringify(rates, null, 2));
}

module.exports = { loadRates, getRate, setRate };
