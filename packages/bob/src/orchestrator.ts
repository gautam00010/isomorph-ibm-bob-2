/**
 * Bob Orchestrator — Layer 4
 *
 * Orchestrates IBM Bob API calls for each HIGH/MEDIUM risk entry.
 * Implements:
 * - Timeout handling (8 seconds per call)
 * - Error recovery (all failures return fallback AIAnnotation)
 * - Structured input (never raw source)
 * - Response validation
 * - Demo mode (cached responses from DEMO_BOB_CACHE_DIR)
 *
 * Rule: Bob never receives raw source files.
 * Rule: Bob output always goes through validateAIAnnotation before use.
 * Rule: Bob failure is a handled state — never a crash.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import type { ClassificationEntry, StructuralDiff } from '@isomorph/engine';
import type { AIAnnotation, BobInput } from './types';
import { renderPrompt } from './prompts';
import { validateAIAnnotation, makeFallbackAnnotation } from './validator';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BOB_TIMEOUT_MS = 8000;
const BOB_MODEL_VERSION = process.env['BOB_MODEL_VERSION'] ?? 'ibm-bob-2.0';
const BOB_API_URL = process.env['BOB_API_URL'] ?? '';
const BOB_API_KEY = process.env['BOB_API_KEY'] ?? '';

function getDemoCacheDir(): string {
  if (process.env['DEMO_BOB_CACHE_DIR']) return process.env['DEMO_BOB_CACHE_DIR'];
  const cwdCache = path.resolve(process.cwd(), 'demo/cached');
  if (fs.existsSync(cwdCache)) return cwdCache;
  const relCache = path.resolve(__dirname, '../../../demo/cached');
  if (fs.existsSync(relCache)) return relCache;
  return '';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface BobOrchestratorResult {
  annotations: AIAnnotation[];
  cached: boolean;
  totalEntries: number;
  annotated: number;
  skipped: number;
}

/**
 * Annotate all HIGH and MEDIUM risk entries with Bob explanations.
 *
 * Only HIGH and MEDIUM entries are sent to Bob (LOW and COSMETIC are not worth the API cost).
 * Returns annotations in the same order as input entries.
 * Never throws — all failures produce fallback annotations.
 */
export async function annotateDiff(
  entries: ClassificationEntry[],
  structDiff: StructuralDiff
): Promise<BobOrchestratorResult> {
  const eligible = entries.filter(
    e => e.riskLevel === 'HIGH' || e.riskLevel === 'MEDIUM'
  );

  const skipped = entries.length - eligible.length;

  if (eligible.length === 0) {
    return { annotations: [], cached: false, totalEntries: entries.length, annotated: 0, skipped };
  }

  // Check demo mode or local cache presence
  const cacheDir = getDemoCacheDir();
  if (cacheDir && (process.env['DEMO_MODE'] === 'true' || !BOB_API_KEY)) {
    const cached = loadCachedAnnotations(eligible, structDiff, cacheDir);
    if (cached && cached.length > 0) {
      return {
        annotations: cached,
        cached: true,
        totalEntries: entries.length,
        annotated: cached.filter(a => a.explanation !== null).length,
        skipped,
      };
    }
  }

  // Check API config
  if (!BOB_API_URL || !BOB_API_KEY) {
    const annotations = eligible.map(entry =>
      makeFallbackAnnotation(
        entry.nodeId,
        'Bob API not configured (BOB_API_URL and BOB_API_KEY required)',
        BOB_MODEL_VERSION,
        'v1/explain'
      )
    );
    return { annotations, cached: false, totalEntries: entries.length, annotated: 0, skipped };
  }

  // Annotate each eligible entry (sequential to respect rate limits)
  const annotations: AIAnnotation[] = [];
  for (const entry of eligible) {
    const annotation = await annotateEntry(entry, structDiff);
    annotations.push(annotation);
  }

  return {
    annotations,
    cached: false,
    totalEntries: entries.length,
    annotated: annotations.filter(a => a.explanation !== null).length,
    skipped,
  };
}

// ---------------------------------------------------------------------------
// Single-entry annotation
// ---------------------------------------------------------------------------

async function annotateEntry(
  entry: ClassificationEntry,
  structDiff: StructuralDiff
): Promise<AIAnnotation> {
  const input = buildBobInput(entry);

  // Use test_stub template for HIGH entries, explain for MEDIUM
  const templateKey = entry.riskLevel === 'HIGH' ? 'v1/explain' : 'v1/explain';
  const rendered = renderPrompt(templateKey, input);

  try {
    const raw = await callBobAPI(rendered.messages, BOB_TIMEOUT_MS);
    return validateAIAnnotation(
      entry.nodeId,
      raw,
      structDiff,
      BOB_MODEL_VERSION,
      rendered.promptVersion
    );
  } catch (err: unknown) {
    const reason = formatError(err);
    return makeFallbackAnnotation(entry.nodeId, reason, BOB_MODEL_VERSION, rendered.promptVersion);
  }
}

// ---------------------------------------------------------------------------
// Bob Input construction
// ---------------------------------------------------------------------------

