/**
 * @param {Array<{ name?: string, description?: string, quantity?: number, rate?: number, price?: number, total?: number }>} items
 */
export function calcQuoteTotals(items = [], gstType = "CGST_SGST", discountPct = 0) {
  const calculatedItems = items.map((item) => {
    const qty = Number(item.quantity || 1);
    const rate = Number(item.rate ?? item.price ?? 0);
    const lineTotal =
      item.total != null && !Number.isNaN(Number(item.total))
        ? Number(item.total)
        : qty * rate;
    return {
      name: item.name,
      description: item.description,
      quantity: qty,
      rate,
      total: lineTotal,
    };
  });

  const subtotal = calculatedItems.reduce((s, i) => s + i.total, 0);
  const discount = Number(discountPct) || 0;
  const discountAmt = Math.round((subtotal * discount) / 100);
  const taxable = subtotal - discountAmt;

  const gt = gstType === "IGST" ? "IGST" : "CGST_SGST";
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let totalAmount = taxable;

  if (gt === "CGST_SGST") {
    cgst = Math.round(taxable * 0.09);
    sgst = Math.round(taxable * 0.09);
    totalAmount = taxable + cgst + sgst;
  } else {
    igst = Math.round(taxable * 0.18);
    totalAmount = taxable + igst;
  }

  return {
    calculatedItems,
    subtotal,
    discount,
    gstType: gt,
    cgst,
    sgst,
    igst,
    totalAmount,
  };
}
