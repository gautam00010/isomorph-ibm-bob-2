/**
 * Change Proof Schema — Final Verification Artifact
 *
 * Implements the ChangeProof schema specified in DEEP_ARCHITECTURE.md.
 * This is a versioned, content-hashed, deterministic JSON document.
 */

import type { ClassificationEntry, RiskSummary } from '@isomorph/engine';
import type { AIAnnotation } from '@isomorph/bob';
import type { EvidenceRecord } from '@isomorph/evidence';

export interface ChangeProof {
  /** Schema version */
  proofVersion: '1.0';
  /** SHA-256 of canonical JSON representation of all fields below */
  proofHash: string;
  /** ISO 8601 generation timestamp */
  generatedAt: string;

  /** Input digest hashes for reproducibility */
  inputDigest: {
    beforeHash: string;
    afterHash: string;
    language: 'javascript' | 'typescript';
  };

  /** Layer 1: parse statistics */
  parseSummary: {
    beforeNodeCount: number;
    afterNodeCount: number;
    parseErrorNodes: number;
  };

  /** Layer 2: structural diff counts */
  structuralSummary: {
    totalDiffNodes: number;
    byChangeType: Record<string, number>;
    textualLinesChanged: number;
  };

  /** Layer 3: full risk classification map */
  riskMap: ClassificationEntry[];
  riskSummary: RiskSummary;

  /** Layer 4: IBM Bob annotations */
  aiAnnotations: AIAnnotation[] | null;
  aiAnnotationsCached: boolean;

  /** Layer 5: behavioral evidence from executed test stubs */
  evidenceRecord: EvidenceRecord | null;

  /** Affected symbols extracted from risk map */
  affectedSymbols: {
    functions: string[];
    classes: string[];
    exports: string[];
  };

  /** Explicit uncertainty flags and scope limitations */
  uncertaintyFlags: string[];

  /** Engine and model provenance */
  provenance: {
    engineVersion: string;
    bobModel: string | null;
    promptVersion: string | null;
    runnerVersion: string;
  };
}
