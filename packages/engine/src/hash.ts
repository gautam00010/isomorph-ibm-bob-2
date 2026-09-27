/**
 * Deterministic hashing and text normalization utilities.
 *
 * These functions are pure and have no side effects.
 * Same inputs always produce same outputs.
 */

import { createHash } from 'crypto';

/**
 * Normalize source text for hashing:
 * 1. Replace all whitespace runs (spaces, tabs, newlines) with a single space
 * 2. Strip line comments (// ...) but preserve content inside string literals
 * 3. Strip block comments (/* ... *\/) but preserve content inside string literals
 * 4. Trim leading/trailing whitespace
 *
 * DOES NOT normalize:
 * - String literal content (content between quotes is preserved exactly)
 * - Numeric literals
 * - Template literal content
 *
 * This normalization is stable: two nodes that differ only in whitespace or
 * comments will produce the same normalized text.
 */
export function normalizeText(raw: string): string {
  // Remove block comments outside strings, then collapse whitespace outside strings
  const withoutComments = stripComments(raw);
  const collapsed = collapseWhitespaceOutsideStrings(withoutComments);
  return collapsed.trim();
}

/**
 * Collapse runs of whitespace to a single space, but ONLY outside string literals.
 * Whitespace inside strings is preserved exactly.
 */
function collapseWhitespaceOutsideStrings(source: string): string {
  const out: string[] = [];
  let i = 0;
  const len = source.length;

  while (i < len) {
    const ch = source[i];

    // String literals — pass through verbatim
    if (ch === "'") {
      const end = consumeString(source, i, "'");
      out.push(source.slice(i, end));
      i = end;
      continue;
    }
    if (ch === '"') {
      const end = consumeString(source, i, '"');
      out.push(source.slice(i, end));
      i = end;
      continue;
    }
    if (ch === '`') {
      const end = consumeTemplateLiteral(source, i);
      out.push(source.slice(i, end));
      i = end;
      continue;
    }

    // Whitespace outside strings: collapse run to single space
    if (/\s/.test(ch)) {
      out.push(' ');
      while (i < len && /\s/.test(source[i])) i++;
      continue;
    }

    out.push(ch);
    i++;
  }

  return out.join('');
}

/**
 * Strip JavaScript/TypeScript comments while preserving string literal content.
 * Uses a simple state machine rather than regex backtracking to avoid ReDoS.
 */
function stripComments(source: string): string {
  const out: string[] = [];
  let i = 0;
  const len = source.length;

  while (i < len) {
    const ch = source[i];
    const next = source[i + 1];

    // String literals: single quote
    if (ch === "'") {
      const end = consumeString(source, i, "'");
      out.push(source.slice(i, end));
      i = end;
      continue;
    }

    // String literals: double quote
    if (ch === '"') {
      const end = consumeString(source, i, '"');
      out.push(source.slice(i, end));
      i = end;
      continue;
    }

    // Template literals
    if (ch === '`') {
      const end = consumeTemplateLiteral(source, i);
      out.push(source.slice(i, end));
      i = end;
      continue;
    }

    // Line comment
    if (ch === '/' && next === '/') {
      // Consume to end of line
      while (i < len && source[i] !== '\n') i++;
      out.push(' '); // replace comment with space to maintain token separation
      continue;
    }

    // Block comment
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < len - 1 && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2; // skip */
      out.push(' ');
      continue;
    }

    out.push(ch);
    i++;
  }

  return out.join('');
}

function consumeString(source: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < source.length) {
    if (source[i] === '\\') { i += 2; continue; }
    if (source[i] === quote) return i + 1;
    i++;
  }
  return i;
}

function consumeTemplateLiteral(source: string, start: number): number {
  let i = start + 1;
  let depth = 0;
  while (i < source.length) {
    if (source[i] === '\\') { i += 2; continue; }
    if (source[i] === '$' && source[i + 1] === '{') { depth++; i += 2; continue; }
    if (source[i] === '}' && depth > 0) { depth--; i++; continue; }
    if (source[i] === '`' && depth === 0) return i + 1;
    i++;
  }
  return i;
}

/**
 * Compute SHA-256 hash of a string, returned as hex with "sha256:" prefix.
 */
export function sha256(input: string): string {
  return 'sha256:' + createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Compute the signatureHash for a CST node.
 * signatureHash = SHA-256(nodeType + "|" + (fieldName ?? "") + "|" + normalizedOwnText)
 *
 * Stable across: whitespace changes in own text, comment changes in own text.
 * Sensitive to: node type changes, field name changes, non-whitespace text changes.
 */
export function computeSignatureHash(
  nodeType: string,
  fieldName: string | null,
  ownText: string
): string {
  const normalized = normalizeText(ownText);
  const input = `${nodeType}|${fieldName ?? ''}|${normalized}`;
  return sha256(input);
}

/**
 * Compute the subtreeHash for a CST node.
 * subtreeHash = SHA-256(nodeType + "|" + normalizedFullText)
 *
 * Sensitive to: any change in any descendant's normalized text.
 * Two nodes with identical subtreeHash are structurally identical.
 */
export function computeSubtreeHash(
  nodeType: string,
  fullText: string
): string {
  const normalized = normalizeText(fullText);
  const input = `${nodeType}|${normalized}`;
  return sha256(input);
}

/**
 * Compute SHA-256 of a source file for input provenance.
 */
export function hashSource(source: string): string {
  return sha256(source);
}
