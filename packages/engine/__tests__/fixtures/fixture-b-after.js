/**
 * FIXTURE B — AFTER (dangerous small change)
 *
 * What changed (textually): 3 lines changed
 * What changed (structurally): HIGH risk — condition changed
 *
 * BUG 1: `index === null || index === undefined` → `index == null`
 *   Loose equality with null also matches undefined, which was the intent,
 *   BUT it also changes the type coercion semantics in subtle ways.
 *
 * BUG 2: `index < 0 || index >= totalPages` → `index < 0 || index > totalPages`
 *   Off-by-one: index === totalPages is now a VALID index (out-of-bounds access).
 *   This is a real class of vulnerability.
 *
 * A text diff shows 3 changed lines. The structural differ must flag both as HIGH.
 */

function isValidPageIndex(index, totalPages) {
  if (index == null) {
    return false;
  }
  if (index < 0 || index > totalPages) {
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
