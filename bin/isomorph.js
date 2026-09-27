#!/usr/bin/env node

/**
 * ISOMORPH CLI — Deterministic verification for AI-generated code changes.
 *
 * Usage:
 *   node bin/isomorph.js <before-file> <after-file> [--json] [--output <proof.json>]
 *   node bin/isomorph.js --demo
 */

const fs = require('fs');
const path = require('path');
const { runIsomorph } = require('../packages/core');

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--demo') || args.length === 0) {
    require('./demo.js');
    return;
  }

  if (args.includes('-h') || args.includes('--help')) {
    console.log(`
Usage:
  node bin/isomorph.js <before-file> <after-file> [options]
  node bin/isomorph.js --demo

Options:
  --demo             Run the built-in golden demo scenario
  --json             Output raw ChangeProof JSON to stdout
  --output <file>    Save ChangeProof JSON to specified file
  --skip-evidence    Skip executing test stubs
`);
    process.exit(0);
  }

  const fileArgs = args.filter(a => !a.startsWith('-'));
  if (fileArgs.length < 2) {
    console.error('Error: Please provide before and after file paths, or use --demo.');
    process.exit(1);
  }

  const beforeFile = path.resolve(fileArgs[0]);
  const afterFile = path.resolve(fileArgs[1]);

  if (!fs.existsSync(beforeFile) || !fs.existsSync(afterFile)) {
    console.error('Error: One or both input files do not exist.');
    process.exit(1);
  }

  const beforeSource = fs.readFileSync(beforeFile, 'utf-8');
  const afterSource = fs.readFileSync(afterFile, 'utf-8');

  const skipEvidence = args.includes('--skip-evidence');
  const result = await runIsomorph(beforeSource, afterSource, { skipEvidence });

  if (args.includes('--json')) {
    console.log(JSON.stringify(result.changeProof, null, 2));
    return;
  }

  console.log('\nISOMORPH Analysis Result:');
  console.log('Proof Hash:', result.changeProof.proofHash);
  console.log('High Risk :', result.changeProof.riskSummary.high);
  console.log('Medium    :', result.changeProof.riskSummary.medium);
  console.log('Low       :', result.changeProof.riskSummary.low);
  console.log('Cosmetic  :', result.changeProof.riskSummary.cosmetic);

  const outIdx = args.indexOf('--output');
  if (outIdx !== -1 && args[outIdx + 1]) {
    const outFile = path.resolve(args[outIdx + 1]);
    fs.writeFileSync(outFile, JSON.stringify(result.changeProof, null, 2), 'utf-8');
    console.log(`ChangeProof written to: ${outFile}`);
  }
}

main().catch(err => {
  console.error('Execution error:', err);
  process.exit(1);
});
