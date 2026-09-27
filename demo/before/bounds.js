/**
 * FIXTURE B — Page Index & Bounds Guard
 * Module: pagination/bounds.js
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

module.exports = {
  isValidPageIndex,
  getPage,
  processRequest,
};
