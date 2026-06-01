import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import Invoice from "../models/Invoice.js";

const MONGO_URI = "mongodb+srv://kulkarniabhijeet1705_db_user:b6F3He5MJKXsW7tU@cluster0.5msartv.mongodb.net/CRM"; // replace
const companyId = "69c7e3de92b529904b6a6a3c";

// 🔥 Realistic random names
const firstNames = ["Raj", "Amit", "Suresh", "Vikas", "Neha", "Pooja", "Riya", "Kiran", "Ankit", "Vivek"];
const lastNames = ["Sharma", "Patel", "Gupta", "Singh", "Yadav", "Mehta", "Jain", "Verma"];

function randomName() {
  return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${
    lastNames[Math.floor(Math.random() * lastNames.length)]
  }`;
}

function randomCompany() {
  const prefixes = ["Tech", "Solutions", "Digital", "Systems", "Enterprises"];
  return `${prefixes[Math.floor(Math.random() * prefixes.length)]} Pvt Ltd`;
}

function randomAmount(min = 5000, max = 200000) {
  return Math.floor(Math.random() * (max - min) + min);
}

function randomStatus() {
  const statuses = ["Paid", "Partial", "Pending", "Overdue"];
  return statuses[Math.floor(Math.random() * statuses.length)];
}

async function seed() {
  await mongoose.connect(MONGO_URI);

  console.log("🚀 Seeding 1000+ customers...");

  // 🔥 Clean old demo data (important)


  const customers = [];

  // 🔥 CREATE 1000 CUSTOMERS
  for (let i = 0; i < 1000; i++) {
    const name = randomName();

    const c = await Customer.create({
      name,
      companyName: randomCompany(),
      phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      email: `${name.replace(" ", "").toLowerCase()}${i}@demo.com`,
      notes: "Demo generated customer",
      company: companyId,
      agency: companyId,
      createdAt: new Date(),
    });

    customers.push(c);
  }

  console.log("✅ Customers created");

  console.log("🚀 Creating invoices...");

  // 🔥 CREATE 3000 INVOICES
  for (let i = 0; i < 3000; i++) {
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const total = randomAmount();
    const status = randomStatus();

    let paidAmount = 0;

    if (status === "Paid") {
      paidAmount = total;
    } else if (status === "Partial") {
      paidAmount = Math.floor(total * (0.2 + Math.random() * 0.6)); // 20%–80%
    }

    await Invoice.create({
      customer: customer._id,
      agency: companyId,
      totalAmount: total,
      paidAmount,
      paymentStatus: status,
      gstAmount: Math.floor(total * 0.18),

      createdAt: new Date(
        2026,
        Math.floor(Math.random() * 12),
        Math.floor(Math.random() * 28)
      ),

      dueDate: new Date(
        2026,
        Math.floor(Math.random() * 12),
        Math.floor(Math.random() * 28)
      ),

      paidAt: status === "Paid" ? new Date() : null,
    });
  }

  console.log("✅ 3000 invoices created!");
  process.exit();
}

seed();