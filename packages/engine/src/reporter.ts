/**
 * Report Generator
 *
 * Produces both machine-readable JSON and human-readable text reports
 * from a StructuralAnalysisResult.
 */

import type {
  ClassificationEntry,
  EditOperation,
  RiskMap,
  StructuralAnalysisResult,
} from './types';

// ---------------------------------------------------------------------------
// Machine-readable JSON
// ---------------------------------------------------------------------------

/**
 * Returns the StructuralAnalysisResult as compact JSON.
 * This IS the machine-readable output — the result object itself is the JSON model.
 */
export function toJSON(result: StructuralAnalysisResult, pretty = false): string {
  return JSON.stringify(result, null, pretty ? 2 : 0);
}

// ---------------------------------------------------------------------------
// Human-readable report
// ---------------------------------------------------------------------------

/**
 * Produces a human-readable text report from the analysis result.
 * Designed to be readable in a terminal and in the ENGINE_REPORT.md.
 */
export function toHumanReport(result: StructuralAnalysisResult): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('  ISOMORPH — STRUCTURAL ANALYSIS REPORT');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`  Analyzed at : ${result.analyzedAt}`);
  lines.push(`  Language    : ${result.language}`);
  lines.push(`  Before hash : ${result.beforeHash}`);
  lines.push(`  After hash  : ${result.afterHash}`);
  lines.push('');

  // Parse summary
  lines.push('── PARSE SUMMARY ──────────────────────────────────────────────');
  lines.push(`  Before nodes : ${result.parseSummary.beforeNodeCount}`);
  lines.push(`  After nodes  : ${result.parseSummary.afterNodeCount}`);
  lines.push(`  Parse errors : ${result.parseSummary.parseErrorCount}`);
  lines.push('');

  // Structural diff summary
  const s = result.structuralDiff.summary;
  lines.push('── STRUCTURAL DIFF SUMMARY ────────────────────────────────────');
  lines.push(`  Total nodes diffed : ${s.total}`);
  lines.push(`  UNCHANGED          : ${s.unchanged}`);
  lines.push(`  COSMETIC           : ${s.cosmetic}`);
  lines.push(`  UPDATE             : ${s.update}`);
  lines.push(`  INSERT             : ${s.insert}`);
  lines.push(`  DELETE             : ${s.delete}`);
  lines.push(`  MOVE               : ${s.move}`);
  lines.push(`  REWRITE            : ${s.rewrite}`);
  lines.push(`  UNKNOWN            : ${s.unknown}`);
  if (s.textualLinesAdded > 0 || s.textualLinesRemoved > 0) {
    lines.push(`  Textual +lines     : ${s.textualLinesAdded}`);
    lines.push(`  Textual -lines     : ${s.textualLinesRemoved}`);
  }
  lines.push('');

  // Risk summary
  const rs = result.riskSummary;
  lines.push('── RISK SUMMARY ───────────────────────────────────────────────');
  lines.push(`  HIGH     : ${rs.high}`);
  lines.push(`  MEDIUM   : ${rs.medium}`);
  lines.push(`  LOW      : ${rs.low}`);
  lines.push(`  COSMETIC : ${rs.cosmetic}`);
  lines.push(`  UNKNOWN  : ${rs.unknown}`);
  lines.push('');

  // Edit script (non-UNCHANGED, non-COSMETIC entries)
  const meaningful = result.editScript.filter(
    op => op.operation !== 'UNCHANGED' && op.operation !== 'COSMETIC'
  );

  if (meaningful.length > 0) {
    lines.push('── EDIT SCRIPT (meaningful changes only) ──────────────────────');
    for (const op of meaningful) {
      const risk = riskBadge(op.riskLevel);
      lines.push('');
      lines.push(`  [${op.operation.padEnd(8)}] ${risk} ${op.description}`);
      lines.push(`  Node    : ${op.nodeId}`);
      lines.push(`  Type    : ${op.nodeType}`);
      if (op.signals.length > 0) {
        lines.push(`  Signals : ${op.signals.join(', ')}`);
      }
      if (op.beforeRange) {
        lines.push(`  Before  : L${op.beforeRange.startLine}–L${op.beforeRange.endLine}`);
      }
      if (op.afterRange) {
        lines.push(`  After   : L${op.afterRange.startLine}–L${op.afterRange.endLine}`);
      }
      if (op.textBefore !== undefined) {
        lines.push(`  Was     : ${formatSnippet(op.textBefore)}`);
      }
      if (op.textAfter !== undefined) {
        lines.push(`  Now     : ${formatSnippet(op.textAfter)}`);
      }
      if (op.movedFrom) {
        lines.push(`  Moved from: ${op.movedFrom}`);
      }
    }
    lines.push('');
  }

  // Cosmetic summary (collapsed)
  const cosmeticOps = result.editScript.filter(op => op.operation === 'COSMETIC');
  if (cosmeticOps.length > 0) {
    lines.push(`── COSMETIC CHANGES (${cosmeticOps.length} total — collapsed) ─────────────────`);
    lines.push('  (whitespace, comments, formatting — no structural risk)');
    for (const op of cosmeticOps.slice(0, 5)) {
      lines.push(`  · L${op.afterRange?.startLine ?? '?'}: ${op.description}`);
    }
    if (cosmeticOps.length > 5) {
      lines.push(`  · ... and ${cosmeticOps.length - 5} more`);
    }
    lines.push('');
  }

  // Uncertainty flags
  if (result.uncertaintyFlags.length > 0) {
    lines.push('── UNCERTAINTY FLAGS ───────────────────────────────────────────');
    for (const flag of result.uncertaintyFlags) {
      lines.push(`  ⚠  ${flag}`);
    }
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('  NOT CLAIMED: semantic equivalence, behavioral equivalence,');
  lines.push('  or that any change is "safe." Structural analysis only.');
  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Edit script builder (from RiskMap)
// ---------------------------------------------------------------------------

export function buildEditScript(riskMap: RiskMap): EditOperation[] {
  return riskMap.map(entry => ({
    operation: diffToOperation(entry.diffNodeRef.changeType),
    nodeId: entry.nodeId,
    nodeType: entry.diffNodeRef.nodeType,
    description: entry.humanLabel,
    riskLevel: entry.riskLevel,
    signals: entry.signals,
    beforeRange: entry.diffNodeRef.beforeRange,
    afterRange: entry.diffNodeRef.afterRange,
    textBefore: entry.diffNodeRef.textBefore,
    textAfter: entry.diffNodeRef.textAfter,
    movedFrom: entry.diffNodeRef.movedFrom,
  }));
}

function diffToOperation(
  changeType: string
): 'INSERT' | 'DELETE' | 'UPDATE' | 'MOVE' | 'COSMETIC' | 'UNCHANGED' {
  switch (changeType) {
    case 'INSERT':   return 'INSERT';
    case 'DELETE':   return 'DELETE';
    case 'UPDATE':   return 'UPDATE';
    case 'MOVE':     return 'MOVE';
    case 'COSMETIC': return 'COSMETIC';
    case 'UNCHANGED':return 'UNCHANGED';
    default:         return 'UPDATE';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function riskBadge(level: string): string {
  switch (level) {
    case 'HIGH':     return '[HIGH    ]';
    case 'MEDIUM':   return '[MEDIUM  ]';
    case 'LOW':      return '[LOW     ]';
    case 'COSMETIC': return '[COSMETIC]';
    case 'UNKNOWN':  return '[UNKNOWN ]';
    default:         return '[?       ]';
  }
}

function formatSnippet(text: string): string {
  const single = text.replace(/\n/g, '↵').replace(/\s+/g, ' ').trim();
  return single.length > 80 ? single.slice(0, 80) + '…' : single;
}
