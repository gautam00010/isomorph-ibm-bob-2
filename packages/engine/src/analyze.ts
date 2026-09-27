/**
 * Main pipeline orchestrator.
 *
 * Coordinates Layers 1–3 to produce a StructuralAnalysisResult.
 * Does NOT call IBM Bob (Layer 4) or the evidence runner (Layer 5).
 *
 * This module is the primary entry point for the deterministic engine.
 */

import { parse, countNodes, countParseErrors } from './parser';
import { diff } from './differ';
import { classify, summarizeRiskMap } from './classifier';
import { buildEditScript } from './reporter';
import { hashSource } from './hash';
import type { StructuralAnalysisResult } from './types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AnalyzeOptions {
  /** Include UNCHANGED and COSMETIC operations in the edit script. Default: false */
  includeUnchanged?: boolean;
  /** Manually set textual line counts (from raw diff tool) */
  textualLinesAdded?: number;
  textualLinesRemoved?: number;
}

/**
 * Run the full deterministic structural analysis pipeline on two JavaScript sources.
 *
 * @param before   - The original source code
 * @param after    - The modified source code
 * @param options  - Optional configuration
 * @returns StructuralAnalysisResult — the complete machine-readable output
 */
export function analyze(
  before: string,
  after: string,
  options: AnalyzeOptions = {}
): StructuralAnalysisResult {
  const uncertaintyFlags: string[] = [];

  // Layer 1 — Parse
  const beforeTree = parse(before);
  const afterTree = parse(after);

  const beforeNodeCount = countNodes(beforeTree);
  const afterNodeCount = countNodes(afterTree);
  const parseErrorCount = countParseErrors(beforeTree) + countParseErrors(afterTree);

  if (parseErrorCount > 0) {
    uncertaintyFlags.push(
      `${parseErrorCount} parse error node(s) detected — affected regions classified UNKNOWN`
    );
  }

  // Layer 2 — Structural diff
  const structuralDiff = diff(beforeTree, afterTree);

  if (options.textualLinesAdded !== undefined) {
    structuralDiff.summary.textualLinesAdded = options.textualLinesAdded;
  }
  if (options.textualLinesRemoved !== undefined) {
    structuralDiff.summary.textualLinesRemoved = options.textualLinesRemoved;
  }

  // Move detection limitation
  if (beforeNodeCount > 2000 || afterNodeCount > 2000) {
    uncertaintyFlags.push(
      'Move detection limited: file exceeds 2000 nodes — some moved declarations may appear as INSERT+DELETE'
    );
  }

  // Layer 3 — Risk classification
  const riskMap = classify(structuralDiff, afterTree);
  const riskSummary = summarizeRiskMap(riskMap);

  // Build flat edit script
  const fullEditScript = buildEditScript(riskMap);
  const editScript = options.includeUnchanged
    ? fullEditScript
    : fullEditScript.filter(op => op.operation !== 'UNCHANGED');

  // Aggregate uncertainty flags from classification
  if (structuralDiff.summary.unknown > 0) {
    uncertaintyFlags.push(
      `${structuralDiff.summary.unknown} node(s) could not be structurally classified`
    );
  }

  // Note inherent limitations
  uncertaintyFlags.push(
    'Callee behavior not analyzed — single-file scope only',
    'Dynamic dispatch and prototype mutation not detected',
    'Semantic equivalence is NOT claimed — structural analysis only'
  );

  return {
    analyzedAt: new Date().toISOString(),
    beforeHash: hashSource(before),
    afterHash: hashSource(after),
    language: 'javascript',
    parseSummary: {
      beforeNodeCount,
      afterNodeCount,
      parseErrorCount,
    },
    structuralDiff,
    riskMap,
    riskSummary,
    editScript,
    uncertaintyFlags,
  };
}
