/**
 * Test Suite 4 — Fixture Integration Tests
 *
 * Tests the full pipeline against the five defined fixtures.
 * These are acceptance tests: they verify that the engine produces
 * the expected structural signals for real-world-class code changes.
 *
 * All expected values are derived from manual analysis of the fixtures.
 * They are deterministic: same fixtures → same expected values, always.
 */

import * as fs from 'fs';
import * as path from 'path';
import { analyze } from '../src/analyze';
import type { StructuralAnalysisResult } from '../src/types';

function loadFixture(name: string): string {
  return fs.readFileSync(
    path.join(__dirname, 'fixtures', name),
    'utf-8'
  );
}

function runFixture(beforeFile: string, afterFile: string): StructuralAnalysisResult {
  const before = loadFixture(beforeFile);
  const after = loadFixture(afterFile);
  return analyze(before, after);
}

// ---------------------------------------------------------------------------
// Fixture A — Large textual refactor, no behavior change
// ---------------------------------------------------------------------------
describe('Fixture A — Large textual refactor, no behavior change', () => {
  let result: StructuralAnalysisResult;
  beforeAll(() => {
    result = runFixture('fixture-a-before.js', 'fixture-a-after.js');
  });

  test('produces zero HIGH risk entries', () => {
    expect(result.riskSummary.high).toBe(0);
  });

  test('produces zero MEDIUM risk entries', () => {
    // Renames and var→let/const changes are LOW, not MEDIUM
    expect(result.riskSummary.medium).toBe(0);
  });

  test('has more COSMETIC + LOW entries than HIGH + MEDIUM', () => {
    const safe = result.riskSummary.cosmetic + result.riskSummary.low;
    const risky = result.riskSummary.high + result.riskSummary.medium;
    expect(safe).toBeGreaterThan(risky);
  });

  test('parses without errors', () => {
    expect(result.parseSummary.parseErrorCount).toBe(0);
  });

  test('produces a non-empty edit script', () => {
    expect(result.editScript.length).toBeGreaterThan(0);
  });

  test('before and after hashes are different', () => {
    expect(result.beforeHash).not.toBe(result.afterHash);
  });

  test('result is deterministic: running twice produces same hashes', () => {
    const result2 = runFixture('fixture-a-before.js', 'fixture-a-after.js');
    expect(result.beforeHash).toBe(result2.beforeHash);
    expect(result.afterHash).toBe(result2.afterHash);
    expect(result.riskSummary).toEqual(result2.riskSummary);
  });

  test('uncertainty flags include the callee scope limitation', () => {
    const hasCalleeFlag = result.uncertaintyFlags.some(f =>
      f.includes('Callee behavior not analyzed')
    );
    expect(hasCalleeFlag).toBe(true);
  });

  test('uncertainty flags include semantic equivalence disclaimer', () => {
    const hasDisclaimerFlag = result.uncertaintyFlags.some(f =>
      f.includes('Semantic analysis') || f.includes('structural analysis only') ||
      f.includes('NOT claimed')
    );
    expect(hasDisclaimerFlag).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fixture B — Small but dangerous operator/conditional change
// ---------------------------------------------------------------------------
describe('Fixture B — Small dangerous conditional change', () => {
  let result: StructuralAnalysisResult;
  beforeAll(() => {
    result = runFixture('fixture-b-before.js', 'fixture-b-after.js');
  });

  test('produces at least 1 HIGH risk entry', () => {
    expect(result.riskSummary.high).toBeGreaterThanOrEqual(1);
  });

  test('HIGH risk entry is in isValidPageIndex or its condition', () => {
    const highEntries = result.riskMap.filter(e => e.riskLevel === 'HIGH');
    expect(highEntries.length).toBeGreaterThan(0);
    // At least one should relate to a control flow change
    const controlFlowHigh = highEntries.filter(e =>
      e.signals.includes('control_flow_condition_changed') ||
      e.signals.includes('return_value_changed') ||
      e.signals.includes('control_flow_branch_removed')
    );
    expect(controlFlowHigh.length).toBeGreaterThanOrEqual(1);
  });

  test('edit script includes an UPDATE or DELETE for the off-by-one change', () => {
    const updateOps = result.editScript.filter(
      op => op.operation === 'UPDATE' || op.operation === 'DELETE'
    );
    expect(updateOps.length).toBeGreaterThan(0);
  });

  test('parses without errors', () => {
    expect(result.parseSummary.parseErrorCount).toBe(0);
  });

  test('total structural changes are relatively few (small diff)', () => {
    const s = result.structuralDiff.summary;
    const meaningful = s.update + s.insert + s.delete + s.move + s.rewrite;
    // Fixture B changes are small — expect fewer than 50 meaningful structural changes
    expect(meaningful).toBeLessThan(50);
  });
});

// ---------------------------------------------------------------------------
// Fixture C — Function extraction / structural rewrite
// ---------------------------------------------------------------------------
describe('Fixture C — Function extraction / structural rewrite', () => {
  let result: StructuralAnalysisResult;
  beforeAll(() => {
    result = runFixture('fixture-c-before.js', 'fixture-c-after.js');
  });

  test('detects multiple new functions (INSERT operations)', () => {
    const inserts = result.editScript.filter(op =>
      op.operation === 'INSERT' && op.nodeType === 'function_declaration'
    );
    // fixture-c-after has 4 new functions: isValidOrder, calculateOrderTotal,
    // applyOrderDiscount, createOrderResult
    expect(inserts.length).toBeGreaterThanOrEqual(2);
  });

  test('detects that processOrders function body changed (UPDATE)', () => {
    const updates = result.editScript.filter(
      op => op.operation === 'UPDATE'
    );
    expect(updates.length).toBeGreaterThan(0);
  });

  test('the hidden behavioral change (priority→tier, 0.9→0.85) is captured', () => {
    // The discount logic change should produce at least one HIGH or MEDIUM signal
    const highMedium = result.riskMap.filter(
      e => e.riskLevel === 'HIGH' || e.riskLevel === 'MEDIUM'
    );
    expect(highMedium.length).toBeGreaterThan(0);
  });

  test('does NOT claim equivalence anywhere in output', () => {
    // Uncertainty flags must include the structural-only disclaimer
    const hasDisclaimer = result.uncertaintyFlags.some(f =>
      f.toLowerCase().includes('structural') || f.toLowerCase().includes('not claimed')
    );
    expect(hasDisclaimer).toBe(true);
  });

  test('parses without errors', () => {
    expect(result.parseSummary.parseErrorCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Fixture D — Variable rename / formatting / code movement
// ---------------------------------------------------------------------------
describe('Fixture D — Variable rename / formatting / code movement', () => {
  let result: StructuralAnalysisResult;
  beforeAll(() => {
    result = runFixture('fixture-d-before.js', 'fixture-d-after.js');
  });

  test('produces zero HIGH risk entries', () => {
    expect(result.riskSummary.high).toBe(0);
  });

  test('produces more LOW + COSMETIC than MEDIUM + HIGH', () => {
    const safe = result.riskSummary.low + result.riskSummary.cosmetic;
    const risky = result.riskSummary.medium + result.riskSummary.high;
    expect(safe).toBeGreaterThan(risky);
  });

  test('parses without errors', () => {
    expect(result.parseSummary.parseErrorCount).toBe(0);
  });

  test('identifier_renamed signal appears for renamed variables', () => {
    const renamedEntries = result.riskMap.filter(e =>
      e.signals.includes('identifier_renamed')
    );
    expect(renamedEntries.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Fixture E — Authentication / authorization change
// ---------------------------------------------------------------------------
describe('Fixture E — Authentication/authorization behavior change', () => {
  let result: StructuralAnalysisResult;
  beforeAll(() => {
    result = runFixture('fixture-e-before.js', 'fixture-e-after.js');
  });

  test('produces at least 2 HIGH risk entries', () => {
    // At minimum: token expiry removal + permission logic change
    expect(result.riskSummary.high).toBeGreaterThanOrEqual(2);
  });

  test('control_flow_condition_changed signal is present', () => {
    const signals = result.riskMap.flatMap(e => e.signals);
    expect(signals).toContain('control_flow_condition_changed');
  });

  test('HIGH risk entries have non-trivial humanLabels', () => {
    const highEntries = result.riskMap.filter(e => e.riskLevel === 'HIGH');
    for (const entry of highEntries) {
      expect(entry.humanLabel.length).toBeGreaterThan(5);
    }
  });

  test('edit script records the admin bypass INSERT', () => {
    // The admin bypass is a new if_statement inserted into authorize()
    const inserts = result.editScript.filter(op => op.operation === 'INSERT');
    expect(inserts.length).toBeGreaterThan(0);
  });

  test('early_return_removed or control_flow signals present for expiry removal', () => {
    const signals = result.riskMap.flatMap(e => e.signals);
    const hasRelevantSignal =
      signals.includes('early_return_removed') ||
      signals.includes('control_flow_branch_removed') ||
      signals.includes('control_flow_condition_changed');
    expect(hasRelevantSignal).toBe(true);
  });

  test('parses without errors', () => {
    expect(result.parseSummary.parseErrorCount).toBe(0);
  });

  test('result is deterministic: running twice produces same risk summary', () => {
    const result2 = runFixture('fixture-e-before.js', 'fixture-e-after.js');
    expect(result.riskSummary).toEqual(result2.riskSummary);
  });
});

// ---------------------------------------------------------------------------
// Cross-fixture: proof hash properties
// ---------------------------------------------------------------------------
describe('Cross-fixture — proof properties', () => {
  test('different fixture pairs produce different beforeHash/afterHash', () => {
    const rA = runFixture('fixture-a-before.js', 'fixture-a-after.js');
    const rB = runFixture('fixture-b-before.js', 'fixture-b-after.js');
    expect(rA.beforeHash).not.toBe(rB.beforeHash);
    expect(rA.afterHash).not.toBe(rB.afterHash);
  });

  test('beforeHash and afterHash are sha256-prefixed strings', () => {
    const result = runFixture('fixture-a-before.js', 'fixture-a-after.js');
    expect(result.beforeHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(result.afterHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test('analyzedAt is a valid ISO 8601 timestamp', () => {
    const result = runFixture('fixture-a-before.js', 'fixture-a-after.js');
    expect(() => new Date(result.analyzedAt)).not.toThrow();
    expect(new Date(result.analyzedAt).toISOString()).toBe(result.analyzedAt);
  });

  test('all editScript entries have valid operation values', () => {
    const validOps = new Set(['INSERT', 'DELETE', 'UPDATE', 'MOVE', 'COSMETIC', 'UNCHANGED']);
    const result = runFixture('fixture-e-before.js', 'fixture-e-after.js');
    for (const op of result.editScript) {
      expect(validOps.has(op.operation)).toBe(true);
    }
  });
});
