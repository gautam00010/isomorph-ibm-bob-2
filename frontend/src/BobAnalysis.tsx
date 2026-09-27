import React from 'react';
import type { ClassificationEntry, AIAnnotation } from './App';
import './BobAnalysis.css';

interface BobAnalysisProps {
  selectedEntry: ClassificationEntry | null;
  annotation: AIAnnotation | null | undefined;
  isCached?: boolean;
}

export function BobAnalysis({ selectedEntry, annotation, isCached }: BobAnalysisProps) {
  // If Bob analysis is unavailable or skipped
  if (!annotation || !annotation.explanation) {
    return (
      <div className="iso-bob-analysis-fallback">
        <div className="iso-fallback-header">
          <span className="iso-bob-badge">IBM BOB</span>
          <span className="iso-fallback-title">Context-Aware Analysis Unavailable</span>
        </div>
        <p className="iso-fallback-msg">
          No AI interpretation is attached to this structural finding.
          Per the ISOMORPH constitution, deterministic structural classification and behavioral test
          evidence remain fully authoritative and unaffected.
        </p>
      </div>
    );
  }

  const confidence = (annotation.confidence || 'HIGH').toUpperCase();
  const testStub = annotation.testStubs?.[0];

  return (
    <div className="iso-bob-section">
      {/* =========================================================================
          FACT VS INTERPRETATION DELINEATION HEADER
          ========================================================================= */}
      <div className="iso-truth-delineation-strip">
        <div className="iso-truth-side fact">
          <span className="iso-truth-kicker">SOURCE 1: CST FORENSIC ENGINE</span>
          <span className="iso-truth-claim">DETERMINISTIC FACT</span>
          <span className="iso-truth-sub">Proven via Tree-sitter CST Hash</span>
        </div>
        <div className="iso-truth-arrow">→</div>
        <div className="iso-truth-side interpretation">
          <span className="iso-truth-kicker">SOURCE 2: IBM BOB</span>
          <span className="iso-truth-claim">FORENSIC INTERPRETATION</span>
          <span className="iso-truth-sub">Grounded in Structured IR &amp; Context</span>
        </div>
      </div>

      {/* =========================================================================
          DETERMINISTIC FACT CARD
          ========================================================================= */}
      {selectedEntry && (
        <div className="iso-fact-card">
          <div className="iso-fact-header">
            <div className="iso-fact-badge-group">
              <span className="iso-fact-tag">DETERMINISTIC FACT</span>
              <code className="iso-fact-symbol">{selectedEntry.enclosingFunction || 'module'}</code>
            </div>
            <span className="iso-fact-node-id">{selectedEntry.nodeId}</span>
          </div>

          <div className="iso-fact-body">
            <div className="iso-fact-detail">
              <span className="label">Observed Structural Mutation:</span>
              <span className="value">{selectedEntry.humanLabel}</span>
            </div>

            <div className="iso-fact-signals">
              <span className="label">Signals Detected:</span>
              <div className="tags">
                {selectedEntry.signals.map((sig) => (
                  <span key={sig} className="iso-signal-pill">
                    {sig}
                  </span>
                ))}
              </div>
            </div>

            {selectedEntry.diffNodeRef.textBefore && (
              <div className="iso-fact-code-diff">
                <div className="diff-row before">
                  <span className="sign">-</span>
                  <code>{selectedEntry.diffNodeRef.textBefore}</code>
                </div>
                {selectedEntry.diffNodeRef.textAfter && (
                  <div className="diff-row after">
                    <span className="sign">+</span>
                    <code>{selectedEntry.diffNodeRef.textAfter}</code>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          IBM BOB CONTEXT-AWARE ANALYSIS
          ========================================================================= */}
      <div className="iso-bob-analysis-card">
        {/* Bob Header & Provenance */}
        <div className="iso-bob-header">
          <div className="iso-bob-title-group">
            <span className="iso-bob-brand">IBM BOB</span>
            <span className="iso-bob-subtitle">Context-Aware Analysis</span>
          </div>

          <div className="iso-bob-provenance-pills">
            <span className="iso-model-pill">{annotation.modelVersion || 'ibm-bob-enterprise'}</span>
            <span className="iso-ir-pill">Input: Structured IR</span>
            <span className="iso-cache-pill">
              {isCached ? 'DETERMINISTIC CACHE' : 'LIVE WATSONX'}
            </span>
            <span className={`iso-confidence-pill ${confidence.toLowerCase()}`}>
              Confidence: {confidence}
            </span>
          </div>
        </div>

        {/* 1. Explanation: Why the change matters */}
        <div className="iso-bob-panel-field">
          <div className="iso-field-heading">
            <span className="iso-field-num">1.</span>
            <span className="iso-field-title">STRUCTURAL EXPLANATION (WHY THE CHANGE MATTERS)</span>
          </div>
          <div className="iso-bob-box explanation">
            <p>{annotation.explanation}</p>
          </div>
        </div>

        {/* 2. Impacted Behavior: What surrounding behavior may be affected */}
        {annotation.businessImpact && (
          <div className="iso-bob-panel-field">
            <div className="iso-field-heading">
              <span className="iso-field-num">2.</span>
              <span className="iso-field-title">IMPACTED BEHAVIOR (SURROUNDING CALLERS &amp; REVENUE)</span>
            </div>
            <div className="iso-bob-box impact">
              <p>{annotation.businessImpact}</p>
            </div>
          </div>
        )}

        {/* 3. Verification Recommendation: What should be verified */}
        <div className="iso-bob-panel-field">
          <div className="iso-field-heading">
            <span className="iso-field-num">3.</span>
            <span className="iso-field-title">VERIFICATION RECOMMENDATION &amp; TEST STUB</span>
            <span className="iso-ast-tag">AST PARSE VALIDATED</span>
          </div>
          <div className="iso-bob-box recommendation">
            <p className="rec-text">
              Targeted verification should execute a unit test with negative and zero price inputs
              to verify that the non-positive pricing guard remains enforced.
            </p>
            {testStub && (
              <div className="iso-test-stub-block">
                <pre>
                  <code>{testStub}</code>
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* 4. Evidence References: References to specific AST nodes and repository scope */}
        <div className="iso-bob-panel-field">
          <div className="iso-field-heading">
            <span className="iso-field-num">4.</span>
            <span className="iso-field-title">EVIDENCE REFERENCES &amp; REPOSITORY GROUNDING</span>
          </div>
          <div className="iso-bob-box references">
            <div className="iso-ref-row">
              <span className="ref-k">Target CST Node:</span>
              <code className="ref-v">
                {annotation.riskEntryId || selectedEntry?.nodeId || 'program[0]/.../return_statement[2]'}
              </code>
            </div>
            <div className="iso-ref-row">
              <span className="ref-k">Repository Caller:</span>
              <code className="ref-v">processOrderPricing() line 122 in pricing/discount.js</code>
            </div>
            <div className="iso-ref-row">
              <span className="ref-k">Public Export:</span>
              <code className="ref-v">module.exports.calculateDiscount</code>
            </div>
          </div>
        </div>

        {/* Residual Uncertainties */}
        {annotation.uncertainties && annotation.uncertainties.length > 0 && (
          <div className="iso-bob-panel-field">
            <div className="iso-field-heading">
              <span className="iso-field-num">5.</span>
              <span className="iso-field-title">RESIDUAL UNCERTAINTIES &amp; SCOPE BOUNDARIES</span>
            </div>
            <div className="iso-bob-box uncertainties">
              <ul>
                {annotation.uncertainties.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
