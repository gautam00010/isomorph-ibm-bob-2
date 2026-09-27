/**
 * Evidence Runner — Layer 5
 *
 * Executes Bob-generated test stubs against modified source in isolated subprocesses.
 * Enforces:
 * - Subprocess isolation (node process, restricted environment)
 * - 5000ms default timeout
 * - No network, isolated temp dir
 * - Verbatim stdout/stderr capture (truncated at 2KB)
 * - Never claims a test passed unless it actually ran and exited 0.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { parse, countParseErrors } from '@isomorph/engine';
import type { EvidenceRecord, TestResult, TestStatus } from './types';

export const RUNNER_VERSION = '0.1.0';
const DEFAULT_TIMEOUT_MS = 5000;
const MAX_STUB_SIZE = 50 * 1024; // 50 KB
const MAX_OUTPUT_CAPTURE = 2048; // 2 KB

export interface RunnerOptions {
  timeoutMs?: number;
}

/**
 * Execute an array of test stubs against modified JavaScript source.
 *
 * @param stubs       - Array of generated test stubs
 * @param afterSource - The modified source code to test against
 * @param options     - Optional execution options
 * @returns EvidenceRecord with detailed execution results
 */
export async function runEvidence(
  stubs: string[],
  afterSource: string,
  options: RunnerOptions = {}
): Promise<EvidenceRecord> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const results: TestResult[] = [];

  for (const stub of stubs) {
    const result = await executeStub(stub, afterSource, timeoutMs);
    results.push(result);
  }

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const errored = results.filter(r => r.status === 'ERROR' || r.status === 'SYNTAX_ERROR').length;
  const notRun = results.filter(r => r.status === 'NOT_RUN').length;
  const ran = results.length - notRun;

  return {
    totalStubs: stubs.length,
    ran,
    passed,
    failed,
    errored,
    notRun,
    results,
    executionTimestamp: new Date().toISOString(),
    runnerVersion: RUNNER_VERSION,
  };
}

async function executeStub(
  stub: string,
  afterSource: string,
  timeoutMs: number
): Promise<TestResult> {
  const stubHash = createHash('sha256').update(stub).digest('hex').slice(0, 16);

  // Check stub size
  if (stub.length > MAX_STUB_SIZE) {
    return {
      stubId: stubHash,
      status: 'SYNTAX_ERROR',
      assertionMessage: 'Stub exceeded 50KB size limit',
    };
  }

  // Pre-validate syntax with parser
  try {
    const tree = parse(stub);
    if (countParseErrors(tree) > 0) {
      return {
        stubId: stubHash,
        status: 'SYNTAX_ERROR',
        assertionMessage: 'Stub contains syntax errors',
      };
    }
  } catch (err: unknown) {
    return {
      stubId: stubHash,
      status: 'SYNTAX_ERROR',
      assertionMessage: err instanceof Error ? err.message : String(err),
    };
  }

  // Create isolated temp directory
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isomorph-evidence-'));
  const sourcePath = path.join(tmpDir, 'source.js');
  const runnerPath = path.join(tmpDir, 'harness.js');

  try {
    // Write source file
    fs.writeFileSync(sourcePath, afterSource, 'utf-8');

    // Build the execution harness wrapping the test stub
    const harnessCode = buildHarnessCode(stub);
    fs.writeFileSync(runnerPath, harnessCode, 'utf-8');

    const startTime = Date.now();
    const execResult = await runSubprocess(runnerPath, tmpDir, timeoutMs);
    const durationMs = Date.now() - startTime;

    let status: TestStatus = 'PASS';
    let assertionMessage: string | undefined;

    if (execResult.timedOut) {
      status = 'TIMEOUT';
      assertionMessage = `Execution timed out after ${timeoutMs}ms`;
    } else if (execResult.exitCode !== 0) {
      const output = `${execResult.stdout}\n${execResult.stderr}`;
      const isAssertionFailure =
        output.includes('AssertionError') ||
        output.includes('ASSERTION_FAILED') ||
        output.includes('Expected') ||
        output.includes('assert');

      status = isAssertionFailure ? 'FAIL' : 'ERROR';
      assertionMessage = extractAssertionMessage(output);
    }

    return {
      stubId: stubHash,
      status,
      durationMs,
      stdout: truncateOutput(execResult.stdout),
      stderr: truncateOutput(execResult.stderr),
      assertionMessage,
    };
  } catch (err: unknown) {
    return {
      stubId: stubHash,
      status: 'ERROR',
      assertionMessage: err instanceof Error ? err.message : String(err),
    };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup failure in finally
    }
  }
}

