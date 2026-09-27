import { z } from 'zod';
import type { StructuralAnalysisResult, StructuralDiff, ClassificationEntry, RiskSummary } from '@isomorph/engine';
import type { AIAnnotation } from '@isomorph/bob';
import type { EvidenceRecord } from '@isomorph/evidence';
import type { ChangeProof } from '@isomorph/proof';

export const AnalyzeRequestSchema = z.object({
  beforeSource: z.string().optional(),
  afterSource: z.string().optional(),
  before: z.string().optional(),
  after: z.string().optional(),
  scenario: z.string().optional(),
  demoScenario: z.string().optional(),
  options: z.object({
    skipEvidence: z.boolean().optional(),
    timeoutMs: z.number().int().positive().optional(),
    generatedAt: z.string().optional(),
    textualLinesAdded: z.number().optional(),
    textualLinesRemoved: z.number().optional(),
  }).optional(),
}).refine(
  (data) => {
    const hasBefore = Boolean(data.beforeSource || data.before || data.scenario || data.demoScenario);
    const hasAfter = Boolean(data.afterSource || data.after || data.scenario || data.demoScenario);
    return hasBefore && hasAfter;
  },
  {
    message: "Either 'beforeSource' and 'afterSource' must be provided, or a recognized 'demoScenario' must be specified.",
    path: ['beforeSource'],
  }
);

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

export interface AnalyzeResponse {
  /** Layer 2: Deterministic structural diff analysis */
  structuralAnalysis: StructuralDiff;
  /** Layer 3: Risk classification map and summary */
  riskAnalysis: {
    riskMap: ClassificationEntry[];
    riskSummary: RiskSummary;
  };
  /** Layer 4: IBM Bob AI reasoning annotations */
  bobAnnotations: AIAnnotation[];
  /** Layer 5: Behavioral evidence execution record */
  behavioralEvidence: EvidenceRecord | null;
  /** Layer 6: Auditable, reproducible Change Proof */
  changeProof: ChangeProof;

  // Pipeline result compatibility fields:
  analysis: StructuralAnalysisResult;
  annotations: AIAnnotation[];
  evidenceRecord: EvidenceRecord | null;
}

export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
  timestamp: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: unknown;
}
