/**
 * ISOMORPH Complete End-to-End Pipeline
 *
 * Implements the constitutional pipeline order from AGENTS.md:
 * 1. DETERMINISTIC ENGINE   (parser, structural diff, risk classification)
 * 2. AI REASONING           (IBM Bob explanation, test generation)
 * 3. EXECUTION / EVIDENCE   (subprocess test runner, behavioral verification)
 * 4. ARTIFACT               (Change Proof assembly)
 */

import { analyze, type StructuralAnalysisResult } from '@isomorph/engine';
import { annotateDiff, type AIAnnotation } from '@isomorph/bob';
import { runEvidence, type EvidenceRecord } from '@isomorph/evidence';
import { assembleProof, type ChangeProof } from '@isomorph/proof';

export interface PipelineOptions {
  /** If true, skips test stub execution */
  skipEvidence?: boolean;
  /** Timeout for test stub execution in ms (default: 5000) */
  timeoutMs?: number;
  /** Fixed timestamp for proof generation */
  generatedAt?: string;
  /** Manually set textual lines changed */
  textualLinesAdded?: number;
  textualLinesRemoved?: number;
}

export interface PipelineResult {
  analysis: StructuralAnalysisResult;
  annotations: AIAnnotation[];
  evidenceRecord: EvidenceRecord | null;
  changeProof: ChangeProof;
}

/**
 * Runs the full 6-layer Isomorph verification pipeline.
 *
 * @param beforeSource - Original source code
 * @param afterSource  - Modified source code
 * @param options      - Pipeline execution options
 * @returns Complete PipelineResult containing artifacts from all layers
 */
export async function runIsomorph(
  beforeSource: string,
  afterSource: string,
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  // Layers 1–3: Deterministic Parse, Diff, and Risk Classification
  const analysis = analyze(beforeSource, afterSource, {
    textualLinesAdded: options.textualLinesAdded,
    textualLinesRemoved: options.textualLinesRemoved,
  });

  // Layer 4: AI Reasoning (IBM Bob)
  const bobResult = await annotateDiff(analysis.riskMap, analysis.structuralDiff);

  // Layer 5: Behavioral Evidence Execution
  let evidenceRecord: EvidenceRecord | null = null;
  const testStubs: string[] = [];

  for (const ann of bobResult.annotations) {
    if (ann.testStubs && ann.testStubs.length > 0) {
      testStubs.push(...ann.testStubs);
    }
  }

  if (testStubs.length > 0 && !options.skipEvidence) {
    evidenceRecord = await runEvidence(testStubs, afterSource, {
      timeoutMs: options.timeoutMs,
    });
  }

  // Layer 6: Change Proof Assembly
  const changeProof = assembleProof(analysis, {
    aiAnnotations: bobResult.annotations,
    aiAnnotationsCached: bobResult.cached,
    evidenceRecord,
    generatedAt: options.generatedAt,
  });

  return {
    analysis,
    annotations: bobResult.annotations,
    evidenceRecord,
    changeProof,
  };
}