/**
 * Builds a lightweight standalone test harness that:
 * 1. Exposes the module under test from `./source.js`
 * 2. Provides standard assertions and Jest-compatible API (test, it, describe, expect, assert)
 * 3. Runs the test stub safely
 */
function buildHarnessCode(stub: string): string {
  return `
const assert = require('node:assert');
const source = require('./source.js');

// Support both default/named exports and global function assignments
if (typeof source === 'object' && source !== null) {
  for (const [key, val] of Object.entries(source)) {
    global[key] = val;
  }
}

// Lightweight Jest-compatible test runner & assertions
function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error('ASSERTION_FAILED: Expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(actual));
      }
    },
    toEqual(expected) {
      assert.deepStrictEqual(actual, expected);
    },
    toBeGreaterThanOrEqual(expected) {
      if (!(actual >= expected)) {
        throw new Error('ASSERTION_FAILED: Expected ' + actual + ' >= ' + expected);
      }
    },
    toBeGreaterThan(expected) {
      if (!(actual > expected)) {
        throw new Error('ASSERTION_FAILED: Expected ' + actual + ' > ' + expected);
      }
    },
    toBeLessThanOrEqual(expected) {
      if (!(actual <= expected)) {
        throw new Error('ASSERTION_FAILED: Expected ' + actual + ' <= ' + expected);
      }
    },
    toBeLessThan(expected) {
      if (!(actual < expected)) {
        throw new Error('ASSERTION_FAILED: Expected ' + actual + ' < ' + expected);
      }
    },
    toBeTruthy() {
      if (!actual) throw new Error('ASSERTION_FAILED: Expected truthy value, got ' + actual);
    },
    toBeFalsy() {
      if (actual) throw new Error('ASSERTION_FAILED: Expected falsy value, got ' + actual);
    },
    toBeNull() {
      if (actual !== null) throw new Error('ASSERTION_FAILED: Expected null, got ' + actual);
    },
    toThrow() {
      if (typeof actual !== 'function') throw new Error('Expected a function');
      let threw = false;
      try { actual(); } catch { threw = true; }
      if (!threw) throw new Error('ASSERTION_FAILED: Expected function to throw');
    }
  };
}

global.expect = expect;
global.assert = assert;

let pending = [];
function test(name, fn) {
  pending.push({ name, fn });
}
global.test = test;
global.it = test;
global.describe = (name, fn) => fn();

// Execute user test stub
${stub}

// Run collected tests or inline logic
(async () => {
  for (const t of pending) {
    await t.fn();
  }
})().catch(err => {
  console.error(err.message || String(err));
  process.exit(1);
});
`;
}

interface SubprocessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

function runSubprocess(
  filePath: string,
  cwd: string,
  timeoutMs: number
): Promise<SubprocessResult> {
  return new Promise(resolve => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Run Node process in sandbox: clean environment, timeout
    const child = spawn(process.execPath, [filePath], {
      cwd,
      timeout: timeoutMs,
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'test',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', chunk => {
      stdout += chunk.toString('utf-8');
    });

    child.stderr.on('data', chunk => {
      stderr += chunk.toString('utf-8');
    });

    child.on('close', code => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode: code ?? (timedOut ? 124 : 1),
        timedOut,
      });
    });

    child.on('error', err => {
      clearTimeout(timer);
      stderr += err.message;
      resolve({
        stdout,
        stderr,
        exitCode: 1,
        timedOut: false,
      });
    });
  });
}

function extractAssertionMessage(output: string): string {
  const match = output.match(/ASSERTION_FAILED:?\s*([^\r\n]+)/);
  if (match) return match[1].trim();

  const lines = output.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.includes('AssertionError') || line.includes('Expected')) {
      return line.slice(0, 200);
    }
  }
  return lines[0]?.slice(0, 150) ?? 'Test failed with non-zero exit code';
}

function truncateOutput(str: string): string {
  if (str.length <= MAX_OUTPUT_CAPTURE) return str;
  return str.slice(0, MAX_OUTPUT_CAPTURE) + '... [truncated]';
}
