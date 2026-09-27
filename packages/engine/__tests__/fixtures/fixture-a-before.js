/**
 * FIXTURE A — Large textual refactor with NO intended business behavior change.
 *
 * Scenario: A developer (or AI agent) reformats, renames variables for clarity,
 * adds JSDoc comments, reorders helper functions, and upgrades arrow function syntax.
 * The business logic of calculateInvoiceTotal() is NOT changed.
 *
 * Expected structural result:
 *   - Many COSMETIC changes (whitespace, comments, formatting)
 *   - Several LOW changes (variable renames)
 *   - MOVE operations (function reorder)
 *   - ZERO HIGH changes
 *   - ZERO MEDIUM changes (no interface changes)
 */

// Helper: compute line item total
function computeLineTotal(qty, price) {
  return qty * price;
}

// Helper: apply discount
function applyDiscount(subtotal, discountRate) {
  if (discountRate <= 0) return subtotal;
  return subtotal * (1 - discountRate);
}

// Helper: add tax
function addTax(amount, taxRate) {
  return amount + (amount * taxRate);
}

function calculateInvoiceTotal(items, discountRate, taxRate) {
  var total = 0;
  for (var i = 0; i < items.length; i++) {
    var lineTotal = computeLineTotal(items[i].qty, items[i].price);
    total = total + lineTotal;
  }
  var discounted = applyDiscount(total, discountRate);
  var withTax = addTax(discounted, taxRate);
  return withTax;
}
