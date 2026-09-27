/**
 * Layer 1 — Parse
 *
 * Transforms a JavaScript source string into a canonical CSTNode tree.
 * Uses Tree-sitter for parsing. Output is deterministic.
 *
 * Guarantees:
 * - parse(source) always returns the same CSTNode tree for the same source
 * - signatureHash is stable across whitespace/comment changes in own text
 * - subtreeHash changes if any descendant's normalized text changes
 * - ERROR nodes are preserved and propagate hasParseError=true upward
 */

import Parser from 'tree-sitter';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const JavaScript = require('tree-sitter-javascript');

import type { CSTNode, SourceRange } from './types';
import { computeSignatureHash, computeSubtreeHash, normalizeText } from './hash';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly source: string,
    public readonly line?: number
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

// Note: tree-sitter parser instances cannot be shared across async test contexts.
// We create a fresh parser for each call to ensure reliable behaviour.
function getParser(): Parser {
  const parser = new Parser();
  parser.setLanguage(JavaScript as Parameters<typeof Parser.prototype.setLanguage>[0]);
  return parser;
}

/**
 * Parse a JavaScript source string into a canonical CSTNode tree.
 *
 * @param source - The source code to parse
 * @returns The root CSTNode of the CST
 * @throws ParseError if source is empty or cannot be processed
 */
export function parse(source: string): CSTNode {
  if (typeof source !== 'string') {
    throw new ParseError('Source must be a string', String(source));
  }

  const parser = getParser();
  const tree = parser.parse(source);

  if (!tree || !tree.rootNode) {
    throw new ParseError('Tree-sitter returned no parse tree', source);
  }

  return convertNode(tree.rootNode, source, '', 0);
}

// ---------------------------------------------------------------------------
// Internal: Convert tree-sitter SyntaxNode → CSTNode
// ---------------------------------------------------------------------------

function convertNode(
  node: Parser.SyntaxNode,
  source: string,
  parentPath: string,
  siblingIndex: number
): CSTNode {
  const range = extractRange(node);

  // Build stable path ID: parent/nodeType[siblingIndex]
  const pathSegment = `${node.type}[${siblingIndex}]`;
  const nodeId = parentPath ? `${parentPath}/${pathSegment}` : pathSegment;

  // Extract own text (the node's text excluding children's text where possible)
  // For leaf nodes: full text. For internal nodes: the node's own non-child characters.
  const fullText = source.slice(node.startIndex, node.endIndex);
  const ownText = extractOwnText(node, source);

  // Convert children
  const children: CSTNode[] = [];
  let hasParseError = node.type === 'ERROR';

  // tree-sitter v0.25 uses .children property
  const tsChildren = node.children;
  let namedChildIdx = 0;
  for (let i = 0; i < tsChildren.length; i++) {
    const child = tsChildren[i];
    // Use named-child index for named nodes, positional for anonymous
    const idx = child.isNamed ? namedChildIdx++ : i;
    const childNode = convertNode(child, source, nodeId, idx);
    children.push(childNode);
    if (childNode.hasParseError) hasParseError = true;
  }

  const signatureHash = computeSignatureHash(node.type, getFieldName(node), ownText);
  const subtreeHash = computeSubtreeHash(node.type, fullText);

  return {
    id: nodeId,
    nodeType: node.type,
    fieldName: getFieldName(node),
    isNamed: node.isNamed,
    ownText: normalizeText(ownText),
    signatureHash,
    subtreeHash,
    range,
    children,
    hasParseError,
  };
}

function extractRange(node: Parser.SyntaxNode): SourceRange {
  return {
    startIndex: node.startIndex,
    endIndex: node.endIndex,
    startLine: node.startPosition.row + 1, // 1-based
    endLine: node.endPosition.row + 1,
    startColumn: node.startPosition.column,
    endColumn: node.endPosition.column,
  };
}

/** Node types where the signatureHash should include the declaration name. */
const NAMED_DECLARATION_TYPES = new Set([
  'function_declaration',
  'function',
  'method_definition',
  'class_declaration',
  'class',
  'arrow_function',
]);

function extractOwnText(node: Parser.SyntaxNode, source: string): string {
  // For leaf nodes (no children), own text is the full node text
  if (node.children.length === 0) {
    return source.slice(node.startIndex, node.endIndex);
  }
  // For declaration nodes with a stable name, include the name in ownText
  // so the signatureHash can distinguish e.g. function foo from function bar.
  if (NAMED_DECLARATION_TYPES.has(node.type)) {
    const nameChild = node.children.find(
      c => c.type === 'identifier' || c.type === 'property_identifier'
    );
    if (nameChild) {
      const name = source.slice(nameChild.startIndex, nameChild.endIndex);
      return `${node.type}:${name}`;
    }
  }
  // For other internal nodes, own text is the node type itself
  // (we do not reconstruct "skeleton" text — the type captures identity)
  return node.type;
}

function getFieldName(node: Parser.SyntaxNode): string | null {
  // tree-sitter stores field names on the parent; we retrieve it via parent.fieldNameForChild
  const parent = node.parent;
  if (!parent) return null;
  // Iterate over named children to find field name
  for (let i = 0; i < parent.children.length; i++) {
    if (parent.children[i] === node) {
      const fieldName = parent.fieldNameForChild(i);
      return fieldName ?? null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Count total nodes in a CSTNode tree.
 */
export function countNodes(root: CSTNode): number {
  let count = 1;
  for (const child of root.children) {
    count += countNodes(child);
  }
  return count;
}

/**
 * Count ERROR nodes in a CSTNode tree.
 */
export function countParseErrors(root: CSTNode): number {
  let count = root.nodeType === 'ERROR' ? 1 : 0;
  for (const child of root.children) {
    count += countParseErrors(child);
  }
  return count;
}

/**
 * Collect all nodes into a flat array (depth-first).
 */
export function flattenNodes(root: CSTNode): CSTNode[] {
  const result: CSTNode[] = [root];
  for (const child of root.children) {
    result.push(...flattenNodes(child));
  }
  return result;
}
