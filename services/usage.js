import Lead from "../models/clead.js";
import Customer from "../models/Customer.js";
import Deal from "../models/Deal.js";
import Invoice from "../models/Invoice.js";
import Quote from "../models/Quote.js";

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
  return Model.countDocuments({ agency: companyId });
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

export { countForCompany, getUsageSnapshot, RESOURCE_MODEL };
