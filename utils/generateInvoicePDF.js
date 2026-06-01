import PDFDocument from "pdfkit";

function generateInvoicePDF(invoice, res) {
  const doc = new PDFDocument({ margin: 50 });

  // stream to response
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename=invoice-${invoice.invoiceNumber}.pdf`
  );

  doc.pipe(res);

  // 🔷 COMPANY HEADER
  doc
    .fontSize(20)
    .text("CREONOX TECHNOLOGY", { align: "left" });

  doc
    .fontSize(10)
    .text("Panvel, Maharashtra, India")
    .text("Email: support@creonox.com")
    .text("GSTIN: 27XXXXXXXXX1Z5");

  doc.moveDown();

  // 🔷 INVOICE TITLE
  doc
    .fontSize(18)
    .text("INVOICE", { align: "right" });

  doc
    .fontSize(10)
    .text(`Invoice No: ${invoice.invoiceNumber}`, { align: "right" })
    .text(`Date: ${new Date().toLocaleDateString()}`, { align: "right" });

  doc.moveDown();

  // 🔷 CUSTOMER DETAILS
  doc
    .fontSize(12)
    .text("Bill To:", { underline: true });

  doc
    .fontSize(10)
    .text(invoice.customer?.name || "")
    .text(invoice.customer?.email || "")
    .text(invoice.customer?.phone || "");

  doc.moveDown();

  // 🔷 TABLE HEADER
  doc
    .fontSize(10)
    .text("Item", 50, doc.y)
    .text("Qty", 250, doc.y)
    .text("Price", 300, doc.y)
    .text("Total", 400, doc.y);

  doc.moveDown();

  // 🔷 ITEMS
  invoice.items.forEach((item) => {
    doc
      .text(item.name, 50, doc.y)
      .text(item.quantity, 250, doc.y)
      .text(`₹${item.price}`, 300, doc.y)
      .text(`₹${item.total}`, 400, doc.y);

    doc.moveDown();
  });

  doc.moveDown();

  // 🔷 TOTALS
  doc.text(`Subtotal: ₹${invoice.subtotal}`, { align: "right" });
  doc.text(`GST (${invoice.taxRate}%): ₹${invoice.tax}`, { align: "right" });
  doc
    .fontSize(12)
    .text(`Total: ₹${invoice.totalAmount}`, { align: "right" });

  doc.moveDown();

  // 🔷 PAYMENT DETAILS
  doc
    .fontSize(12)
    .text("Bank Details", { underline: true });

  doc
    .fontSize(10)
    .text("Bank: HDFC Bank")
    .text("Account Name: Creonox Technology")
    .text("Account No: 1234567890")
    .text("IFSC: HDFC0001234");

  doc.moveDown();

  // 🔷 NOTES
  doc
    .fontSize(10)
    .text("Notes:")
    .text("Thank you for your business!");

  doc.moveDown();

  // 🔷 FOOTER
  doc
    .fontSize(10)
    .text("Authorized Signature", { align: "right" });

  doc.end();
}

export default generateInvoicePDF;