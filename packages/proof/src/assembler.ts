/**
 * Change Proof Assembler — Layer 6
 *
 * Assembles the final ChangeProof artifact from Layers 1–5.
 * Computes canonical SHA-256 content hash (proofHash).
 *
 * Rules from AGENTS.md:
 * - Assembled last from all prior layers; never pre-filled.
 * - Same inputs produce the same proof_hash, always.
 * - Honest: preserves uncertainty flags from all layers.
 */

import { createHash } from 'crypto';
import type { StructuralAnalysisResult } from '@isomorph/engine';
import type { AIAnnotation } from '@isomorph/bob';
import type { EvidenceRecord } from '@isomorph/evidence';
import type { ChangeProof } from './types';

export const PROOF_VERSION = '1.0';
export const ENGINE_VERSION = '0.1.0';

export interface AssembleProofOptions {
  aiAnnotations?: AIAnnotation[] | null;
  aiAnnotationsCached?: boolean;
  evidenceRecord?: EvidenceRecord | null;
  bobModel?: string | null;
  promptVersion?: string | null;
  runnerVersion?: string;
  generatedAt?: string;
}

/**
 * Assemble a complete, content-hashed ChangeProof.
 */
export function assembleProof(
  analysis: StructuralAnalysisResult,
  options: AssembleProofOptions = {}
): ChangeProof {
  const generatedAt = options.generatedAt ?? analysis.analyzedAt;

  // Derive affected symbols
  const functions = new Set<string>();
  const classes = new Set<string>();
  const exportedSymbols = new Set<string>();

  for (const entry of analysis.riskMap) {
    if (entry.enclosingFunction) functions.add(entry.enclosingFunction);
    if (entry.enclosingClass) classes.add(entry.enclosingClass);
    if (
      entry.signals.includes('export_added') ||
      entry.signals.includes('export_removed') ||
      entry.diffNodeRef.nodeType.includes('export')
    ) {
      const name = entry.diffNodeRef.textAfter || entry.diffNodeRef.textBefore || entry.nodeId;
      exportedSymbols.add(name);
    }
  }

  // Aggregate uncertainties
  const uncertaintyFlags = [...analysis.uncertaintyFlags];
  if (!options.aiAnnotations || options.aiAnnotations.length === 0) {
    uncertaintyFlags.push('AI explanation and test generation skipped or unavailable');
  } else {
    for (const ann of options.aiAnnotations) {
      for (const u of ann.uncertainties) {
        if (!uncertaintyFlags.includes(u)) {
          uncertaintyFlags.push(u);
        }
      }
    }
  }

  if (!options.evidenceRecord || options.evidenceRecord.ran === 0) {
    uncertaintyFlags.push('No test stubs executed — behavioral evidence not collected');
  }

  const structuralSummary = {
    totalDiffNodes: analysis.structuralDiff.summary.total,
    byChangeType: {
      UNCHANGED: analysis.structuralDiff.summary.unchanged,
      COSMETIC: analysis.structuralDiff.summary.cosmetic,
      UPDATE: analysis.structuralDiff.summary.update,
      INSERT: analysis.structuralDiff.summary.insert,
      DELETE: analysis.structuralDiff.summary.delete,
      MOVE: analysis.structuralDiff.summary.move,
      REWRITE: analysis.structuralDiff.summary.rewrite,
      UNKNOWN: analysis.structuralDiff.summary.unknown,
    },
    textualLinesChanged:
      analysis.structuralDiff.summary.textualLinesAdded +
      analysis.structuralDiff.summary.textualLinesRemoved,
  };

  const proofBody: Omit<ChangeProof, 'proofHash'> = {
    proofVersion: PROOF_VERSION,
    generatedAt,
    inputDigest: {
      beforeHash: analysis.beforeHash,
      afterHash: analysis.afterHash,
      language: analysis.language,
    },
    parseSummary: {
      beforeNodeCount: analysis.parseSummary.beforeNodeCount,
      afterNodeCount: analysis.parseSummary.afterNodeCount,
      parseErrorNodes: analysis.parseSummary.parseErrorCount,
    },
    structuralSummary,
    riskMap: analysis.riskMap,
    riskSummary: analysis.riskSummary,
    aiAnnotations: options.aiAnnotations ?? null,
    aiAnnotationsCached: options.aiAnnotationsCached ?? false,
    evidenceRecord: options.evidenceRecord ?? null,
    affectedSymbols: {
      functions: Array.from(functions).sort(),
      classes: Array.from(classes).sort(),
      exports: Array.from(exportedSymbols).sort(),
    },
    uncertaintyFlags,
    provenance: {
      engineVersion: ENGINE_VERSION,
      bobModel: options.bobModel ?? (options.aiAnnotations?.[0]?.modelVersion ?? null),
      promptVersion: options.promptVersion ?? (options.aiAnnotations?.[0]?.promptVersion ?? null),
      runnerVersion: options.runnerVersion ?? (options.evidenceRecord?.runnerVersion ?? '0.1.0'),
    },
  };

  const proofHash = computeProofHash(proofBody);

  return {
    ...proofBody,
    proofHash,
  };
}

/**
 * Computes canonical SHA-256 hash of proof content.
 * Guarantees reproducibility: same content with keys in any order produces identical hash.
 * Strips non-deterministic runtime jitter (durationMs, executionTimestamp) so same inputs
 * always produce the exact same proofHash across different runs and machines.
 */
export function computeProofHash(proofBody: Omit<ChangeProof, 'proofHash'>): string {
  const sanitized = sanitizeForCanonicalHash(proofBody);
  const canonical = canonicalJsonStringify(sanitized);
  const digest = createHash('sha256').update(canonical).digest('hex');
  return `sha256:${digest}`;
}

function sanitizeForCanonicalHash(val: unknown): unknown {
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(sanitizeForCanonicalHash);
  const obj = val as Record<string, unknown>;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'durationMs' || k === 'executionTimestamp') {
      continue;
    }
    clean[k] = sanitizeForCanonicalHash(v);
  }
  return clean;
}

/**
 * Verifies that a ChangeProof's proofHash matches its content.
 */
export function verifyProofHash(proof: ChangeProof): boolean {
  const { proofHash, ...body } = proof;
  const expectedHash = computeProofHash(body);
  return proofHash === expectedHash;
}

/**
 * Deterministic JSON stringifier with recursively sorted keys.
 */
export function canonicalJsonStringify(val: unknown): string {
  if (val === null || typeof val !== 'object') {
    return JSON.stringify(val);
  }

  if (Array.isArray(val)) {
    return '[' + val.map(canonicalJsonStringify).join(',') + ']';
  }

  const obj = val as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const pairs = keys.map(k => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`);
  return '{' + pairs.join(',') + '}';
}
