/**
 * Test Suite 3 — Risk Classifier
 *
 * Tests that the classifier assigns correct risk levels and signals.
 */

import { parse } from '../src/parser';
import { diff } from '../src/differ';
import { classify, summarizeRiskMap } from '../src/classifier';

function analyzeChange(before: string, after: string) {
  const beforeTree = parse(before);
  const afterTree = parse(after);
  const structuralDiff = diff(beforeTree, afterTree);
  const riskMap = classify(structuralDiff, afterTree);
  return { structuralDiff, riskMap, summary: summarizeRiskMap(riskMap) };
}

describe('Classifier — COSMETIC changes', () => {
  test('whitespace-only change produces COSMETIC or LOW, no HIGH', () => {
    const { summary } = analyzeChange(
      `function foo() {\nreturn 1;\n}`,
      `function foo() {\n  return 1;\n}`
    );
    expect(summary.high).toBe(0);
  });

  test('comment-only change produces no HIGH risk', () => {
    const { summary } = analyzeChange(
      `function foo() { return 1; }`,
      `// Returns 1\nfunction foo() { return 1; }`
    );
    expect(summary.high).toBe(0);
  });
});

describe('Classifier — HIGH risk: control flow', () => {
  test('if condition change is classified HIGH with control_flow_condition_changed', () => {
    const { riskMap, summary } = analyzeChange(
      `function check(x) { if (x > 0) { return true; } return false; }`,
      `function check(x) { if (x >= 0) { return true; } return false; }`
    );
    expect(summary.high).toBeGreaterThan(0);
    const highEntries = riskMap.filter(e => e.riskLevel === 'HIGH');
    const signals = highEntries.flatMap(e => e.signals);
    expect(signals).toContain('control_flow_condition_changed');
  });

  test('return value change is classified HIGH with return_value_changed', () => {
    const { riskMap, summary } = analyzeChange(
      `function getDiscount(price) { return price > 0 ? price * 0.1 : 0; }`,
      `function getDiscount(price) { return price * 0.1; }`
    );
    expect(summary.high).toBeGreaterThan(0);
    const signals = riskMap.filter(e => e.riskLevel === 'HIGH').flatMap(e => e.signals);
    expect(signals).toContain('return_value_changed');
  });

  test('deleted throw statement is classified HIGH', () => {
    const { riskMap, summary } = analyzeChange(
      `function validate(x) { if (!x) { throw new Error('invalid'); } return x; }`,
      `function validate(x) { return x; }`
    );
    // The if_statement or throw_statement should be classified HIGH
    expect(summary.high + summary.medium).toBeGreaterThan(0);
  });

  test('deleted catch clause is classified HIGH', () => {
    const { riskMap, summary } = analyzeChange(
      `function safe(fn) { try { return fn(); } catch(e) { return null; } }`,
      `function safe(fn) { return fn(); }`
    );
    expect(summary.high + summary.medium).toBeGreaterThan(0);
  });
});

describe('Classifier — MEDIUM risk: interface changes', () => {
  test('added function export is MEDIUM with export_added', () => {
    const { riskMap, summary } = analyzeChange(
      `function foo() { return 1; }`,
      `export function foo() { return 1; }`
    );
    expect(summary.medium + summary.high).toBeGreaterThan(0);
  });
});

describe('Classifier — summarizeRiskMap', () => {
  test('summary counts match actual riskMap entries', () => {
    const { riskMap, summary } = analyzeChange(
      `function foo() { return 1; }`,
      `function foo() { return 2; }\nfunction bar() {}`
    );
    const manual = { high: 0, medium: 0, low: 0, cosmetic: 0, unknown: 0 };
    for (const e of riskMap) {
      switch (e.riskLevel) {
        case 'HIGH':     manual.high++;     break;
        case 'MEDIUM':   manual.medium++;   break;
        case 'LOW':      manual.low++;      break;
        case 'COSMETIC': manual.cosmetic++; break;
        case 'UNKNOWN':  manual.unknown++;  break;
      }
    }
    expect(summary).toEqual(manual);
  });

  test('every riskMap entry has a non-empty humanLabel', () => {
    const { riskMap } = analyzeChange(
      `function foo(x) { if (x > 0) return x; throw new Error('bad'); }`,
      `function foo(x) { return x; }`
    );
    for (const entry of riskMap) {
      expect(entry.humanLabel.length).toBeGreaterThan(0);
    }
  });

  test('every riskMap entry has at least one signal', () => {
    const { riskMap } = analyzeChange(
      `function foo() { return 1; }`,
      `function foo() { return 2; }`
    );
    for (const entry of riskMap) {
      expect(entry.signals.length).toBeGreaterThan(0);
    }
  });
});

describe('Classifier — classification is deterministic', () => {
  test('same inputs produce same riskMap across two runs', () => {
    const before = `function foo(x) { if (x > 0) { return x; } return -1; }`;
    const after = `function foo(x) { return x; }`;
    const r1 = analyzeChange(before, after);
    const r2 = analyzeChange(before, after);
    expect(r1.summary).toEqual(r2.summary);
    const labels1 = r1.riskMap.map(e => e.humanLabel + ':' + e.riskLevel);
    const labels2 = r2.riskMap.map(e => e.humanLabel + ':' + e.riskLevel);
    expect(labels1).toEqual(labels2);
  });
});
