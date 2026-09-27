/**
 * Bob Types — Layer 4 AI Reasoning
 *
 * All types crossing the Bob layer boundary.
 * Bob input is structured IR (never raw source files).
 * Bob output is AIAnnotation — validated before use.
 */

import type { ChangeType, RiskLevel, RiskSignal } from '@isomorph/engine';

// ---------------------------------------------------------------------------
// Bob Input
// ---------------------------------------------------------------------------

/**
 * Structured input sent to Bob for a single HIGH/MEDIUM risk entry.
 * Maximum 500 tokens of textBefore + textAfter combined.
 */
export interface BobInput {
  nodeId: string;
  nodeType: string;
  changeType: ChangeType;
  riskLevel: RiskLevel;
  signals: RiskSignal[];
  enclosingContext: string;           // "functionName in className" or just "functionName"
  functionSignatureBefore?: string;   // extracted from CST, not raw source
  functionSignatureAfter?: string;
  textBefore?: string;                // normalized text of changed node (truncated)
  textAfter?: string;                 // normalized text of changed node (truncated)
}

// ---------------------------------------------------------------------------
// Bob Output
// ---------------------------------------------------------------------------

/**
 * Validated AI annotation produced by Bob for a single risk entry.
 * Every field has defined bounds. Invalid values are replaced with null/empty.
 */
export interface AIAnnotation {
  nodeId: string;
  explanation: string | null;         // what changed and why it may matter (20-500 chars or null)
  businessImpact: string | null;      // which business behavior could be affected
  testStubs: string[];                // syntactically valid TS/JS test stubs only
  uncertainties: string[];            // explicit list of what Bob cannot determine
  evidenceReferences: string[];       // nodeIds this annotation is grounded in (validated)
  confidence: 'high' | 'medium' | 'low';
  modelVersion: string;               // recorded for provenance
  promptVersion: string;              // version of the prompt template used
}

/**
 * Raw JSON schema expected from Bob API — validated before converting to AIAnnotation.
 */
export interface RawBobResponse {
  explanation?: unknown;
  businessImpact?: unknown;
  testStubs?: unknown;
  uncertainties?: unknown;
  evidenceReferences?: unknown;
  confidence?: unknown;
}

// ---------------------------------------------------------------------------
// Prompt template key type
// ---------------------------------------------------------------------------

export type PromptKey = 'v1/explain' | 'v1/test_stub' | 'v1/impact';
