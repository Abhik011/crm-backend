const PDFDocument = require("pdfkit");

function pickSnapshot(quote) {
  const ag = quote.agencySnapshot || {};
  const cust = quote.customerSnapshot || {};
  const liveCustomer = quote.customer || {};
  return {
    agencyName: ag.name || "Company",
    agencyAddress: ag.address || "",
    agencyEmail: ag.email || "",
    agencyPhone: ag.phone || "",
    agencyGstin: ag.gstin || "",
    bank: ag.bankDetails || {},

    clientName:
      cust.companyName ||
      cust.name ||
      liveCustomer.companyName ||
      liveCustomer.name ||
      "",
    clientEmail: cust.email || liveCustomer.email || "",
    clientPhone: cust.phone || liveCustomer.phone || "",
    clientAddr: cust.address || liveCustomer.address || "",
  };
}

function lineItems(quote) {
  if (quote.items && quote.items.length > 0) {
    return quote.items.map((item) => ({
      name: item.name || "Item",
      qty: item.quantity ?? 1,
      rate: item.rate ?? 0,
      total: item.total ?? (item.quantity || 1) * (item.rate || 0),
    }));
  }
  const amt = quote.totalAmount || quote.amount || 0;
  return [
    {
      name: quote.title || "Services",
      qty: 1,
      rate: amt,
      total: amt,
    },
  ];
}

function generateQuotePDF(quote, res) {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const snap = pickSnapshot(quote);
  const items = lineItems(quote);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename=quote-${quote.quoteNumber || quote._id}.pdf`
  );

  doc.pipe(res);

  doc.fontSize(10).fillColor("#444").text("QUOTATION", { align: "right" });
  doc.moveUp();
  doc.fontSize(18).fillColor("#111").text(snap.agencyName || "Company", {
    align: "left",
  });

  doc.moveDown(0.3);
  doc.fontSize(9).fillColor("#555");
  if (snap.agencyAddress) doc.text(snap.agencyAddress);
  if (snap.agencyEmail) doc.text(`Email: ${snap.agencyEmail}`);
  if (snap.agencyPhone) doc.text(`Phone: ${snap.agencyPhone}`);
  if (snap.agencyGstin) doc.text(`GSTIN: ${snap.agencyGstin}`);

  doc.moveDown();
  doc
    .fontSize(10)
    .fillColor("#111")
    .text(`Quote No: ${quote.quoteNumber || "—"}`, { align: "right" });
  doc
    .fontSize(9)
    .fillColor("#666")
    .text(`Date: ${new Date(quote.createdAt || Date.now()).toLocaleDateString("en-IN")}`, {
      align: "right",
    });
  if (quote.validUntil) {
    doc.text(
      `Valid until: ${new Date(quote.validUntil).toLocaleDateString("en-IN")}`,
      { align: "right" }
    );
  }

  doc.moveDown(1.2);
  doc.fontSize(11).fillColor("#111").text("Quote for", { underline: true });
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor("#333");
  doc.text(snap.clientName);
  if (snap.clientAddr) doc.text(snap.clientAddr);
  if (snap.clientEmail) doc.text(snap.clientEmail);
  if (snap.clientPhone) doc.text(snap.clientPhone);

  doc.moveDown(1);
  const tableTop = doc.y;
  doc.fontSize(9).fillColor("#666");
  doc.text("Description", 50, tableTop, { width: 240 });
  doc.text("Qty", 300, tableTop, { width: 40 });
  doc.text("Rate (₹)", 340, tableTop, { width: 70 });
  doc.text("Amount (₹)", 420, tableTop, { width: 80 });
  doc.moveTo(50, tableTop + 14)
    .lineTo(520, tableTop + 14)
    .strokeColor("#ddd")
    .stroke();

  let y = tableTop + 22;
  doc.fillColor("#222");
  items.forEach((row) => {
    doc.fontSize(9).text(row.name, 50, y, { width: 240 });
    doc.text(String(row.qty), 300, y, { width: 40 });
    doc.text(String(row.rate), 340, y, { width: 70 });
    doc.text(String(row.total), 420, y, { width: 80 });
    y += 22;
  });

  doc.y = y + 10;
  doc.moveTo(50, doc.y).lineTo(520, doc.y).strokeColor("#eee").stroke();
  doc.moveDown(0.5);

  const sub = quote.subtotal != null ? quote.subtotal : items.reduce((s, r) => s + r.total, 0);
  doc.fontSize(9).fillColor("#555");
  doc.text(`Subtotal: ₹${sub}`, { align: "right" });
  if (quote.discount) {
    doc.text(`Discount (${quote.discount}%):`, { align: "right" });
  }
  if (quote.gstType === "IGST") {
    doc.text(`IGST (18%): ₹${quote.igst || 0}`, { align: "right" });
  } else {
    doc.text(`CGST (9%): ₹${quote.cgst || 0}`, { align: "right" });
    doc.text(`SGST (9%): ₹${quote.sgst || 0}`, { align: "right" });
  }
  doc.fontSize(12).fillColor("#111");
  const total = quote.totalAmount ?? quote.amount ?? sub;
  doc.text(`Total: ₹${total}`, { align: "right" });

  if (snap.bank && (snap.bank.accountNumber || snap.bank.bank)) {
    doc.moveDown(1.2);
    doc.fontSize(10).text("Bank details", { underline: true });
    doc.fontSize(9).fillColor("#555");
    if (snap.bank.bank) doc.text(`Bank: ${snap.bank.bank}`);
    if (snap.bank.accountName) doc.text(`A/C name: ${snap.bank.accountName}`);
    if (snap.bank.accountNumber) doc.text(`A/C no: ${snap.bank.accountNumber}`);
    if (snap.bank.ifsc) doc.text(`IFSC: ${snap.bank.ifsc}`);
  }

  if (quote.notes) {
    doc.moveDown();
    doc.fontSize(9).fillColor("#666").text("Notes:");
    doc.text(quote.notes, { width: 500 });
  }

  doc.moveDown(1.5);
  doc
    .fontSize(9)
    .fillColor("#888")
    .text(
      "This quotation is valid for the period stated above and does not constitute a tax invoice.",
      { align: "center", width: 500 }
    );

  doc.end();
}

module.exports = generateQuotePDF;
