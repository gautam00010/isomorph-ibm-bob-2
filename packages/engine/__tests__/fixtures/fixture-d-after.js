/**
 * FIXTURE D — AFTER (rename + format + movement)
 *
 * What changed (textually): ~20 lines changed
 * What changed (structurally): LOW (renames) + COSMETIC (whitespace) + MOVE (function reorder)
 *
 * No business logic changed. computeAverage and generateReport do the same thing.
 */

function computeAverage(numbers) {
  let sum = 0;
  for (let index = 0; index < numbers.length; index++) {
    sum = sum + numbers[index];
  }
  return sum / numbers.length;
}

function formatCurrency(amount) {
  return '$' + amount.toFixed(2);
}

function generateReport(data) {
  let report = '';
  for (let index = 0; index < data.length; index++) {
    const entry = data[index];
    report += entry.name + ': ' + formatCurrency(entry.amount) + '\n';
  }
  return report;
}
