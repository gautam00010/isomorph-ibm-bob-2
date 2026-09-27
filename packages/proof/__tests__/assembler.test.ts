import { analyze } from '@isomorph/engine';
import { assembleProof, verifyProofHash, canonicalJsonStringify } from '../src/assembler';

describe('Change Proof Assembler', () => {
  const beforeCode = `function hello() { return "world"; }`;
  const afterCode = `function hello() { return "universe"; }`;
  const analysis = analyze(beforeCode, afterCode);

  test('assembles valid ChangeProof and verifies hash', () => {
    const proof = assembleProof(analysis, { generatedAt: '2026-09-26T12:00:00.000Z' });
    expect(proof.proofVersion).toBe('1.0');
    expect(proof.proofHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(verifyProofHash(proof)).toBe(true);
    expect(proof.affectedSymbols.functions).toContain('hello');
  });

  test('proofHash is strictly reproducible across runs', () => {
    const proof1 = assembleProof(analysis, { generatedAt: '2026-09-26T12:00:00.000Z' });
    const proof2 = assembleProof(analysis, { generatedAt: '2026-09-26T12:00:00.000Z' });
    expect(proof1.proofHash).toBe(proof2.proofHash);
  });

  test('proofHash is sensitive to input changes', () => {
    const analysis2 = analyze(beforeCode, `function hello() { return "multiverse"; }`);
    const proof1 = assembleProof(analysis, { generatedAt: '2026-09-26T12:00:00.000Z' });
    const proof2 = assembleProof(analysis2, { generatedAt: '2026-09-26T12:00:00.000Z' });
    expect(proof1.proofHash).not.toBe(proof2.proofHash);
  });

  test('canonicalJsonStringify handles key order invariance', () => {
    const objA = { b: 2, a: 1, c: { y: 20, x: 10 } };
    const objB = { a: 1, c: { x: 10, y: 20 }, b: 2 };
    expect(canonicalJsonStringify(objA)).toBe(canonicalJsonStringify(objB));
  });
});
