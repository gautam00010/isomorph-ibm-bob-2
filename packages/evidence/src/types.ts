/**
 * Layer 5 — Behavioral Evidence Types
 *
 * Implements the EvidenceRecord and TestResult specifications from DEEP_ARCHITECTURE.md.
 */

export type TestStatus = 'PASS' | 'FAIL' | 'ERROR' | 'TIMEOUT' | 'SYNTAX_ERROR' | 'NOT_RUN';

export interface TestResult {
  stubId: string;
  status: TestStatus;
  durationMs?: number;
  stdout?: string;
  stderr?: string;
  assertionMessage?: string;
}

export interface EvidenceRecord {
  totalStubs: number;
  ran: number;
  passed: number;
  failed: number;
  errored: number;
  notRun: number;
  results: TestResult[];
  executionTimestamp: string;
  runnerVersion: string;
}
