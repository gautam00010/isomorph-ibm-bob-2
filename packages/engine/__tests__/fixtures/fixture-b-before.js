/**
 * FIXTURE B — Small but dangerous operator/conditional change.
 *
 * Scenario: AI agent "simplifies" a bounds-checking function.
 * The textual diff is ~3 lines. The behavioral change is severe:
 * the strict equality check (===) is replaced with loose equality (==),
 * AND a guard condition is subtly inverted.
 *
 * Expected structural result:
 *   - 1–2 HIGH changes (control_flow_condition_changed, return_value_changed)
 *   - Very few total structural changes
 *   - Small textual diff disguising a dangerous change
 */

function isValidPageIndex(index, totalPages) {
  if (index === null || index === undefined) {
    return false;
  }
  if (index < 0 || index >= totalPages) {
    return false;
  }
  return true;
}

function getPage(index, totalPages, pages) {
  if (!isValidPageIndex(index, totalPages)) {
    throw new Error('Invalid page index: ' + index);
  }
  return pages[index];
}

function processRequest(userInput, pages) {
  const index = parseInt(userInput, 10);
  const page = getPage(index, pages.length, pages);
  return page.content;
}
