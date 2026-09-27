/**
 * FIXTURE C — AFTER (function extraction / structural rewrite)
 *
 * What changed (textually): ~30 lines added, 10 removed
 * What changed (structurally): new functions (INSERT), main function updated
 *
 * IMPORTANT: This LOOKS like a large change but may be behaviorally equivalent.
 * The engine must NOT claim equivalence. It must report the structural changes
 * and leave behavioral assessment to IBM Bob + evidence.
 *
 * NOTE: There IS a subtle behavioral difference:
 * - Before: `order.priority === 'high'` applies 10% discount
 * - After:  `order.tier === 'premium'` applies 15% discount
 * A pure refactor should NOT change the discount field name or percentage.
 * This is the kind of change that gets lost in a large structural rewrite.
 */

function isValidOrder(order) {
  return order.id && order.items && order.items.length > 0;
}

function calculateOrderTotal(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price * items[i].quantity;
  }
  return total;
}

function applyOrderDiscount(total, order) {
  if (order.tier === 'premium') {
    return total * 0.85;
  }
  return total;
}

function createOrderResult(order, total) {
  return { id: order.id, status: 'processed', total };
}

function processOrders(orders) {
  const results = [];
  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    if (!isValidOrder(order)) {
      results.push({ id: order.id, status: 'invalid', total: 0 });
      continue;
    }
    const rawTotal = calculateOrderTotal(order.items);
    const total = applyOrderDiscount(rawTotal, order);
    results.push(createOrderResult(order, total));
  }
  return results;
}
