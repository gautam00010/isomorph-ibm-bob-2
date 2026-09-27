/**
 * FIXTURE A — AFTER (refactored for "clarity" by AI agent)
 *
 * What changed (textually): ~40 lines of red/green
 * What changed (structurally): cosmetic + renames + reorder, NO logic change
 *
 * NOTE: The business behavior of calculateInvoiceTotal is IDENTICAL to before.
 * A text diff would show this as a large, noisy change.
 * The structural differ should classify the meaningful changes as LOW/COSMETIC only.
 */

/**
 * Calculates the total price for a single line item.
 * @param {number} quantity - Item quantity
 * @param {number} unitPrice - Price per unit
 * @returns {number} Line item total
 */
function calculateLineItemTotal(quantity, unitPrice) {
  return quantity * unitPrice;
}

/**
 * Applies a percentage discount to a subtotal.
 * @param {number} subtotal - Pre-discount amount
 * @param {number} discount - Discount rate (0–1)
 * @returns {number} Discounted amount
 */
function applyPercentageDiscount(subtotal, discount) {
  if (discount <= 0) return subtotal;
  return subtotal * (1 - discount);
}

/**
 * Adds sales tax to an amount.
 * @param {number} baseAmount - Pre-tax amount
 * @param {number} rate - Tax rate (0–1)
 * @returns {number} Amount including tax
 */
function addSalesTax(baseAmount, rate) {
  return baseAmount + (baseAmount * rate);
}

/**
 * Calculates the total invoice amount including discounts and tax.
 * @param {Array} lineItems - Array of {qty, price} objects
 * @param {number} discountRate - Discount rate (0–1)
 * @param {number} taxRate - Tax rate (0–1)
 * @returns {number} Final invoice total
 */
function calculateInvoiceTotal(lineItems, discountRate, taxRate) {
  let subtotal = 0;
  for (let i = 0; i < lineItems.length; i++) {
    const lineTotal = calculateLineItemTotal(lineItems[i].qty, lineItems[i].price);
    subtotal = subtotal + lineTotal;
  }
  const discounted = applyPercentageDiscount(subtotal, discountRate);
  const total = addSalesTax(discounted, taxRate);
  return total;
}
