/**
 * @isomorph/engine — Shared Types
 *
 * These are the canonical intermediate representations for all five pipeline layers.
 * Every field is traceable to a specific layer and a specific deterministic operation.
 * No field is inferred, fabricated, or AI-generated.
 */

// ---------------------------------------------------------------------------
// Layer 1 — Parse
// ---------------------------------------------------------------------------

export interface SourceRange {
  /** 0-based byte offset in the source string */
  startIndex: number;
  endIndex: number;
  /** 1-based line numbers */
  startLine: number;
  endLine: number;
  /** 0-based column offsets */
  startColumn: number;
  endColumn: number;
}

/**
 * Canonical node in the concrete syntax tree.
 *
 * Two hashes serve distinct purposes:
 *
 * - `signatureHash`: SHA-256 of `nodeType + fieldName + normalizedOwnText`.
 *   Stable across whitespace/comment changes to this node's own text.
 *   Used for node identity during matching.
 *
 * - `subtreeHash`: SHA-256 of the full subtree (all descendant normalized text).
 *   Two nodes with identical `subtreeHash` are structurally identical.
 *   Guaranteed by SHA-256 collision resistance.
 *   UNCHANGED classification is based on this hash.
 */
export interface CSTNode {
  /** Stable path identifier: e.g. "function_declaration[0]/block_statement[0]/return_statement[0]" */
  id: string;
  /** Tree-sitter node type (e.g. "function_declaration", "if_statement") */
  nodeType: string;
  /** Tree-sitter field name within parent (e.g. "condition", "body", "left") */
  fieldName: string | null;
  /** Whether this is a named node (tree-sitter named vs anonymous) */
  isNamed: boolean;
  /** Node's own text (not including children's text). Normalized. */
  ownText: string;
  /** SHA-256 of nodeType + fieldName + normalizedOwnText */
  signatureHash: string;
  /** SHA-256 of full subtree normalized text */
  subtreeHash: string;
  /** Source location in the original file */
  range: SourceRange;
  /** Ordered child nodes */
  children: CSTNode[];
  /** True if tree-sitter produced an ERROR node anywhere in this subtree */
  hasParseError: boolean;
}

// ---------------------------------------------------------------------------
// Layer 2 — Structural Diff
// ---------------------------------------------------------------------------

export type ChangeType =
  | 'UNCHANGED'   // subtreeHash identical — subtree not traversed further
  | 'COSMETIC'    // signatureHash identical; only whitespace/comment descendants differ
  | 'UPDATE'      // same node position; different subtreeHash; same nodeType
  | 'INSERT'      // node present in after; absent at this position in before
  | 'DELETE'      // node present in before; absent at this position in after
  | 'MOVE'        // subtreeHash present in both trees at different stable IDs
  | 'REWRITE'     // large subtree replaced with structurally dissimilar content
  | 'UNKNOWN';    // contains ERROR nodes or cannot be classified

export interface DiffNode {
  /** Stable ID — based on after tree path for INSERT/UPDATE/MOVE/UNCHANGED, before tree path for DELETE */
  nodeId: string;
  changeType: ChangeType;
  nodeType: string;
  fieldName: string | null;

  /** Hashes of the before/after state (undefined if node did not exist in that version) */
  beforeHash?: string;
  afterHash?: string;

  /** Source ranges in the respective versions */
  beforeRange?: SourceRange;
  afterRange?: SourceRange;

  /** Human-readable text of the changed region (normalized, max 500 chars) */
  textBefore?: string;
  textAfter?: string;

  /** For MOVE: the nodeId this node moved FROM */
  movedFrom?: string;

  /** For UPDATE/REWRITE/COSMETIC: child-level diff */
  children: DiffNode[];

  /** Depth in the diff tree (root = 0) */
  depth: number;
}

/** The complete edit script for a before→after transformation */
export interface StructuralDiff {
  /** All diff nodes (flat list for easy iteration; tree structure via children) */
  nodes: DiffNode[];
  /** Root-level diff nodes only */
  rootNodes: DiffNode[];
  /** Summary counts */
  summary: DiffSummary;
}

