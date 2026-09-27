/**
 * Layer 2 — Structural Differ
 *
 * Produces an explicit edit script (INSERT / DELETE / UPDATE / MOVE / COSMETIC / UNCHANGED)
 * by comparing two CSTNode trees.
 *
 * Algorithm: Three-pass top-down matching
 *
 * Pass 1 — Exact subtree matching
 *   Walk both trees aligned by path. Same subtreeHash → UNCHANGED (prune).
 *   Same nodeType, different subtreeHash → UPDATE (recurse into children).
 *
 * Pass 2 — Move detection
 *   After Pass 1, collect all nodes marked INSERT or DELETE at declaration level.
 *   If a DELETED node's subtreeHash appears in an INSERTED node: reclassify both as MOVE.
 *   Move detection is limited to named declaration nodes to avoid combinatorial explosion.
 *
 * Pass 3 — Cosmetic reclassification
 *   For UPDATE nodes: if signatureHash matches and only whitespace/comment nodes differ
 *   in children, reclassify as COSMETIC.
 *
 * Determinism:
 *   All operations use stable IDs and content hashes. No randomness. No external calls.
 *   diff(A, B) always produces the same StructuralDiff for the same A and B.
 */

import type { CSTNode, DiffNode, StructuralDiff, DiffSummary, ChangeType } from './types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class DiffError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiffError';
  }
}

/**
 * Compute the structural diff between two parsed JavaScript CSTs.
 *
 * @param before - CSTNode tree for the original source
 * @param after  - CSTNode tree for the modified source
 * @returns StructuralDiff containing the complete edit script
 */
