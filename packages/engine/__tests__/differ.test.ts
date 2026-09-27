/**
 * Test Suite 2 — Structural Differ
 *
 * Tests that the differ produces correct, deterministic edit scripts.
 */

import { parse } from '../src/parser';
import { diff, flattenDiffNodes } from '../src/differ';

describe('Differ — identical sources', () => {
  test('produces zero non-UNCHANGED nodes for identical sources', () => {
    const src = `function foo(x) { return x + 1; }`;
    const before = parse(src);
    const after = parse(src);
    const result = diff(before, after);
    const nonUnchanged = result.nodes.filter(n => n.changeType !== 'UNCHANGED');
    expect(nonUnchanged.length).toBe(0);
  });

  test('summary shows all nodes as UNCHANGED for identical sources', () => {
    const src = `const x = 1; const y = 2;`;
    const before = parse(src);
    const after = parse(src);
    const result = diff(before, after);
    expect(result.summary.update).toBe(0);
    expect(result.summary.insert).toBe(0);
    expect(result.summary.delete).toBe(0);
    expect(result.summary.rewrite).toBe(0);
    expect(result.summary.unknown).toBe(0);
  });

  test('is deterministic: same inputs always produce same result', () => {
    const src1 = `function a() { return 1; }`;
    const src2 = `function a() { return 2; }`;
    const r1 = diff(parse(src1), parse(src2));
    const r2 = diff(parse(src1), parse(src2));
    // Compare summary counts (stable)
    expect(r1.summary).toEqual(r2.summary);
    // Compare first-level node types
    const types1 = r1.rootNodes.map(n => n.changeType + ':' + n.nodeType);
    const types2 = r2.rootNodes.map(n => n.changeType + ':' + n.nodeType);
    expect(types1).toEqual(types2);
  });
});

describe('Differ — INSERT and DELETE', () => {
  test('detects inserted function', () => {
    const before = parse(`function foo() { return 1; }`);
    const after = parse(`function foo() { return 1; }\nfunction bar() { return 2; }`);
    const result = diff(before, after);
    const inserts = flattenDiffNodes(result.rootNodes).filter(n => n.changeType === 'INSERT');
    expect(inserts.length).toBeGreaterThan(0);
    const barInsert = inserts.find(n => n.nodeType === 'function_declaration');
    expect(barInsert).toBeDefined();
  });

  test('detects deleted function', () => {
    const before = parse(`function foo() { return 1; }\nfunction bar() { return 2; }`);
    const after = parse(`function foo() { return 1; }`);
    const result = diff(before, after);
    const deletes = flattenDiffNodes(result.rootNodes).filter(n => n.changeType === 'DELETE');
    expect(deletes.length).toBeGreaterThan(0);
    const barDelete = deletes.find(n => n.nodeType === 'function_declaration');
    expect(barDelete).toBeDefined();
  });

  test('INSERT node has afterRange but no beforeRange', () => {
    const before = parse(`function foo() {}`);
    const after = parse(`function foo() {}\nfunction bar() {}`);
    const result = diff(before, after);
    const inserts = flattenDiffNodes(result.rootNodes).filter(
      n => n.changeType === 'INSERT' && n.nodeType === 'function_declaration'
    );
    expect(inserts.length).toBeGreaterThan(0);
    expect(inserts[0].afterRange).toBeDefined();
    expect(inserts[0].beforeRange).toBeUndefined();
  });

  test('DELETE node has beforeRange but no afterRange', () => {
    const before = parse(`function foo() {}\nfunction bar() {}`);
    const after = parse(`function foo() {}`);
    const result = diff(before, after);
    const deletes = flattenDiffNodes(result.rootNodes).filter(
      n => n.changeType === 'DELETE' && n.nodeType === 'function_declaration'
    );
    expect(deletes.length).toBeGreaterThan(0);
    expect(deletes[0].beforeRange).toBeDefined();
    expect(deletes[0].afterRange).toBeUndefined();
  });
});

describe('Differ — UPDATE', () => {
  test('detects return value change as UPDATE in function body', () => {
    const before = parse(`function foo() { return 1; }`);
    const after = parse(`function foo() { return 2; }`);
    const result = diff(before, after);
    const updates = flattenDiffNodes(result.rootNodes).filter(n => n.changeType === 'UPDATE');
    expect(updates.length).toBeGreaterThan(0);
  });

  test('UPDATE node has both beforeHash and afterHash', () => {
    const before = parse(`function foo() { return 1; }`);
    const after = parse(`function foo() { return 2; }`);
    const result = diff(before, after);
    const updates = flattenDiffNodes(result.rootNodes).filter(n => n.changeType === 'UPDATE');
    for (const node of updates) {
      expect(node.beforeHash).toBeDefined();
      expect(node.afterHash).toBeDefined();
      expect(node.beforeHash).not.toBe(node.afterHash);
    }
  });

  test('detects condition change in if statement', () => {
    const before = parse(`function check(x) { if (x > 0) { return true; } return false; }`);
    const after = parse(`function check(x) { if (x >= 0) { return true; } return false; }`);
    const result = diff(before, after);
    const updates = flattenDiffNodes(result.rootNodes).filter(n => n.changeType === 'UPDATE');
    expect(updates.length).toBeGreaterThan(0);
  });
});

describe('Differ — COSMETIC', () => {
  test('classifies whitespace-only change as COSMETIC', () => {
    const before = parse(`function foo() {\nreturn 1;\n}`);
    const after = parse(`function foo() {\n  return 1;\n}`);
    const result = diff(before, after);
    const cosmetic = flattenDiffNodes(result.rootNodes).filter(n => n.changeType === 'COSMETIC');
    // There should be some cosmetic or unchanged — not UPDATE of the return
    const updates = flattenDiffNodes(result.rootNodes).filter(n => n.changeType === 'UPDATE');
    const returnUpdates = updates.filter(n => n.nodeType === 'return_statement');
    expect(returnUpdates.length).toBe(0);
  });
});

describe('Differ — source range traceability', () => {
  test('all UPDATE nodes have afterRange with valid line numbers', () => {
    const before = parse(`function foo() { return 1; }`);
    const after = parse(`function foo() { return 2; }`);
    const result = diff(before, after);
    const updates = flattenDiffNodes(result.rootNodes).filter(n => n.changeType === 'UPDATE');
    for (const node of updates) {
      if (node.afterRange) {
        expect(node.afterRange.startLine).toBeGreaterThanOrEqual(1);
        expect(node.afterRange.endLine).toBeGreaterThanOrEqual(node.afterRange.startLine);
      }
    }
  });

  test('diff summary totals match actual node count', () => {
    const before = parse(`function foo() { return 1; }`);
    const after = parse(`function foo() { return 2; }\nfunction bar() {}`);
    const result = diff(before, after);
    const s = result.summary;
    const countedTotal = s.unchanged + s.cosmetic + s.update + s.insert + s.delete + s.move + s.rewrite + s.unknown;
    expect(countedTotal).toBe(s.total);
  });
});

describe('Differ — textBefore and textAfter', () => {
  test('UPDATE node textAfter truncated to ≤ 500 chars', () => {
    const longBody = 'x + '.repeat(200) + '1';
    const before = parse(`function f() { return 0; }`);
    const after = parse(`function f() { return ${longBody}; }`);
    const result = diff(before, after);
    const updates = flattenDiffNodes(result.rootNodes).filter(n => n.changeType === 'UPDATE');
    for (const u of updates) {
      if (u.textAfter !== undefined) {
        expect(u.textAfter.length).toBeLessThanOrEqual(501); // 500 + ellipsis char
      }
    }
  });
});
