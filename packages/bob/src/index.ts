/**
 * @isomorph/bob — Public exports
 *
 * Layer 4: AI Reasoning via IBM Bob.
 * Bob explains structural findings from Layer 3 — it does not produce them.
 */

export type { AIAnnotation, BobInput, PromptKey, RawBobResponse } from './types';
export { annotateDiff } from './orchestrator';
export type { BobOrchestratorResult } from './orchestrator';
export { renderPrompt, PROMPT_VERSION } from './prompts';
export { validateAIAnnotation, makeFallbackAnnotation } from './validator';