export function diff(before: CSTNode, after: CSTNode): StructuralDiff {
  // Pass 1: top-down structural matching
  const rootNodes = diffNodes(before, after, 0);

  // Pass 2: move detection on declaration-level nodes
  applyMoveDetection(rootNodes);

  // Pass 3: cosmetic reclassification
  applyCosmetic(rootNodes);

  // Flatten all nodes into a single array for iteration
  const allNodes = flattenDiffNodes(rootNodes);

  const summary = computeSummary(allNodes);

  return {
    nodes: allNodes,
    rootNodes,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Pass 1 — Top-down structural matching
// ---------------------------------------------------------------------------

function diffNodes(
  before: CSTNode | null,
  after: CSTNode | null,
  depth: number
): DiffNode[] {
  if (before === null && after === null) return [];
  if (before === null && after !== null) return [makeInsert(after, depth)];
  if (before !== null && after === null) return [makeDelete(before, depth)];

  const b = before!;
  const a = after!;

  // Exact match: subtrees are structurally identical
  if (b.subtreeHash === a.subtreeHash) {
    return [makeUnchanged(b, a, depth)];
  }

  // Same node type at same position: UPDATE (recurse into children)
  if (b.nodeType === a.nodeType) {
    // Handle ERROR nodes
    if (b.hasParseError || a.hasParseError) {
      return [makeUnknown(b, a, depth)];
    }
    const children = diffChildren(b.children, a.children, depth + 1);
    const node: DiffNode = {
      nodeId: a.id,
      changeType: 'UPDATE',
      nodeType: a.nodeType,
      fieldName: a.fieldName,
      beforeHash: b.subtreeHash,
      afterHash: a.subtreeHash,
      beforeRange: b.range,
      afterRange: a.range,
      textBefore: truncate(b.ownText, 500),
      textAfter: truncate(a.ownText, 500),
      children,
      depth,
    };
    return [node];
  }

  // Different node types at same position: treat as DELETE + INSERT
  return [makeDelete(b, depth), makeInsert(a, depth)];
}

/**
 * Align children of two nodes and diff them.
 *
 * Strategy: longest-common-subsequence (LCS) alignment by signatureHash.
 * This handles insertions and deletions within a child list gracefully.
 *
 * For very large child lists (> 200 children), fall back to positional alignment
 * to avoid O(n²) LCS overhead.
 */
function diffChildren(
  beforeChildren: CSTNode[],
  afterChildren: CSTNode[],
  depth: number
): DiffNode[] {
  const MAX_LCS = 200;

  if (beforeChildren.length === 0 && afterChildren.length === 0) return [];
  if (beforeChildren.length === 0) return afterChildren.map(c => makeInsert(c, depth));
  if (afterChildren.length === 0) return beforeChildren.map(c => makeDelete(c, depth));

  // Use LCS for manageable sizes
  if (beforeChildren.length <= MAX_LCS && afterChildren.length <= MAX_LCS) {
    return lcsAlign(beforeChildren, afterChildren, depth);
  }

  // Positional fallback for large child lists
  const result: DiffNode[] = [];
  const len = Math.max(beforeChildren.length, afterChildren.length);
  for (let i = 0; i < len; i++) {
    const b = beforeChildren[i] ?? null;
    const a = afterChildren[i] ?? null;
    result.push(...diffNodes(b, a, depth));
  }
  return result;
}

/**
 * LCS-based child alignment using signatureHash for node identity.
 * Produces the minimal edit script for the child list.
 */
function lcsAlign(
  before: CSTNode[],
  after: CSTNode[],
  depth: number
): DiffNode[] {
  // Build LCS table using signatureHash for equality
  const m = before.length;
  const n = after.length;

  // dp[i][j] = length of LCS of before[0..i-1] and after[0..j-1]
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (before[i - 1].signatureHash === after[j - 1].signatureHash) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find alignment
  const alignment: Array<{ b: CSTNode | null; a: CSTNode | null }> = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && before[i - 1].signatureHash === after[j - 1].signatureHash) {
      alignment.unshift({ b: before[i - 1], a: after[j - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      alignment.unshift({ b: null, a: after[j - 1] });
      j--;
    } else {
      alignment.unshift({ b: before[i - 1], a: null });
      i--;
    }
  }

  // Produce diff for each aligned pair
  const result: DiffNode[] = [];
  for (const { b, a } of alignment) {
    result.push(...diffNodes(b, a, depth));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Pass 2 — Move detection
// ---------------------------------------------------------------------------

/** Node types that are considered "declaration-level" for move detection */
const DECLARATION_TYPES = new Set([
  'function_declaration',
  'function',
  'arrow_function',
  'method_definition',
  'class_declaration',
  'class',
  'variable_declaration',
  'lexical_declaration',
  'export_statement',
]);

function applyMoveDetection(rootNodes: DiffNode[]): void {
  // Collect all INSERT and DELETE nodes at declaration level
  const deleted = new Map<string, DiffNode>(); // subtreeHash → DiffNode
  const inserted = new Map<string, DiffNode>();

  collectDeclarationChanges(rootNodes, deleted, inserted);

  // Match DELETE↔INSERT pairs by subtreeHash
  for (const [hash, deletedNode] of deleted) {
    const insertedNode = inserted.get(hash);
    if (insertedNode) {
      // Reclassify both as MOVE
      const movedFrom = deletedNode.nodeId;
      deletedNode.changeType = 'MOVE' as ChangeType;
      deletedNode.movedFrom = insertedNode.nodeId;
      insertedNode.changeType = 'MOVE' as ChangeType;
      insertedNode.movedFrom = movedFrom;
      deleted.delete(hash);
      inserted.delete(hash);
    }
  }
}

function collectDeclarationChanges(
  nodes: DiffNode[],
  deleted: Map<string, DiffNode>,
  inserted: Map<string, DiffNode>
): void {
  for (const node of nodes) {
    if (node.changeType === 'DELETE' && DECLARATION_TYPES.has(node.nodeType)) {
      if (node.beforeHash) deleted.set(node.beforeHash, node);
    } else if (node.changeType === 'INSERT' && DECLARATION_TYPES.has(node.nodeType)) {
      if (node.afterHash) inserted.set(node.afterHash, node);
    } else {
      collectDeclarationChanges(node.children, deleted, inserted);
    }
  }
}

// ---------------------------------------------------------------------------
// Pass 3 — Cosmetic reclassification
// ---------------------------------------------------------------------------

/**
 * Reclassify UPDATE nodes as COSMETIC if:
 * - The signatureHash of the before and after nodes matches (structural identity preserved)
 * - All child differences are only in whitespace or comment nodes
 */
function applyCosmetic(nodes: DiffNode[]): void {
  for (const node of nodes) {
    if (node.changeType === 'UPDATE') {
      if (isOnlyCosmetic(node)) {
        node.changeType = 'COSMETIC';
      } else {
        applyCosmetic(node.children);
      }
    } else {
      applyCosmetic(node.children);
    }
  }
}

function isOnlyCosmetic(node: DiffNode): boolean {
  // All child changes must be cosmetic or whitespace/comment nodes
  return node.children.every(child => {
    if (child.changeType === 'UNCHANGED') return true;
    if (child.changeType === 'COSMETIC') return true;
    // Whitespace and comment tokens are anonymous nodes
    if (!isNamedType(child.nodeType)) return true;
    // Comment nodes
    if (isCommentType(child.nodeType)) return true;
    return false;
  });
}

function isNamedType(nodeType: string): boolean {
  // Tree-sitter anonymous tokens (punctuation, keywords used as tokens) are lowercase
  // Named node types start with identifiers like "function_declaration"
  // Whitespace is represented as anonymous nodes without a specific type
  return nodeType !== 'comment' && !nodeType.startsWith('"') && nodeType.length > 1;
}

function isCommentType(nodeType: string): boolean {
  return nodeType === 'comment' || nodeType === 'block_comment' || nodeType === 'line_comment';
}

// ---------------------------------------------------------------------------
// Node factory helpers
// ---------------------------------------------------------------------------

function makeUnchanged(before: CSTNode, after: CSTNode, depth: number): DiffNode {
  return {
    nodeId: after.id,
    changeType: 'UNCHANGED',
    nodeType: after.nodeType,
    fieldName: after.fieldName,
    beforeHash: before.subtreeHash,
    afterHash: after.subtreeHash,
    beforeRange: before.range,
    afterRange: after.range,
    children: [],
    depth,
  };
}

function makeInsert(node: CSTNode, depth: number): DiffNode {
  return {
    nodeId: node.id,
    changeType: 'INSERT',
    nodeType: node.nodeType,
    fieldName: node.fieldName,
    afterHash: node.subtreeHash,
    afterRange: node.range,
    textAfter: truncate(buildSummaryText(node), 500),
    children: [],
    depth,
  };
}

function makeDelete(node: CSTNode, depth: number): DiffNode {
  return {
    nodeId: node.id,
    changeType: 'DELETE',
    nodeType: node.nodeType,
    fieldName: node.fieldName,
    beforeHash: node.subtreeHash,
    beforeRange: node.range,
    textBefore: truncate(buildSummaryText(node), 500),
    // Recurse into children so classifiers can inspect deleted subtrees
    children: node.children.map(c => makeDelete(c, depth + 1)),
    depth,
  };
}

function makeUnknown(before: CSTNode, after: CSTNode, depth: number): DiffNode {
  return {
    nodeId: after.id,
    changeType: 'UNKNOWN',
    nodeType: after.nodeType,
    fieldName: after.fieldName,
    beforeHash: before.subtreeHash,
    afterHash: after.subtreeHash,
    beforeRange: before.range,
    afterRange: after.range,
    textBefore: truncate(buildSummaryText(before), 500),
    textAfter: truncate(buildSummaryText(after), 500),
    children: [],
    depth,
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Build a summary text for a node by reconstructing from own text and node type.
 * Used for textBefore/textAfter in the diff output.
 */
function buildSummaryText(node: CSTNode): string {
  if (node.children.length === 0) return node.ownText;
  return `[${node.nodeType}]`;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}

export function flattenDiffNodes(nodes: DiffNode[]): DiffNode[] {
  const result: DiffNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children.length > 0) {
      result.push(...flattenDiffNodes(node.children));
    }
  }
  return result;
}

function computeSummary(allNodes: DiffNode[]): DiffSummary {
  const counts = {
    unchanged: 0, cosmetic: 0, update: 0,
    insert: 0, delete: 0, move: 0, rewrite: 0, unknown: 0,
  };
  for (const node of allNodes) {
    switch (node.changeType) {
      case 'UNCHANGED': counts.unchanged++; break;
      case 'COSMETIC':  counts.cosmetic++;  break;
      case 'UPDATE':    counts.update++;    break;
      case 'INSERT':    counts.insert++;    break;
      case 'DELETE':    counts.delete++;    break;
      case 'MOVE':      counts.move++;      break;
      case 'REWRITE':   counts.rewrite++;   break;
      case 'UNKNOWN':   counts.unknown++;   break;
    }
  }
  return {
    total: allNodes.length,
    ...counts,
    // Textual line counts are not computed here — set by caller from raw diff
    textualLinesAdded: 0,
    textualLinesRemoved: 0,
  };
}
