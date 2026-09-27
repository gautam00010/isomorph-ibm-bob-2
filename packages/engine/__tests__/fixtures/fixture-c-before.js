/**
 * FIXTURE C — Function extraction / structural rewrite.
 *
 * Scenario: AI agent "improves modularity" by extracting inline logic into
 * separate functions and restructuring the main processing loop.
 * This produces a large structural diff despite potentially equivalent behavior.
 *
 * Expected structural result:
 *   - Multiple INSERT (new extracted functions)
 *   - One UPDATE (main function body changed)
 *   - MEDIUM changes (interface: new parameters, new exports)
 *   - Engine should detect this as a structural rewrite, NOT claim equivalence
 */

function processOrders(orders) {
  var results = [];
  for (var i = 0; i < orders.length; i++) {
    var order = orders[i];
    // Validate
    if (!order.id || !order.items || order.items.length === 0) {
      results.push({ id: order.id, status: 'invalid', total: 0 });
      continue;
    }
    // Calculate total
    var total = 0;
    for (var j = 0; j < order.items.length; j++) {
      total += order.items[j].price * order.items[j].quantity;
    }
    // Apply priority discount
    if (order.priority === 'high') {
      total = total * 0.9;
    }
    results.push({ id: order.id, status: 'processed', total: total });
  }
  return results;
}