function buildBobInput(entry: ClassificationEntry): BobInput {
  const ctx = buildContext(entry);
  const textBefore = entry.diffNodeRef.textBefore
    ? truncateTokens(entry.diffNodeRef.textBefore, 250)
    : undefined;
  const textAfter = entry.diffNodeRef.textAfter
    ? truncateTokens(entry.diffNodeRef.textAfter, 250)
    : undefined;

  return {
    nodeId: entry.nodeId,
    nodeType: entry.diffNodeRef.nodeType,
    changeType: entry.diffNodeRef.changeType,
    riskLevel: entry.riskLevel,
    signals: entry.signals,
    enclosingContext: ctx,
    textBefore,
    textAfter,
  };
}

function buildContext(entry: ClassificationEntry): string {
  if (entry.enclosingFunction && entry.enclosingClass) {
    return `${entry.enclosingFunction} in ${entry.enclosingClass}`;
  }
  if (entry.enclosingFunction) return entry.enclosingFunction;
  if (entry.enclosingClass) return entry.enclosingClass;
  return `${entry.diffNodeRef.nodeType} (top-level)`;
}

/**
 * Rough token truncation: 1 token ≈ 4 characters.
 */
function truncateTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + ' [truncated]';
}

// ---------------------------------------------------------------------------
// Bob API HTTP call
// ---------------------------------------------------------------------------

async function callBobAPI(
  messages: Array<{ role: string; content: string }>,
  timeoutMs: number
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: BOB_MODEL_VERSION,
      messages,
      response_format: { type: 'json_object' },
      max_tokens: 800,
    });

    const url = new URL(BOB_API_URL);
    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BOB_API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode !== undefined && (res.statusCode < 200 || res.statusCode >= 300)) {
          reject(new Error(`Bob API error: ${res.statusCode} ${text.slice(0, 200)}`));
          return;
        }
        try {
          const parsed = JSON.parse(text) as Record<string, unknown>;
          // Handle OpenAI-compatible chat completion response
          const content = extractContent(parsed);
          resolve(JSON.parse(content));
        } catch {
          reject(new Error(`Bob response parse failed: ${text.slice(0, 100)}`));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`Bob API connection error: ${err.message}`)));

    // Timeout
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Bob API timeout after ${timeoutMs}ms`));
    });

    req.write(body);
    req.end();
  });
}

function extractContent(apiResponse: Record<string, unknown>): string {
  // OpenAI-compatible response: { choices: [{ message: { content: "..." } }] }
  const choices = apiResponse['choices'];
  if (Array.isArray(choices) && choices.length > 0) {
    const choice = choices[0] as Record<string, unknown>;
    const message = choice['message'] as Record<string, unknown> | undefined;
    if (message && typeof message['content'] === 'string') {
      return message['content'];
    }
  }
  // Direct content response
  if (typeof apiResponse['content'] === 'string') {
    return apiResponse['content'];
  }
  throw new Error('Cannot extract content from Bob API response');
}

// ---------------------------------------------------------------------------
// Demo mode: cached responses
// ---------------------------------------------------------------------------

function loadCachedAnnotations(
  entries: ClassificationEntry[],
  structDiff: StructuralDiff,
  cacheDir: string
): AIAnnotation[] | null {
  try {
    const results: AIAnnotation[] = [];
    const masterCacheFile = path.join(cacheDir, 'bob-annotations.json');
    let masterCache: Record<string, unknown> | null = null;

    if (fs.existsSync(masterCacheFile)) {
      try {
        const content = JSON.parse(fs.readFileSync(masterCacheFile, 'utf-8'));
        if (Array.isArray(content)) {
          masterCache = {};
          for (const item of content) {
            if (item && item.nodeId) {
              masterCache[item.nodeId] = item;
            }
          }
        } else if (typeof content === 'object' && content !== null) {
          masterCache = content as Record<string, unknown>;
        }
      } catch {
        masterCache = null;
      }
    }

    for (const entry of entries) {
      let raw: unknown = null;

      // 1. Check master cache by nodeId
      if (masterCache && masterCache[entry.nodeId]) {
        raw = masterCache[entry.nodeId];
      } else if (masterCache && entry.enclosingFunction && masterCache[entry.enclosingFunction]) {
        raw = masterCache[entry.enclosingFunction];
      }

      // 2. Check individual cache file
      if (!raw) {
        const cacheFile = path.join(cacheDir, `${entry.nodeId.replace(/\//g, '_')}.json`);
        if (fs.existsSync(cacheFile)) {
          raw = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')) as unknown;
        }
      }

      if (!raw) {
        // Fallback for demo if single entry
        const genericFile = path.join(cacheDir, 'calculateDiscount.json');
        if (fs.existsSync(genericFile)) {
          raw = JSON.parse(fs.readFileSync(genericFile, 'utf-8')) as unknown;
        }
      }

      if (raw) {
        const annotation = validateAIAnnotation(
          entry.nodeId,
          raw,
          structDiff,
          BOB_MODEL_VERSION + '+cached',
          'v1/explain'
        );
        results.push(annotation);
      } else {
        results.push(
          makeFallbackAnnotation(
            entry.nodeId,
            'No cached annotation found for node',
            BOB_MODEL_VERSION + '+cached',
            'v1/explain'
          )
        );
      }
    }

    return results;
  } catch {
    return null; // cache miss or corrupted — fall through to live API
  }
}

// ---------------------------------------------------------------------------
// Error formatting
// ---------------------------------------------------------------------------

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return `Unknown error: ${String(err)}`;
}
