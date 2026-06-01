import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import Invoice from "../models/Invoice.js";

const MONGO_URI = "mongodb+srv://kulkarniabhijeet1705_db_user:b6F3He5MJKXsW7tU@cluster0.5msartv.mongodb.net/CRM";
const companyId = "69c7e3de92b529904b6a6a3c";

// 🔥 Date range (Apr 2024 → today)
function randomDate() {
  const start = new Date(2024, 3, 1);
  const end = new Date();
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomAmount(min = 100000, max = 3000000) {
  return Math.floor(Math.random() * (max - min) + min);
}

function invoiceNumber(i) {
  return `INV-${2024 + Math.floor(i / 1000)}-${String(i).padStart(5, "0")}`;
}

const projectNames = [
  "E-commerce Platform",
  "CRM System",
  "Mobile App Development",
  "SaaS Dashboard",
  "Logistics Platform",
  "Healthcare System"
];

async function seed() {
  await mongoose.connect(MONGO_URI);

  console.log("🚀 Creating invoices...");

  const customers = await Customer.find({ agency: companyId });

  for (let i = 0; i < 1000; i++) {
    const customer = customers[Math.floor(Math.random() * customers.length)];

    const total = randomAmount();
    const paidAmount = Math.floor(total * Math.random());

    const issueDate = randomDate();
    const dueDate = new Date(issueDate.getTime() + 15 * 24 * 60 * 60 * 1000);

    const project = projectNames[Math.floor(Math.random() * projectNames.length)];

    const milestones = [
      {
        label: "Advance",
        percent: 30,
        amount: Math.floor(total * 0.3),
        paid: true,
        paidAmount: Math.floor(total * 0.3),
      },
      {
        label: "Development",
        percent: 40,
        amount: Math.floor(total * 0.4),
        paid: false,
        paidAmount: 0,
      },
      {
        label: "Deployment",
        percent: 30,
        amount: Math.floor(total * 0.3),
        paid: false,
        paidAmount: 0,
      },
    ];

    const payments = [
      {
        amount: Math.floor(paidAmount * 0.5),
        date: randomDate(),
        method: "Bank Transfer",
        note: "",
      },
      {
        amount: Math.floor(paidAmount * 0.5),
        date: randomDate(),
        method: "UPI",
        note: "",
      },
    ];

    const paymentStatus =
      paidAmount === 0
        ? "Pending"
        : paidAmount >= total
        ? "Paid"
        : "Partial";

    await Invoice.create({
      invoiceNumber: invoiceNumber(i),

      agency: companyId,
      customer: customer._id,

      agencySnapshot: {
        name: "CREONOX TECHNOLOGIES",
        tagline: "Software & Digital Solutions",
        address: "Taloda",
        email: "hello@creonox.com",
        phone: "07498722304",
        website: "www.creonox.com",
        gstin: "22AAAAA0000A1Z5",
      },

      customerSnapshot: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      },

      projectName: project,
      projectDescription: `${project} with full system implementation`,

      items: [
        {
          name: "Development",
          description: "Full system",
          quantity: 1,
          rate: total,
          total,
        },
      ],

      subtotal: total,
      discount: 0,

      gstType: "CGST_SGST",
      cgst: Math.floor(total * 0.09),
      sgst: Math.floor(total * 0.09),
      igst: 0,

      totalAmount: total,

      paidAmount,
      balanceAmount: total - paidAmount,
      paymentStatus,

      milestones,
      payments,

      issueDate,
      dueDate,
      createdAt: issueDate,

      status: "Issued",

      notes: "As per agreement",
      paymentTerms: "Net 15",

      agencyGSTIN: "22AAAAA0000A1Z5",

      totalPaidPercentage: Math.floor((paidAmount / total) * 100),
      totalDuePercentage: 100 - Math.floor((paidAmount / total) * 100),

      isOverdue: dueDate < new Date() && paidAmount < total,
    });
  }

  console.log("✅ Real invoices created");
  process.exit();
}

seed();