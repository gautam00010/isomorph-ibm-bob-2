/**
 * FIXTURE D — Variable rename / formatting / code movement.
 *
 * Scenario: AI agent reformats code to match a style guide:
 * - Renames single-letter variables to descriptive names
 * - Converts tabs to spaces
 * - Moves a utility function to the top
 * - Converts var to const/let
 * - No logic changes
 *
 * Expected structural result:
 *   - LOW changes (identifier_renamed, variable_declarator_changed for var→const)
 *   - COSMETIC changes (whitespace)
 *   - MOVE for the utility function
 *   - ZERO HIGH changes
 */

function formatCurrency(n) {
  return '$' + n.toFixed(2);
}

function generateReport(data) {
  var r = '';
  for (var i = 0; i < data.length; i++) {
    var e = data[i];
    r += e.name + ': ' + formatCurrency(e.amount) + '\n';
  }
  return r;
}

function computeAverage(nums) {
  var s = 0;
  for (var i = 0; i < nums.length; i++) {
    s = s + nums[i];
  }
  return s / nums.length;
}
