/**
 * Layer 3 — Change Classifier
 *
 * Assigns a RiskLevel and named RiskSignals to each non-UNCHANGED DiffNode.
 * This layer is purely rule-based and deterministic — no AI, no randomness.
 *
 * Classification is heuristic. It detects the specific patterns listed in RiskSignal.
 * It does NOT claim to detect all behavioral changes.
 *
 * UNKNOWN is a first-class output: when a change cannot be classified by any rule,
 * it is labeled UNKNOWN rather than silently promoted to LOW.
 */

import type {
  CSTNode,
  ClassificationEntry,
  DiffNode,
  RiskLevel,
  RiskMap,
  RiskSignal,
  StructuralDiff,
} from './types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify all non-UNCHANGED nodes in a structural diff.
 *
 * @param structuralDiff - Output from Layer 2
 * @param afterTree      - The after-version CSTNode tree (used for context extraction)
 * @returns RiskMap: one entry per classified DiffNode
 */
/** Declaration-level node types whose deletion makes inner signals irrelevant. */
const DECLARATION_BOUNDARY_TYPES = new Set([
  'function_declaration',
  'function',
  'arrow_function',
  'method_definition',
  'class_declaration',
  'class',
]);

export function classify(
  structuralDiff: StructuralDiff,
  afterTree: CSTNode
): RiskMap {
  const riskMap: RiskMap = [];

  // Collect IDs of nodes that are descendants of a deleted declaration.
  // We skip classifying those descendants individually — only the top-level
  // delete is classified. This prevents false positives like early_return_removed
  // inside a function that was itself entirely deleted (e.g., function rename).
  const insideDeletedDeclaration = buildDeletedDeclarationDescendantSet(structuralDiff.rootNodes);

  for (const node of structuralDiff.nodes) {
    if (node.changeType === 'UNCHANGED') continue;
    if (insideDeletedDeclaration.has(node.nodeId)) continue;

    const entry = classifyNode(node, afterTree);
    riskMap.push(entry);
  }

  return riskMap;
}

/**
 * Walk the root diff tree and collect nodeIds of ALL descendants (not the node itself)
 * of DELETE declaration nodes.
 */
function buildDeletedDeclarationDescendantSet(rootNodes: DiffNode[]): Set<string> {
  const excluded = new Set<string>();
  for (const node of rootNodes) {
    collectDeletedDeclarationDescendants(node, false, excluded);
  }
  return excluded;
}

function collectDeletedDeclarationDescendants(
  node: DiffNode,
  insideDeletedDecl: boolean,
  excluded: Set<string>
): void {
  if (insideDeletedDecl) {
    excluded.add(node.nodeId);
  }

  const enterDelete =
    !insideDeletedDecl &&
    node.changeType === 'DELETE' &&
    DECLARATION_BOUNDARY_TYPES.has(node.nodeType);

  for (const child of node.children) {
    collectDeletedDeclarationDescendants(child, insideDeletedDecl || enterDelete, excluded);
  }
}

// ---------------------------------------------------------------------------
// Per-node classification
// ---------------------------------------------------------------------------

function classifyNode(
  node: DiffNode,
  afterTree: CSTNode
): ClassificationEntry {
  const signals: RiskSignal[] = detectSignals(node);
  const riskLevel = deriveRiskLevel(signals, node);
  const context = extractContext(node.nodeId, afterTree);

  return {
    nodeId: node.nodeId,
    riskLevel,
    signals,
    humanLabel: buildHumanLabel(node, signals, riskLevel),
    enclosingFunction: context.functionName,
    enclosingClass: context.className,
    diffNodeRef: node,
  };
}

// ---------------------------------------------------------------------------
// Signal detection
// ---------------------------------------------------------------------------

/**
 * Detect risk signals for a DiffNode.
 * Each signal maps to a specific CST node type pattern.
 */
