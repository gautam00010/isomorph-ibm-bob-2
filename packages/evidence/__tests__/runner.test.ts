import { runEvidence } from '../src/runner';

describe('Evidence Runner', () => {
  const dummySource = `
function calculateDiscount(price, rate) {
  if (price <= 0) return 0;
  return price * (1 - rate);
}
module.exports = { calculateDiscount };
`;

  test('records PASS when assertion succeeds', async () => {
    const stub = `
test('valid discount', () => {
  expect(calculateDiscount(100, 0.2)).toBe(80);
});
`;
    const record = await runEvidence([stub], dummySource);
    expect(record.totalStubs).toBe(1);
    expect(record.ran).toBe(1);
    expect(record.passed).toBe(1);
    expect(record.failed).toBe(0);
    expect(record.results[0].status).toBe('PASS');
  });

  test('records FAIL when assertion fails', async () => {
    const stub = `
test('zero price guard', () => {
  expect(calculateDiscount(0, 0.2)).toBe(50);
});
`;
    const record = await runEvidence([stub], dummySource);
    expect(record.totalStubs).toBe(1);
    expect(record.ran).toBe(1);
    expect(record.failed).toBe(1);
    expect(record.passed).toBe(0);
    expect(record.results[0].status).toBe('FAIL');
    expect(record.results[0].assertionMessage).toBeDefined();
    expect(record.results[0].assertionMessage).toContain('50');
  });

  test('records SYNTAX_ERROR on malformed stub', async () => {
    const stub = `test('broken syntax', () => { ??? invalid JS !!! });`;
    const record = await runEvidence([stub], dummySource);
    expect(record.totalStubs).toBe(1);
    expect(record.errored).toBe(1);
    expect(record.results[0].status).toBe('SYNTAX_ERROR');
  });

  test('handles empty stub array gracefully', async () => {
    const record = await runEvidence([], dummySource);
    expect(record.totalStubs).toBe(0);
    expect(record.ran).toBe(0);
    expect(record.passed).toBe(0);
    expect(record.failed).toBe(0);
    expect(record.results).toEqual([]);
  });
});
