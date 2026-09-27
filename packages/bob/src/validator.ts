/**
 * AIAnnotation Validator — Layer 4
 *
 * Validates and sanitizes raw Bob API responses.
 * Invalid fields are replaced with null/empty — never thrown.
 * All node ID references are verified against the StructuralDiff.
 *
 * Rule: Bob output is NEVER passed directly to UI or proof assembly.
 * It ALWAYS goes through this validator first.
 */

import type { AIAnnotation, RawBobResponse } from './types';
import type { StructuralDiff } from '@isomorph/engine';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXPLANATION_MIN_LEN = 20;
const EXPLANATION_MAX_LEN = 500;
const MAX_STUBS = 5;
const MAX_STUB_SIZE = 50 * 1024; // 50 KB

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a raw Bob response for a single nodeId.
 * All schema violations are handled gracefully — no throws.
 *
 * @param nodeId       - The nodeId this annotation is for
 * @param raw          - The raw parsed JSON from Bob
 * @param structDiff   - The StructuralDiff (used to validate evidenceReferences)
 * @param modelVersion - The Bob model version used
 * @param promptVersion - The prompt template version used
 */
export function validateAIAnnotation(
  nodeId: string,
  raw: unknown,
  structDiff: StructuralDiff,
  modelVersion: string,
  promptVersion: string
): AIAnnotation {
  // Build a set of valid node IDs for reference validation
  const validNodeIds = new Set(structDiff.nodes.map(n => n.nodeId));

  const obj = isObject(raw) ? (raw as RawBobResponse) : {};

  const explanation = validateExplanation(obj.explanation);
  const businessImpact = validateBusinessImpact(obj.businessImpact);
  const testStubs = validateTestStubs(obj.testStubs);
  const uncertainties = validateStringArray(obj.uncertainties, 'uncertainties');
  const evidenceReferences = validateEvidenceReferences(obj.evidenceReferences, validNodeIds, nodeId);
  const confidence = validateConfidence(obj.confidence);

  return {
    nodeId,
    explanation,
    businessImpact,
    testStubs,
    uncertainties,
    evidenceReferences,
    confidence,
    modelVersion,
    promptVersion,
  };
}

/**
 * Create a fallback AIAnnotation when Bob fails.
 * Records the failure reason in uncertainties. Never throws.
 */
export function makeFallbackAnnotation(
  nodeId: string,
  reason: string,
  modelVersion: string,
  promptVersion: string
): AIAnnotation {
  return {
    nodeId,
    explanation: null,
    businessImpact: null,
    testStubs: [],
    uncertainties: [reason],
    evidenceReferences: [nodeId],
    confidence: 'low',
    modelVersion,
    promptVersion,
  };
}

// ---------------------------------------------------------------------------
// Field validators
// ---------------------------------------------------------------------------

function validateExplanation(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length < EXPLANATION_MIN_LEN || trimmed.length > EXPLANATION_MAX_LEN) return null;
  return trimmed;
}

function validateBusinessImpact(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length < 10 || trimmed.length > 500) return null;
  return trimmed;
}

function validateTestStubs(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const stubs: string[] = [];
  for (const item of raw.slice(0, MAX_STUBS)) {
    if (typeof item !== 'string') continue;
    if (item.length > MAX_STUB_SIZE) continue; // too large
    const trimmed = item.trim();
    if (trimmed.length === 0) continue;
    if (looksLikeCode(trimmed)) {
      stubs.push(trimmed);
    }
  }
  return stubs;
}

function validateStringArray(raw: unknown, _fieldName: string): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === 'string')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .slice(0, 20); // cap at 20 items
}

function validateEvidenceReferences(
  raw: unknown,
  validNodeIds: Set<string>,
  fallbackNodeId: string
): string[] {
  if (!Array.isArray(raw)) return [fallbackNodeId];
  const refs = raw
    .filter((item): item is string => typeof item === 'string')
    .filter(id => validNodeIds.has(id));
  // Always include the requesting nodeId if it's valid
  if (!refs.includes(fallbackNodeId) && validNodeIds.has(fallbackNodeId)) {
    refs.unshift(fallbackNodeId);
  }
  return refs.length > 0 ? refs : [fallbackNodeId];
}

function validateConfidence(raw: unknown): 'high' | 'medium' | 'low' {
  if (raw === 'high' || raw === 'medium' || raw === 'low') return raw;
  return 'low';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/**
 * Heuristic check that a string looks like code (not prose/noise).
 * We check for at least one of: import, describe, test, it, expect, function, const, let.
 */
function looksLikeCode(stub: string): boolean {
  return /\b(import|describe|test|it|expect|function|const|let|var|return)\b/.test(stub);
}
