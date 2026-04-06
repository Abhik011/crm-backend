const Lead = require("../models/clead");
const Customer = require("../models/Customer");
const Deal = require("../models/Deal");
const Invoice = require("../models/Invoice");
const Quote = require("../models/Quote");

const RESOURCE_MODEL = {
  leads: Lead,
  customers: Customer,
  deals: Deal,
  invoices: Invoice,
  quotes: Quote,
};

async function countForCompany(companyId, resource) {
  const Model = RESOURCE_MODEL[resource];
  if (!Model) return 0;
  return Model.countDocuments({ company: companyId });
}

async function getUsageSnapshot(companyId) {
  const resources = Object.keys(RESOURCE_MODEL);
  const usage = {};
  await Promise.all(
    resources.map(async (r) => {
      usage[r] = await countForCompany(companyId, r);
    })
  );
  return usage;
}

module.exports = {
  countForCompany,
  getUsageSnapshot,
  RESOURCE_MODEL,
};
