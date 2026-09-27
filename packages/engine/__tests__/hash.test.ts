/**
 * Test Suite 5 — Hash Utilities
 *
 * Tests that normalization and hashing are correct and deterministic.
 */

import { normalizeText, sha256, computeSignatureHash, computeSubtreeHash, hashSource } from '../src/hash';

describe('normalizeText', () => {
  test('collapses multiple spaces to single space', () => {
    expect(normalizeText('a   b')).toBe('a b');
  });

  test('collapses tabs and newlines to single space', () => {
    expect(normalizeText('a\t\t\nb')).toBe('a b');
  });

  test('strips line comments', () => {
    expect(normalizeText('a // comment\nb')).toBe('a b');
  });

  test('strips block comments', () => {
    expect(normalizeText('a /* block comment */ b')).toBe('a b');
  });

  test('preserves string literal content', () => {
    expect(normalizeText('"hello   world"')).toBe('"hello   world"');
  });

  test('preserves single-quoted string content', () => {
    expect(normalizeText("'a  b'")).toBe("'a  b'");
  });

  test('handles empty string', () => {
    expect(normalizeText('')).toBe('');
  });

  test('handles string with only whitespace', () => {
    expect(normalizeText('   \n\t  ')).toBe('');
  });

  test('does not strip comment-like content inside strings', () => {
    expect(normalizeText('"// not a comment"')).toBe('"// not a comment"');
  });

  test('normalizeText is deterministic: same input → same output', () => {
    const input = 'function foo(x) { /* comment */ return x + 1; }';
    expect(normalizeText(input)).toBe(normalizeText(input));
  });
});

describe('sha256', () => {
  test('returns sha256-prefixed hex string', () => {
    const hash = sha256('hello');
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test('is deterministic: same input → same hash', () => {
    expect(sha256('test')).toBe(sha256('test'));
  });

  test('produces different hashes for different inputs', () => {
    expect(sha256('a')).not.toBe(sha256('b'));
  });

  test('known test vector: SHA-256 of empty string', () => {
    // SHA-256('') = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(sha256('')).toBe('sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('computeSignatureHash', () => {
  test('same inputs produce same hash', () => {
    const h1 = computeSignatureHash('function_declaration', null, 'function foo()');
    const h2 = computeSignatureHash('function_declaration', null, 'function foo()');
    expect(h1).toBe(h2);
  });

  test('different node types produce different hashes', () => {
    const h1 = computeSignatureHash('function_declaration', null, 'foo');
    const h2 = computeSignatureHash('variable_declaration', null, 'foo');
    expect(h1).not.toBe(h2);
  });

  test('different field names produce different hashes', () => {
    const h1 = computeSignatureHash('identifier', 'left', 'x');
    const h2 = computeSignatureHash('identifier', 'right', 'x');
    expect(h1).not.toBe(h2);
  });

  test('null and non-null fieldName produce different hashes', () => {
    const h1 = computeSignatureHash('identifier', null, 'x');
    const h2 = computeSignatureHash('identifier', 'condition', 'x');
    expect(h1).not.toBe(h2);
  });
});

describe('computeSubtreeHash', () => {
  test('same inputs produce same hash', () => {
    const h1 = computeSubtreeHash('function_declaration', 'function foo() { return 1; }');
    const h2 = computeSubtreeHash('function_declaration', 'function foo() { return 1; }');
    expect(h1).toBe(h2);
  });

  test('extra internal whitespace differences produce same hash (normalized)', () => {
    // Both have spaces in the same places — only run length differs
    const h1 = computeSubtreeHash('function_declaration', 'function  foo()  {  return  1;  }');
    const h2 = computeSubtreeHash('function_declaration', 'function foo() { return 1; }');
    expect(h1).toBe(h2);
  });

  test('different content produces different hash', () => {
    const h1 = computeSubtreeHash('function_declaration', 'function foo() { return 1; }');
    const h2 = computeSubtreeHash('function_declaration', 'function foo() { return 2; }');
    expect(h1).not.toBe(h2);
  });
});

describe('hashSource', () => {
  test('returns sha256-prefixed string', () => {
    expect(hashSource('const x = 1;')).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test('is deterministic', () => {
    const src = 'function foo() { return 42; }';
    expect(hashSource(src)).toBe(hashSource(src));
  });

  test('different sources produce different hashes', () => {
    expect(hashSource('const a = 1;')).not.toBe(hashSource('const b = 1;'));
  });
});