export interface DiffSummary {
  total: number;
  unchanged: number;
  cosmetic: number;
  update: number;
  insert: number;
  delete: number;
  move: number;
  rewrite: number;
  unknown: number;
  /** Raw textual line count change (for reference only — not structural) */
  textualLinesAdded: number;
  textualLinesRemoved: number;
}

// ---------------------------------------------------------------------------
// Layer 3 — Classification
// ---------------------------------------------------------------------------

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'COSMETIC' | 'UNKNOWN';

/**
 * Named risk signals — each maps to a specific CST node type pattern.
 * This list is exhaustive for the MVP. Unknown patterns produce UNKNOWN signal.
 */
export type RiskSignal =
  // --- Control flow (HIGH) ---
  | 'control_flow_condition_changed'    // if/switch/ternary condition modified
  | 'control_flow_branch_removed'       // entire if/else branch deleted
  | 'loop_condition_changed'            // for/while/do-while condition modified
  | 'early_return_removed'              // return removed from non-terminal position
  | 'return_value_changed'              // return expression modified in a function
  | 'throw_removed'                     // throw statement deleted
  | 'catch_removed'                     // catch clause deleted
  // --- Async / side-effect (HIGH/MEDIUM) ---
  | 'async_modifier_removed'            // async keyword removed
  | 'await_expression_removed'          // await expression removed
  // --- Interface (MEDIUM) ---
  | 'parameter_added'                   // function gains a parameter
  | 'parameter_removed'                 // function loses a parameter
  | 'export_added'                      // symbol becomes exported
  | 'export_removed'                    // symbol stops being exported
  // --- Data flow (MEDIUM/LOW) ---
  | 'assignment_value_changed'          // RHS of assignment changed
  | 'variable_declarator_changed'       // variable initializer changed
  // --- Cosmetic (COSMETIC) ---
  | 'whitespace_only'
  | 'comment_only'
  | 'identifier_renamed'                // identifier renamed, no logic change detected
  // --- Meta ---
  | 'contains_parse_error'
  | 'unknown_signal';

export interface ClassificationEntry {
  /** nodeId from DiffNode */
  nodeId: string;
  riskLevel: RiskLevel;
  signals: RiskSignal[];
  /** Human-readable description of what changed */
  humanLabel: string;
  /** Enclosing function name, if determinable */
  enclosingFunction: string | null;
  /** Enclosing class name, if determinable */
  enclosingClass: string | null;
  /** The DiffNode this entry classifies */
  diffNodeRef: DiffNode;
}

export type RiskMap = ClassificationEntry[];

export interface RiskSummary {
  high: number;
  medium: number;
  low: number;
  cosmetic: number;
  unknown: number;
}

// ---------------------------------------------------------------------------
// Output — EditScript and Report
// ---------------------------------------------------------------------------

/**
 * A single operation in the human-readable edit script.
 * Maps directly to a DiffNode.
 */
export interface EditOperation {
  operation: 'INSERT' | 'DELETE' | 'UPDATE' | 'MOVE' | 'COSMETIC' | 'UNCHANGED';
  nodeId: string;
  nodeType: string;
  description: string;
  riskLevel: RiskLevel;
  signals: RiskSignal[];
  beforeRange?: SourceRange;
  afterRange?: SourceRange;
  textBefore?: string;
  textAfter?: string;
  movedFrom?: string;
}

/** The machine-readable JSON output */
export interface StructuralAnalysisResult {
  /** ISO 8601 timestamp */
  analyzedAt: string;
  /** SHA-256 of before source */
  beforeHash: string;
  /** SHA-256 of after source */
  afterHash: string;
  language: 'javascript';
  /** Layer 1 */
  parseSummary: {
    beforeNodeCount: number;
    afterNodeCount: number;
    parseErrorCount: number;
  };
  /** Layer 2 */
  structuralDiff: StructuralDiff;
  /** Layer 3 */
  riskMap: RiskMap;
  riskSummary: RiskSummary;
  /** Flat edit script (Layer 2 + Layer 3 combined) */
  editScript: EditOperation[];
  /** Explicit limitations detected during this analysis */
  uncertaintyFlags: string[];
}
