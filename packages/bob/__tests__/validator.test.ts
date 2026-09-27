import { validateAIAnnotation, makeFallbackAnnotation } from '../src/validator';
import type { StructuralDiff } from '@isomorph/engine';

describe('Bob Validator', () => {
  const dummyDiff: StructuralDiff = {
    nodes: [
      {
        nodeId: 'node-1',
        changeType: 'UPDATE',
        nodeType: 'return_statement',
        fieldName: null,
        children: [],
        depth: 1,
      },
    ],
    rootNodes: [],
    summary: {
      total: 1,
      unchanged: 0,
      cosmetic: 0,
      update: 1,
      insert: 0,
      delete: 0,
      move: 0,
      rewrite: 0,
      unknown: 0,
      textualLinesAdded: 1,
      textualLinesRemoved: 1,
    },
  };

  test('validates valid Bob response', () => {
    const raw = {
      explanation: 'The return statement guard clause was removed, which may cause negative numbers.',
      businessImpact: 'Negative discounts could be credited to orders.',
      testStubs: ['test("discount", () => { expect(calculateDiscount(0, 0.2)).toBe(0); });'],
      uncertainties: ['Caller behavior not verified'],
      evidenceReferences: ['node-1'],
      confidence: 'high',
    };

    const validated = validateAIAnnotation('node-1', raw, dummyDiff, 'ibm-bob-2.0', 'v1/explain');
    expect(validated.nodeId).toBe('node-1');
    expect(validated.explanation).toBe(raw.explanation);
    expect(validated.businessImpact).toBe(raw.businessImpact);
    expect(validated.testStubs.length).toBe(1);
    expect(validated.confidence).toBe('high');
    expect(validated.evidenceReferences).toEqual(['node-1']);
  });

  test('filters out invalid evidence references', () => {
    const raw = {
      explanation: 'Valid explanation of the change that is over 20 chars.',
      evidenceReferences: ['invented-node-999', 'node-1'],
      confidence: 'medium',
    };

    const validated = validateAIAnnotation('node-1', raw, dummyDiff, 'ibm-bob-2.0', 'v1/explain');
    expect(validated.evidenceReferences).toEqual(['node-1']);
  });

  test('creates structured fallback annotation on error', () => {
    const fallback = makeFallbackAnnotation(
      'node-1',
      'Bob API timeout after 8000ms',
      'ibm-bob-2.0',
      'v1/explain'
    );

    expect(fallback.nodeId).toBe('node-1');
    expect(fallback.explanation).toBeNull();
    expect(fallback.businessImpact).toBeNull();
    expect(fallback.testStubs).toEqual([]);
    expect(fallback.uncertainties).toContain('Bob API timeout after 8000ms');
    expect(fallback.confidence).toBe('low');
  });
});
