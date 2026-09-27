/**
 * Test Suite 1 — Parser
 *
 * Tests that the Tree-sitter parse layer produces correct, deterministic CSTNode trees.
 * All tests use deterministic inputs — no randomness.
 */

import { parse, ParseError, countNodes, countParseErrors, flattenNodes } from '../src/parser';
import { normalizeText } from '../src/hash';

describe('Parser — basic correctness', () => {
  test('parses a simple function declaration', () => {
    const src = `function add(a, b) { return a + b; }`;
    const tree = parse(src);
    expect(tree).toBeDefined();
    expect(tree.nodeType).toBe('program');
    const funcNode = tree.children.find(c => c.nodeType === 'function_declaration');
    expect(funcNode).toBeDefined();
  });

  test('parses an arrow function', () => {
    const src = `const double = (x) => x * 2;`;
    const tree = parse(src);
    const nodes = flattenNodes(tree);
    const arrowFn = nodes.find(n => n.nodeType === 'arrow_function');
    expect(arrowFn).toBeDefined();
  });

  test('parses a class declaration', () => {
    const src = `class Animal { constructor(name) { this.name = name; } }`;
    const tree = parse(src);
    const nodes = flattenNodes(tree);
    const cls = nodes.find(n => n.nodeType === 'class_declaration');
    expect(cls).toBeDefined();
  });

  test('parses an if statement', () => {
    const src = `function check(x) { if (x > 0) { return true; } return false; }`;
    const tree = parse(src);
    const nodes = flattenNodes(tree);
    const ifNode = nodes.find(n => n.nodeType === 'if_statement');
    expect(ifNode).toBeDefined();
  });

  test('handles empty source without throwing', () => {
    const tree = parse('');
    expect(tree).toBeDefined();
    expect(tree.nodeType).toBe('program');
    expect(tree.children.length).toBe(0);
  });

  test('preserves ERROR nodes for invalid syntax', () => {
    // Tree-sitter does not throw on invalid syntax — it produces ERROR nodes
    const src = `function broken( { return; }`;
    const tree = parse(src);
    // Should have parse errors somewhere in the tree
    const errorCount = countParseErrors(tree);
    expect(errorCount).toBeGreaterThan(0);
    expect(tree.hasParseError).toBe(true);
  });

  test('throws ParseError for non-string input', () => {
    // @ts-expect-error — intentionally testing runtime guard
    expect(() => parse(42)).toThrow(ParseError);
  });
});

describe('Parser — hash correctness', () => {
  test('signatureHash is deterministic: same source → same hash', () => {
    const src = `function foo(x) { return x + 1; }`;
    const tree1 = parse(src);
    const tree2 = parse(src);
    expect(tree1.signatureHash).toBe(tree2.signatureHash);
  });

  test('subtreeHash is deterministic: same source → same hash', () => {
    const src = `function foo(x) { return x + 1; }`;
    const tree1 = parse(src);
    const tree2 = parse(src);
    expect(tree1.subtreeHash).toBe(tree2.subtreeHash);
  });

  test('subtreeHash changes when source changes', () => {
    const src1 = `function foo(x) { return x + 1; }`;
    const src2 = `function foo(x) { return x + 2; }`;
    const tree1 = parse(src1);
    const tree2 = parse(src2);
    expect(tree1.subtreeHash).not.toBe(tree2.subtreeHash);
  });

  test('signatureHash is stable across whitespace changes', () => {
    // The signatureHash of the program node uses normalizeText which collapses whitespace
    const src1 = `function foo(x) { return x; }`;
    const src2 = `function foo(x) {   return x;   }`;
    // Function node signatureHash should be the same (own text is just the node type)
    const tree1 = parse(src1);
    const tree2 = parse(src2);
    // The function_declaration nodes should have matching signatureHash
    const fn1 = tree1.children.find(c => c.nodeType === 'function_declaration');
    const fn2 = tree2.children.find(c => c.nodeType === 'function_declaration');
    expect(fn1).toBeDefined();
    expect(fn2).toBeDefined();
    expect(fn1!.signatureHash).toBe(fn2!.signatureHash);
  });

  test('subtreeHash changes with whitespace changes (normalized text differs at leaf level)', () => {
    // subtreeHash is based on full text normalized — spaces inside strings are preserved
    const src1 = `const x = "hello world";`;
    const src2 = `const x = "hello   world";`;
    const tree1 = parse(src1);
    const tree2 = parse(src2);
    // Different string content → different subtreeHash
    expect(tree1.subtreeHash).not.toBe(tree2.subtreeHash);
  });
});

describe('Parser — source ranges', () => {
  test('function declaration has correct line range', () => {
    const src = `function foo() {\n  return 1;\n}`;
    const tree = parse(src);
    const fn = tree.children.find(c => c.nodeType === 'function_declaration');
    expect(fn).toBeDefined();
    expect(fn!.range.startLine).toBe(1);
    expect(fn!.range.endLine).toBe(3);
  });

  test('nested nodes have correct ranges within parent', () => {
    const src = `function outer() {\n  function inner() {\n    return 0;\n  }\n}`;
    const tree = parse(src);
    const nodes = flattenNodes(tree);
    const outer = nodes.find(n => n.nodeType === 'function_declaration');
    expect(outer).toBeDefined();
    expect(outer!.range.startLine).toBe(1);
    expect(outer!.range.endLine).toBe(5);
  });

  test('startIndex and endIndex are byte offsets into source', () => {
    const src = `const x = 1;`;
    const tree = parse(src);
    const decl = tree.children[0];
    expect(decl.range.startIndex).toBe(0);
    expect(decl.range.endIndex).toBe(src.length);
  });
});

describe('Parser — node counting', () => {
  test('countNodes returns at least 1 for non-empty source', () => {
    const tree = parse(`const x = 1;`);
    expect(countNodes(tree)).toBeGreaterThan(1);
  });

  test('countNodes returns 1 for empty source (program node only)', () => {
    const tree = parse('');
    expect(countNodes(tree)).toBe(1);
  });

  test('flattenNodes includes all descendants', () => {
    const src = `function foo(a, b) { return a + b; }`;
    const tree = parse(src);
    const flat = flattenNodes(tree);
    const types = flat.map(n => n.nodeType);
    expect(types).toContain('function_declaration');
    expect(types).toContain('return_statement');
    expect(types).toContain('binary_expression');
  });
});

describe('Parser — stable IDs', () => {
  test('node IDs are stable across two parses of the same source', () => {
    const src = `function foo() { return 1; }`;
    const tree1 = parse(src);
    const tree2 = parse(src);
    const ids1 = flattenNodes(tree1).map(n => n.id);
    const ids2 = flattenNodes(tree2).map(n => n.id);
    expect(ids1).toEqual(ids2);
  });

  test('root node has expected ID format', () => {
    const tree = parse(`const x = 1;`);
    expect(tree.id).toBe('program[0]');
  });
});
