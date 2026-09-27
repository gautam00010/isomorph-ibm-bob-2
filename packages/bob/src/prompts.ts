/**
 * Prompt Templates — Layer 4 AI Reasoning
 *
 * Versioned prompt templates for all Bob calls.
 * No ad-hoc prompt construction outside this module.
 *
 * All templates version-prefixed (v1/). Version is recorded in AIAnnotation.
 */

import type { BobInput, PromptKey } from './types';

export const PROMPT_VERSION = 'v1';

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

export type RenderedPrompt = {
  promptVersion: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
};

/**
 * Render a prompt template with the given BobInput.
 * Returns the versioned prompt key and the rendered messages array.
 */
export function renderPrompt(key: PromptKey, input: BobInput): RenderedPrompt {
  switch (key) {
    case 'v1/explain':
      return renderExplainPrompt(input);
    case 'v1/test_stub':
      return renderTestStubPrompt(input);
    case 'v1/impact':
      return renderImpactPrompt(input);
  }
}

// ---------------------------------------------------------------------------
// Template: v1/explain
// ---------------------------------------------------------------------------

function renderExplainPrompt(input: BobInput): RenderedPrompt {
  const system = `You are analyzing a specific code change detected by Isomorph's structural diff engine. \
You receive structured evidence from a deterministic parser. You do not see the full source file. \
You must not speculate about code not shown. You must not claim behavior is preserved or broken \
unless the change shown directly implies it. Surface uncertainty explicitly.`;

  const user = `The following change was found in: ${input.enclosingContext}
Change type: ${input.changeType}
Risk level (deterministic): ${input.riskLevel}
Risk signals (deterministic): ${input.signals.join(', ')}

BEFORE (changed region only):
${input.textBefore ?? '(not available)'}

AFTER (changed region only):
${input.textAfter ?? '(not available)'}

Based solely on what is shown above, respond with a JSON object with these exact fields:
{
  "explanation": "<what structurally changed in one sentence>",
  "businessImpact": "<which business behavior could be affected in one sentence>",
  "testStubs": ["<one focused Jest test targeting this specific change>"],
  "uncertainties": ["<what cannot be determined from this evidence alone>"],
  "evidenceReferences": ["${input.nodeId}"],
  "confidence": "<high|medium|low>"
}

Do not add any text outside the JSON object.`;

  return {
    promptVersion: `${PROMPT_VERSION}/explain`,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
}

// ---------------------------------------------------------------------------
// Template: v1/test_stub
// ---------------------------------------------------------------------------

function renderTestStubPrompt(input: BobInput): RenderedPrompt {
  const system = `You are generating a focused unit test for a specific code change detected by a \
structural diff engine. Generate only syntactically valid TypeScript/Jest code. \
No explanation. No markdown fences. Just the test code.`;

  const user = `A structural diff engine detected a ${input.riskLevel} risk change in: ${input.enclosingContext}
Signals: ${input.signals.join(', ')}

BEFORE signature: ${input.functionSignatureBefore ?? '(not available)'}
AFTER signature: ${input.functionSignatureAfter ?? '(not available)'}

CHANGED region (after):
${input.textAfter ?? '(not available)'}

Generate one focused Jest test that:
- Imports only from the module under test (use a placeholder path like './module-under-test')
- Targets the exact behavior indicated by the risk signals above
- Includes an assertion that would FAIL if the change introduces a bug
- Is syntactically valid TypeScript/JavaScript

Return only the test code. No explanation. No markdown.`;

  return {
    promptVersion: `${PROMPT_VERSION}/test_stub`,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
}

// ---------------------------------------------------------------------------
// Template: v1/impact
// ---------------------------------------------------------------------------

function renderImpactPrompt(input: BobInput): RenderedPrompt {
  const system = `You are assessing the impact of interface-level code changes detected by a \
structural diff engine. Ground every item in specific evidence shown. \
Do not invent file paths or symbol names not shown in the input.`;

  const user = `A structural diff detected interface-level changes in: ${input.enclosingContext}
Change type: ${input.changeType}
Signals: ${input.signals.join(', ')}

BEFORE:
${input.textBefore ?? '(not available)'}

AFTER:
${input.textAfter ?? '(not available)'}

Respond with a JSON object with these exact fields:
{
  "explanation": "<what interface aspect changed>",
  "businessImpact": "<which callers or downstream modules may be affected>",
  "testStubs": [],
  "uncertainties": ["<what cannot be determined without the full codebase>"],
  "evidenceReferences": ["${input.nodeId}"],
  "confidence": "<high|medium|low>"
}

Do not add any text outside the JSON object.`;

  return {
    promptVersion: `${PROMPT_VERSION}/impact`,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
}