function detectSignals(node: DiffNode): RiskSignal[] {
  if (node.changeType === 'COSMETIC') return ['whitespace_only'];
  if (node.changeType === 'UNCHANGED') return [];
  if (node.changeType === 'UNKNOWN' || node.nodeType === 'ERROR') return ['contains_parse_error'];

  const signals: Set<RiskSignal> = new Set();

  // Check the node itself
  detectSignalsForNodeType(node, signals);

  // For UPDATE nodes, also check child changes
  if (node.changeType === 'UPDATE' || node.changeType === 'MOVE') {
    for (const child of node.children) {
      if (child.changeType !== 'UNCHANGED') {
        detectSignalsForNodeType(child, signals);
      }
    }
  }

  if (signals.size === 0) {
    signals.add('unknown_signal');
  }

  return Array.from(signals);
}

function detectSignalsForNodeType(node: DiffNode, signals: Set<RiskSignal>): void {
  const type = node.nodeType;

  // ---- Control flow ----

  // if_statement: condition changed
  if (type === 'if_statement' && node.changeType === 'UPDATE') {
    const condNode = node.children.find(c => c.fieldName === 'condition');
    if (condNode && condNode.changeType !== 'UNCHANGED' && !isOnlyIdentifierRenames(condNode)) {
      signals.add('control_flow_condition_changed');
    }
  }

  // if_statement: else branch removed
  if (type === 'if_statement') {
    const branchRemoved = node.children.some(
      c => (c.fieldName === 'alternative' || c.fieldName === 'consequence') &&
           c.changeType === 'DELETE'
    );
    if (branchRemoved) signals.add('control_flow_branch_removed');
  }

  // Deleted if/switch/ternary entirely
  if (
    (type === 'if_statement' || type === 'switch_statement' || type === 'ternary_expression') &&
    node.changeType === 'DELETE'
  ) {
    signals.add('control_flow_branch_removed');
  }

  // for_statement / while_statement / do_statement: condition changed
  if (
    (type === 'for_statement' || type === 'while_statement' || type === 'do_statement') &&
    node.changeType === 'UPDATE'
  ) {
    const condNode = node.children.find(c => c.fieldName === 'condition');
    if (condNode && condNode.changeType !== 'UNCHANGED' && !isOnlyIdentifierRenames(condNode)) {
      signals.add('loop_condition_changed');
    }
  }

  // return_statement: expression changed — only HIGH if structurally changed, not just identifier renames
  if (type === 'return_statement') {
    if (node.changeType === 'UPDATE' && !isOnlyIdentifierRenames(node)) {
      signals.add('return_value_changed');
    }
    if (node.changeType === 'DELETE') signals.add('early_return_removed');
  }

  // throw_statement: deleted
  if (type === 'throw_statement' && node.changeType === 'DELETE') {
    signals.add('throw_removed');
  }

  // try_statement: catch clause removed (update) or entire try removed (delete implies catch gone)
  if (type === 'try_statement' && node.changeType === 'UPDATE') {
    const catchRemoved = node.children.some(
      c => c.fieldName === 'handler' && c.changeType === 'DELETE'
    );
    if (catchRemoved) signals.add('catch_removed');
  }
  if (type === 'try_statement' && node.changeType === 'DELETE') {
    // Entire try block deleted — any catch it had is also removed
    const hadCatch = node.children.some(c => c.fieldName === 'handler' || c.nodeType === 'catch_clause');
    if (hadCatch) signals.add('catch_removed');
  }

  // catch_clause: deleted directly
  if (type === 'catch_clause' && node.changeType === 'DELETE') {
    signals.add('catch_removed');
  }

  // ---- Async / side-effect ----

  // async function: async keyword removed
  if (
    (type === 'function_declaration' || type === 'function' || type === 'arrow_function' || type === 'method_definition') &&
    node.changeType === 'UPDATE'
  ) {
    // Detect async→sync by checking if 'async' token was in before but not after
    // We check textBefore for "async" keyword
    const hadAsync = node.textBefore?.includes('[') === false &&
      (node.textBefore?.startsWith('async') ?? false);
    const hasAsync = node.textAfter?.startsWith('async') ?? false;
    if (hadAsync && !hasAsync) signals.add('async_modifier_removed');
  }

  // await_expression: deleted
  if (type === 'await_expression' && node.changeType === 'DELETE') {
    signals.add('await_expression_removed');
  }

  // ---- Interface ----

  // function: parameters changed (net count change only — not renames)
  if (
    (type === 'function_declaration' || type === 'function' || type === 'arrow_function' || type === 'method_definition') &&
    node.changeType === 'UPDATE'
  ) {
    const paramChildren = node.children.filter(c => c.fieldName === 'parameters');
    for (const pc of paramChildren) {
      if (pc.changeType !== 'UNCHANGED') {
        // Count net inserts and deletes of parameter identifiers/patterns
        const paramInsertCount = pc.children.filter(
          c => c.changeType === 'INSERT' && isParamNode(c.nodeType)
        ).length;
        const paramDeleteCount = pc.children.filter(
          c => c.changeType === 'DELETE' && isParamNode(c.nodeType)
        ).length;
        // Net count change = structural add/remove, not rename
        if (paramInsertCount > paramDeleteCount) signals.add('parameter_added');
        if (paramDeleteCount > paramInsertCount) signals.add('parameter_removed');
        // Equal counts of DELETE+INSERT identifier pairs = parameter rename
        if (paramInsertCount > 0 && paramInsertCount === paramDeleteCount) {
          signals.add('identifier_renamed');
        }
      }
    }
  }

  // export_statement: added or removed
  if (type === 'export_statement') {
    if (node.changeType === 'INSERT') signals.add('export_added');
    if (node.changeType === 'DELETE') signals.add('export_removed');
  }

  // ---- Data flow ----

  // assignment_expression: RHS changed (only structural changes, not just identifier renames)
  if (type === 'assignment_expression' && node.changeType === 'UPDATE') {
    const rhsNode = node.children.find(c => c.fieldName === 'right');
    if (rhsNode && rhsNode.changeType !== 'UNCHANGED' && !isOnlyIdentifierRenames(rhsNode)) {
      signals.add('assignment_value_changed');
    }
  }

  // variable_declarator: initializer value changed (not keyword change like var→const)
  // Only fire if the declarator itself (not just the parent keyword) changed
  if (type === 'variable_declarator' && node.changeType === 'UPDATE') {
    // Check if the value (right side) actually changed, not just the name
    const valueChanged = node.children.some(
      c => c.fieldName === 'value' && c.changeType !== 'UNCHANGED'
    );
    if (valueChanged) signals.add('variable_declarator_changed');
  }

  // ---- Identifier rename ----
  // UPDATE: tree-sitter produces UPDATE identifier when ownText changes in-place
  if (type === 'identifier' && node.changeType === 'UPDATE') {
    signals.add('identifier_renamed');
  }
  // DELETE identifier inside an UPDATE parent is a LCS-split rename (paired with INSERT)
  if (isIdentifierLike(type) && node.changeType === 'DELETE') {
    signals.add('identifier_renamed');
  }

  // ---- Comment changes ----
  if (type === 'comment' && node.changeType === 'UPDATE') {
    signals.add('comment_only');
  }
}

