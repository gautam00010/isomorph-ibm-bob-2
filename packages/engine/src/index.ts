/**
 * @isomorph/engine — Public API
 *
 * Exports the deterministic structural analysis engine (Layers 1–3).
 */

// Main pipeline
export { analyze } from './analyze';
export type { AnalyzeOptions } from './analyze';

// Layer 1
export { parse, ParseError, countNodes, countParseErrors, flattenNodes } from './parser';

// Layer 2
export { diff, DiffError, flattenDiffNodes } from './differ';

// Layer 3
export { classify, summarizeRiskMap } from './classifier';

// Report generation
export { toJSON, toHumanReport, buildEditScript } from './reporter';

// Hash utilities
export { normalizeText, sha256, computeSignatureHash, computeSubtreeHash, hashSource } from './hash';

// Types (re-exported for consumers)
export type {
  SourceRange,
  CSTNode,
  ChangeType,
  DiffNode,
  StructuralDiff,
  DiffSummary,
  RiskLevel,
  RiskSignal,
  ClassificationEntry,
  RiskMap,
  RiskSummary,
  EditOperation,
  StructuralAnalysisResult,
} from './types';
