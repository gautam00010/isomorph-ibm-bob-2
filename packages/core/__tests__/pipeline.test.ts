import * as fs from 'fs';
import * as path from 'path';
import { runIsomorph } from '../src/pipeline';
import { verifyProofHash } from '@isomorph/proof';

describe('ISOMORPH End-to-End Pipeline', () => {
  const demoBeforePath = path.resolve(__dirname, '../../../demo/before/discount.js');
  const demoAfterPath = path.resolve(__dirname, '../../../demo/after/discount.js');
  const beforeSource = fs.readFileSync(demoBeforePath, 'utf-8');
  const afterSource = fs.readFileSync(demoAfterPath, 'utf-8');

  test('runs complete end-to-end pipeline on golden demo corpus', async () => {
    const result = await runIsomorph(beforeSource, afterSource, {
      generatedAt: '2026-09-26T14:00:00.000Z',
    });

    // 1. Structural Signal & Risk Classification
    expect(result.analysis.riskSummary.high).toBeGreaterThanOrEqual(1);
    const highRiskDiscount = result.analysis.riskMap.find(
      r => r.enclosingFunction === 'calculateDiscount' && r.riskLevel === 'HIGH'
    );
    expect(highRiskDiscount).toBeDefined();

    // 2. AI Reasoning (IBM Bob explanation & test stub)
    expect(result.annotations.length).toBeGreaterThanOrEqual(1);
    const discountAnnotation = result.annotations.find(
      a => a.explanation && a.explanation.includes('calculateDiscount')
    );
    expect(discountAnnotation).toBeDefined();
    expect(discountAnnotation?.testStubs.length).toBeGreaterThanOrEqual(1);

    // 3. Behavioral Evidence (test runner executed the stub against modified source)
    expect(result.evidenceRecord).not.toBeNull();
    expect(result.evidenceRecord!.ran).toBeGreaterThanOrEqual(1);
    expect(result.evidenceRecord!.failed).toBeGreaterThanOrEqual(1);

    // 4. Change Proof assembly
    const proof = result.changeProof;
    expect(proof.proofVersion).toBe('1.0');
    expect(proof.proofHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(verifyProofHash(proof)).toBe(true);
    expect(proof.affectedSymbols.functions).toContain('calculateDiscount');
  });

  test('reproducibility: same input produces identical proof_hash', async () => {
    const fixedTime = '2026-09-26T14:00:00.000Z';
    const run1 = await runIsomorph(beforeSource, afterSource, { generatedAt: fixedTime });
    const run2 = await runIsomorph(beforeSource, afterSource, { generatedAt: fixedTime });

    expect(run1.changeProof.proofHash).toBe(run2.changeProof.proofHash);
  });
});