// ---------------------------------------------------------------------------
// Signal detection helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if all descendant changes in a subtree are only identifier renames
 * or UNCHANGED/COSMETIC — no structural additions, deletions, or type changes.
 *
 * "Identifier rename" covers both UPDATE-identifier and DELETE+INSERT-identifier
 * pairs that the LCS aligner produces when identifier text changes.
 *
 * Used to distinguish "renamed variable in return expression" from
 * "structurally different return expression".
 */
function isOnlyIdentifierRenames(node: DiffNode): boolean {
  if (node.changeType === 'UNCHANGED' || node.changeType === 'COSMETIC') return true;
  // Identifier INSERT or DELETE are renames (always paired by LCS)
  if (node.changeType === 'INSERT' || node.changeType === 'DELETE') {
    return isIdentifierLike(node.nodeType) || isAnonymousToken(node.nodeType);
  }
  if (node.changeType === 'UPDATE') {
    // An identifier UPDATE is a rename — that's fine
    if (isIdentifierLike(node.nodeType)) return true;
    // For other UPDATE nodes, check all children recursively
    return node.children.every(c => isOnlyIdentifierRenames(c));
  }
  // MOVE, REWRITE, UNKNOWN are structural
  return false;
}

/**
 * Returns true for identifier-like node types that represent variable/function names.
 */
function isIdentifierLike(nodeType: string): boolean {
  return (
    nodeType === 'identifier' ||
    nodeType === 'property_identifier' ||
    nodeType === 'shorthand_property_identifier' ||
    nodeType === 'shorthand_property_identifier_pattern' ||
    nodeType === 'private_property_identifier'
  );
}

/**
 * Returns true for tree-sitter anonymous structural token node types
 * that are non-behavioral — punctuation, brackets, delimiters.
 * These can be inserted/deleted as part of structural rewriting without
 * indicating a meaningful behavioral change.
 *
 * Explicitly excludes operator tokens (>, >=, !==, +, -, etc.) which
 * represent behavioral changes.
 */
function isAnonymousToken(nodeType: string): boolean {
  // Structural punctuation / delimiters — not behavioral operators
  const STRUCTURAL_TOKENS = new Set([
    '(', ')', '{', '}', '[', ']', ',', ';', ':', '.',
    '=>', 'function', 'return', 'var', 'let', 'const',
    'if', 'else', 'for', 'while', 'do', 'try', 'catch', 'finally',
    'new', 'this', 'typeof', 'instanceof', 'in', 'of',
    'class', 'extends', 'export', 'import', 'from', 'as',
    'async', 'await', 'yield', 'void', 'delete',
    'true', 'false', 'null', 'undefined',
    '...', '?.', '??',
  ]);
  return STRUCTURAL_TOKENS.has(nodeType);
}

/**
 * Returns true for node types that represent formal parameters.
 */
function isParamNode(nodeType: string): boolean {
  return (
    nodeType === 'identifier' ||
    nodeType === 'rest_pattern' ||
    nodeType === 'assignment_pattern' ||
    nodeType === 'object_pattern' ||
    nodeType === 'array_pattern' ||
    nodeType === 'formal_parameter'
  );
}

// ---------------------------------------------------------------------------
// Risk level derivation
// ---------------------------------------------------------------------------

const HIGH_SIGNALS: ReadonlySet<RiskSignal> = new Set([
  'control_flow_condition_changed',
  'control_flow_branch_removed',
  'loop_condition_changed',
  'early_return_removed',
  'return_value_changed',
  'throw_removed',
  'catch_removed',
  'async_modifier_removed',
]);

const MEDIUM_SIGNALS: ReadonlySet<RiskSignal> = new Set([
  'await_expression_removed',
  'parameter_added',
  'parameter_removed',
  'export_added',
  'export_removed',
  'assignment_value_changed',
]);

const LOW_SIGNALS: ReadonlySet<RiskSignal> = new Set([
  'variable_declarator_changed',
  'identifier_renamed',
]);

const COSMETIC_SIGNALS: ReadonlySet<RiskSignal> = new Set([
  'whitespace_only',
  'comment_only',
]);

function deriveRiskLevel(signals: RiskSignal[], node: DiffNode): RiskLevel {
  if (node.changeType === 'UNKNOWN' || signals.includes('contains_parse_error')) return 'UNKNOWN';

  // MOVE is a special case — movement itself is structural, not necessarily risky
  if (node.changeType === 'MOVE') return 'LOW';

  if (signals.some(s => HIGH_SIGNALS.has(s))) return 'HIGH';
  if (signals.some(s => MEDIUM_SIGNALS.has(s))) return 'MEDIUM';
  if (signals.some(s => LOW_SIGNALS.has(s))) return 'LOW';
  if (signals.every(s => COSMETIC_SIGNALS.has(s))) return 'COSMETIC';

  // Fallback: INSERT/DELETE of interface-affecting nodes is MEDIUM; others are LOW
  if (node.changeType === 'INSERT' || node.changeType === 'DELETE' || node.changeType === 'REWRITE') {
    const interfaceTypes = new Set([
      'export_statement', 'import_statement', 'import_declaration',
    ]);
    if (interfaceTypes.has(node.nodeType)) return 'MEDIUM';
    return 'LOW';
  }

  return 'UNKNOWN';
}

// ---------------------------------------------------------------------------
// Context extraction
// ---------------------------------------------------------------------------

interface NodeContext {
  functionName: string | null;
  className: string | null;
}

function extractContext(nodeId: string, afterTree: CSTNode): NodeContext {
  // Walk the after tree to find the node by ID, tracking enclosing function/class
  const result = findNodeById(nodeId, afterTree, null, null);
  return {
    functionName: result?.functionName ?? null,
    className: result?.className ?? null,
  };
}

interface FindResult {
  functionName: string | null;
  className: string | null;
}

function findNodeById(
  targetId: string,
  node: CSTNode,
  currentFunction: string | null,
  currentClass: string | null
): FindResult | null {
  // Update context based on this node type
  let fn = currentFunction;
  let cls = currentClass;

  if (node.nodeType === 'function_declaration' || node.nodeType === 'method_definition') {
    // Extract function name from first named child with type "identifier"
    const nameChild = node.children.find(
      c => c.nodeType === 'identifier' || c.nodeType === 'property_identifier'
    );
    if (nameChild) fn = nameChild.ownText;
  }

  if (node.nodeType === 'class_declaration') {
    const nameChild = node.children.find(c => c.nodeType === 'identifier');
    if (nameChild) cls = nameChild.ownText;
  }

  if (node.id === targetId) {
    return { functionName: fn, className: cls };
  }

  for (const child of node.children) {
    const found = findNodeById(targetId, child, fn, cls);
    if (found) return found;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Human label construction
// ---------------------------------------------------------------------------

function buildHumanLabel(
  node: DiffNode,
  signals: RiskSignal[],
  riskLevel: RiskLevel
): string {
  const changeDesc = describeChange(node.changeType, node.nodeType);
  const signalDesc = signals
    .filter(s => s !== 'unknown_signal')
    .map(describeSignal)
    .filter(Boolean)
    .join(', ');

  if (signalDesc) {
    return `${changeDesc}: ${signalDesc}`;
  }
  return changeDesc;
}

function describeChange(changeType: string, nodeType: string): string {
  const readableType = nodeType.replace(/_/g, ' ');
  switch (changeType) {
    case 'INSERT':   return `Inserted ${readableType}`;
    case 'DELETE':   return `Deleted ${readableType}`;
    case 'UPDATE':   return `Modified ${readableType}`;
    case 'MOVE':     return `Moved ${readableType}`;
    case 'COSMETIC': return `Cosmetic change in ${readableType}`;
    case 'REWRITE':  return `Rewrote ${readableType}`;
    case 'UNKNOWN':  return `Unknown change in ${readableType}`;
    default:         return `Changed ${readableType}`;
  }
}

function describeSignal(signal: RiskSignal): string {
  const labels: Record<RiskSignal, string> = {
    control_flow_condition_changed: 'control-flow condition changed',
    control_flow_branch_removed:    'control-flow branch removed',
    loop_condition_changed:         'loop condition changed',
    early_return_removed:           'early return removed',
    return_value_changed:           'return value changed',
    throw_removed:                  'throw statement removed',
    catch_removed:                  'catch clause removed',
    async_modifier_removed:         'async modifier removed',
    await_expression_removed:       'await expression removed',
    parameter_added:                'parameter added',
    parameter_removed:              'parameter removed',
    export_added:                   'symbol exported',
    export_removed:                 'export removed',
    assignment_value_changed:       'assignment value changed',
    variable_declarator_changed:    'variable initializer changed',
    whitespace_only:                'whitespace/formatting only',
    comment_only:                   'comment changed',
    identifier_renamed:             'identifier renamed',
    contains_parse_error:           'parse error present',
    unknown_signal:                 '',
  };
  return labels[signal] ?? signal;
}

// ---------------------------------------------------------------------------
// Summary helpers
// ---------------------------------------------------------------------------

export function summarizeRiskMap(riskMap: RiskMap): {
  high: number; medium: number; low: number; cosmetic: number; unknown: number;
} {
  const s = { high: 0, medium: 0, low: 0, cosmetic: 0, unknown: 0 };
  for (const entry of riskMap) {
    switch (entry.riskLevel) {
      case 'HIGH':     s.high++;     break;
      case 'MEDIUM':   s.medium++;   break;
      case 'LOW':      s.low++;      break;
      case 'COSMETIC': s.cosmetic++; break;
      case 'UNKNOWN':  s.unknown++;  break;
    }
  }
  return s;
}
