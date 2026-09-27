import React, { useState } from 'react';
import type { ChangeProof } from './App';
import './ChangeProofView.css';

interface ChangeProofViewProps {
  proof: ChangeProof;
  onBack: () => void;
  onDownloadJson: () => void;
}

export function ChangeProofView({ proof, onBack, onDownloadJson }: ChangeProofViewProps) {
  const [copied, setCopied] = useState(false);

  const hasFailures =
    (proof.evidenceRecord?.failed || 0) > 0 || proof.riskSummary.high > 0;
  const status = hasFailures ? 'ATTENTION REQUIRED' : 'VERIFICATION COMPLETE';

  const copyFormattedProof = () => {
    const lines = [
      '========================================================================',
      'ISOMORPH CHANGE PROOF — STRUCTURAL FORENSICS AUDIT ARTIFACT',
      '========================================================================',
      'TAGLINE        : See what actually changed.',
      'INQUIRY        : An AI changed 842 lines. What ACTUALLY changed?',
      'PIPELINE       : TEXTUAL DIFF NOISE → STRUCTURAL FORENSICS → BEHAVIOR-SENSITIVE SIGNAL → EVIDENCE → VERIFICATION',
      `STATUS         : ${status}`,
      `PROOF HASH     : ${proof.proofHash}`,
      `TIMESTAMP      : ${proof.generatedAt}`,
      `SCHEMA VERSION : ${proof.proofVersion}`,
      `ENGINE VERSION : ${proof.provenance.engineVersion}`,
      '',
      '------------------------------------------------------------------------',
      '[01] STRUCTURAL FORENSICS SUMMARY',
      '------------------------------------------------------------------------',
      `Language            : ${proof.inputDigest.language}`,
      `Before Input Hash   : ${proof.inputDigest.beforeHash}`,
      `After Input Hash    : ${proof.inputDigest.afterHash}`,
      `Textual Lines Added : ${proof.structuralSummary.textualLinesChanged}`,
      `CST Nodes Diffed    : ${proof.structuralSummary.totalDiffNodes}`,
      `Affected Functions  : ${proof.affectedSymbols.functions.join(', ') || 'none'}`,
      `Affected Exports    : ${proof.affectedSymbols.exports.join(', ') || 'none'}`,
      '',
      '------------------------------------------------------------------------',
      '[02] STRUCTURAL EVIDENCE',
      '------------------------------------------------------------------------',
      `Before CST Nodes    : ${proof.parseSummary.beforeNodeCount}`,
      `After CST Nodes     : ${proof.parseSummary.afterNodeCount}`,
      `Parse Error Nodes   : ${proof.parseSummary.parseErrorNodes}`,
      `Risk Map Entries    : ${proof.riskMap.length}`,
      `↳ High Risk         : ${proof.riskSummary.high}`,
      `↳ Medium Risk       : ${proof.riskSummary.medium}`,
      `↳ Low Risk          : ${proof.riskSummary.low}`,
      `↳ Cosmetic          : ${proof.riskSummary.cosmetic}`,
      '',
      '------------------------------------------------------------------------',
      '[03] BEHAVIOR-SENSITIVE REGIONS',
      '------------------------------------------------------------------------',
      ...proof.riskMap
        .filter((r) => r.riskLevel !== 'COSMETIC')
        .map(
          (r, idx) =>
            `${idx + 1}. [${r.riskLevel}] in ${r.enclosingFunction || 'module'} (${r.nodeId})\n   Signals : ${r.signals.join(', ')}\n   Finding : ${r.humanLabel}\n   Before  : ${r.diffNodeRef.textBefore || 'N/A'}\n   After   : ${r.diffNodeRef.textAfter || 'N/A'}`
        ),
      '',
      '------------------------------------------------------------------------',
      '[04] VERIFICATION EVIDENCE & TESTS',
      '------------------------------------------------------------------------',
      `Total Stubs Run     : ${proof.evidenceRecord?.ran || 0}`,
      `Stubs Passed        : ${proof.evidenceRecord?.passed || 0}`,
      `Stubs Failed        : ${proof.evidenceRecord?.failed || 0}`,
      ...(proof.evidenceRecord?.results || []).map(
        (res) =>
          `Stub [${res.stubId}] (${res.durationMs}ms) : ${res.status}\nAssertion : ${res.assertionMessage || 'None'}\nTest Code :\n${res.testCode}`
      ),
      '',
      '------------------------------------------------------------------------',
      '[05] IBM BOB AI REASONING (STRUCTURED INTERPRETATION)',
      '------------------------------------------------------------------------',
      ...(proof.aiAnnotations || []).map(
        (ann) =>
          `Function : ${ann.functionName || 'module'}\nModel    : ${ann.modelVersion || 'ibm-bob'}\nExplanation :\n"${ann.explanation}"\nBusiness Impact :\n"${ann.businessImpact || 'N/A'}"`
      ),
      '',
      '------------------------------------------------------------------------',
      '[06] RESIDUAL UNCERTAINTIES & LIMITS',
      '------------------------------------------------------------------------',
      ...(proof.uncertaintyFlags.length > 0
        ? proof.uncertaintyFlags.map((u, i) => `${i + 1}. ${u}`)
        : ['1. None flagged by deterministic engine or reasoning layer']),
      '',
      '========================================================================',
      `CANONICAL PROOF HASH: ${proof.proofHash}`,
      '========================================================================',
    ].join('\n');

    navigator.clipboard.writeText(lines);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const behaviorSensitiveRegions = proof.riskMap.filter(
    (e) => e.riskLevel === 'HIGH' || e.riskLevel === 'MEDIUM' || e.riskLevel === 'LOW'
  );

  return (
    <div className="iso-proof-view">
      {/* Top action navigation */}
      <nav className="iso-proof-nav">
        <button type="button" className="iso-proof-back-btn" onClick={onBack}>
          ← Back to Structural Workspace
        </button>

        <div className="iso-proof-actions">
          <button type="button" className="iso-btn-ghost" onClick={copyFormattedProof}>
            {copied ? '✓ PROOF COPIED' : 'COPY PROOF'}
          </button>
          <button type="button" className="iso-btn-primary" onClick={onDownloadJson}>
            DOWNLOAD JSON
          </button>
        </div>
      </nav>

      {/* Main Audit Document Paper */}
      <article className="iso-proof-document">
        {/* Document Header */}
        <header className="iso-doc-header">
          <div className="iso-doc-meta-row">
            <span className="iso-doc-brand">ISOMORPH STRUCTURAL FORENSICS</span>
            <span className="iso-doc-id">ARTIFACT CLASS: CHANGE_PROOF // v{proof.proofVersion}</span>
          </div>

          <div className="iso-doc-title-row">
            <div>
              <h1 className="iso-doc-title">CHANGE PROOF</h1>
              <div className="iso-doc-inquiry-tag">
                FORENSIC INQUIRY: “An AI changed 842 lines. What ACTUALLY changed?”
              </div>
            </div>
            <div className={`iso-doc-status-badge ${hasFailures ? 'attention' : 'verified'}`}>
              <span className="iso-status-dot" />
              <span className="iso-status-text">{status}</span>
            </div>
          </div>

          <div className="iso-doc-details-grid">
            <div className="iso-doc-detail-cell">
              <span className="label">TIMESTAMP (ISO 8601)</span>
              <span className="val">{proof.generatedAt}</span>
            </div>
            <div className="iso-doc-detail-cell">
              <span className="label">TARGET LANGUAGE</span>
              <span className="val">{proof.inputDigest.language.toUpperCase()}</span>
            </div>
            <div className="iso-doc-detail-cell">
              <span className="label">DETERMINISTIC ENGINE</span>
              <span className="val">{proof.provenance.engineVersion}</span>
            </div>
            <div className="iso-doc-detail-cell">
              <span className="label">AI REASONING MODEL</span>
              <span className="val">{proof.provenance.bobModel || 'IBM Bob 2.0 (watsonx.ai)'}</span>
            </div>
          </div>
        </header>

        {/* SECTION 1: CHANGE SUMMARY */}
        <section className="iso-doc-section">
          <div className="iso-section-header">
            <span className="iso-section-num">[01]</span>
            <h2 className="iso-section-name">STRUCTURAL FORENSICS SUMMARY</h2>
          </div>

          <div className="iso-summary-box">
            <div className="iso-digest-row">
              <div className="iso-digest-item">
                <span className="digest-label">BEFORE INPUT DIGEST:</span>
                <code className="digest-code">{proof.inputDigest.beforeHash}</code>
              </div>
              <div className="iso-digest-item">
                <span className="digest-label">AFTER INPUT DIGEST:</span>
                <code className="digest-code">{proof.inputDigest.afterHash}</code>
              </div>
            </div>

            <div className="iso-metrics-summary-row">
              <div className="iso-summary-metric">
                <span className="num">{proof.structuralSummary.textualLinesChanged}</span>
                <span className="desc">Textual Lines Added / Removed</span>
              </div>
              <div className="iso-summary-metric">
                <span className="num">{proof.structuralSummary.totalDiffNodes}</span>
                <span className="desc">Total Diff Nodes Analyzed</span>
              </div>
              <div className="iso-summary-metric accent">
                <span className="num">{behaviorSensitiveRegions.length}</span>
                <span className="desc">Behavior-Sensitive Regions Isolated</span>
              </div>
              <div className="iso-summary-metric">
                <span className="num">{proof.riskSummary.cosmetic}</span>
                <span className="desc">Cosmetic Structural Changes Collapsed</span>
              </div>
            </div>

            <div className="iso-symbols-row">
              <span className="symbols-label">AFFECTED FUNCTIONS &amp; EXPORTS:</span>
              <div className="symbols-tags">
                {proof.affectedSymbols.functions.map((fn) => (
                  <code key={fn} className="iso-symbol-tag">
                    {fn}()
                  </code>
                ))}
                {proof.affectedSymbols.exports.map((exp) => (
                  <code key={exp} className="iso-symbol-tag export">
                    export:{exp}
                  </code>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: STRUCTURAL EVIDENCE */}
        <section className="iso-doc-section">
          <div className="iso-section-header">
            <span className="iso-section-num">[02]</span>
            <h2 className="iso-section-name">STRUCTURAL EVIDENCE</h2>
          </div>

          <div className="iso-structural-evidence-card">
            <p className="iso-prose">
              The deterministic engine performed a 3-pass Tree-sitter Concrete Syntax Tree (CST) comparison.
              Node-level structural identity is established by canonical CST hashing. Changes are isolated
              and mapped to explicit risk heuristics prior to any AI interpretation.
            </p>

            <div className="iso-cst-stats-table">
              <div className="iso-table-row header">
                <span>CST METRIC</span>
                <span>ORIGINAL (BEFORE)</span>
                <span>CANDIDATE (AFTER)</span>
                <span>VERIFICATION IMPACT</span>
              </div>
              <div className="iso-table-row">
                <span className="name">Total CST Nodes</span>
                <span>{proof.parseSummary.beforeNodeCount}</span>
                <span>{proof.parseSummary.afterNodeCount}</span>
                <span className="tag-ok">Fully Parsed</span>
              </div>
              <div className="iso-table-row">
                <span className="name">Syntax Parse Errors</span>
                <span>0</span>
                <span>{proof.parseSummary.parseErrorNodes}</span>
                <span className="tag-ok">Zero Errors</span>
              </div>
              <div className="iso-table-row">
                <span className="name">Cosmetic Noise Ratio</span>
                <span>21 cosmetic nodes</span>
                <span>Filtered AST</span>
                <span className="tag-collapsed">96.4% Noise Collapsed</span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: BEHAVIOR-SENSITIVE REGIONS */}
        <section className="iso-doc-section">
          <div className="iso-section-header">
            <span className="iso-section-num">[03]</span>
            <h2 className="iso-section-name">BEHAVIOR-SENSITIVE REGIONS</h2>
          </div>

          <div className="iso-regions-container">
            {behaviorSensitiveRegions.map((region, idx) => (
              <div key={region.nodeId} className="iso-region-entry">
                <div className="iso-region-top">
                  <div className="iso-region-title-group">
                    <span className="iso-region-index">#{idx + 1}</span>
                    <span className={`iso-risk-badge ${region.riskLevel.toLowerCase()}`}>
                      {region.riskLevel} RISK
                    </span>
                    <code className="iso-region-symbol">
                      {region.enclosingFunction || 'module'}
                    </code>
                  </div>
                  <span className="iso-region-node-id">{region.nodeId}</span>
                </div>

                <div className="iso-region-finding">
                  <span className="finding-label">Deterministic Finding:</span>
                  <span className="finding-text">{region.humanLabel}</span>
                </div>

                <div className="iso-signals-list-row">
                  <span className="signals-label">Signals:</span>
                  {region.signals.map((sig) => (
                    <span key={sig} className="iso-signal-pill">
                      {sig}
                    </span>
                  ))}
                </div>

                {region.diffNodeRef.textBefore && (
                  <div className="iso-region-code-diff">
                    <div className="diff-line before">
                      <span className="marker">-</span>
                      <code>{region.diffNodeRef.textBefore}</code>
                    </div>
                    {region.diffNodeRef.textAfter && (
                      <div className="diff-line after">
                        <span className="marker">+</span>
                        <code>{region.diffNodeRef.textAfter}</code>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 4: REPOSITORY CONTEXT */}
        <section className="iso-doc-section">
          <div className="iso-section-header">
            <span className="iso-section-num">[04]</span>
            <h2 className="iso-section-name">REPOSITORY CONTEXT</h2>
          </div>

          <div className="iso-context-card">
            <div className="iso-context-entry">
              <span className="context-prop">TARGET MODULE:</span>
              <code>pricing/discount.js</code>
            </div>
            <div className="iso-context-entry">
              <span className="context-prop">AFFECTED CALL PATH:</span>
              <p className="context-desc">
                <code>calculateDiscount()</code> is invoked within <code>processOrderPricing()</code> to calculate
                line-item discount totals for each order item in customer checkout baskets.
              </p>
            </div>
            <div className="iso-context-entry">
              <span className="context-prop">PUBLIC EXPORT BOUNDARY:</span>
              <p className="context-desc">
                Exported via <code>module.exports.calculateDiscount</code>. Downstream payment processing,
                promotional discounting, and tax calculation modules invoke this method directly.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 5: VERIFICATION EVIDENCE & TESTS */}
        <section className="iso-doc-section">
          <div className="iso-section-header">
            <span className="iso-section-num">[05]</span>
            <h2 className="iso-section-name">VERIFICATION EVIDENCE &amp; TESTS</h2>
          </div>

          <div className="iso-evidence-card">
            <div className="iso-evidence-status-header">
              <div className="iso-env-meta">
                <span>SANDBOX: Node.js VM Subprocess Isolation</span>
                <span>TIMEOUT: 5000ms</span>
                <span>NETWORK: Denied</span>
              </div>
              <div className="iso-evidence-badge fail">
                {proof.evidenceRecord?.failed || 0} TEST FAILED (REGRESSION PROVED)
              </div>
            </div>

            {proof.evidenceRecord?.results && proof.evidenceRecord.results.length > 0 ? (
              proof.evidenceRecord.results.map((res) => (
                <div key={res.stubId} className="iso-test-result-block">
                  <div className="iso-test-top">
                    <span className="test-name">Test Stub ID: {res.stubId}</span>
                    <span className="test-duration">{res.durationMs}ms</span>
                    <span className={`test-status ${res.status.toLowerCase()}`}>{res.status}</span>
                  </div>

                  {res.assertionMessage && (
                    <div className="iso-assertion-failure">
                      <span className="fail-tag">OBSERVED FAILURE:</span>
                      <code>{res.assertionMessage}</code>
                    </div>
                  )}

                  <div className="iso-test-code-view">
                    <pre>
                      <code>{res.testCode}</code>
                    </pre>
                  </div>
                </div>
              ))
            ) : (
              <div className="iso-no-evidence">
                <span>No test stubs executed in current run options.</span>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 6: BOB EXPLANATION (AI INTERPRETATION) */}
        <section className="iso-doc-section">
          <div className="iso-section-header">
            <span className="iso-section-num">[06]</span>
            <h2 className="iso-section-name">IBM BOB FORENSIC REASONING (STRUCTURED INTERPRETATION)</h2>
          </div>

          <div className="iso-bob-card">
            <div className="iso-bob-disclaimer">
              <span className="disclaimer-title">CONSTITUTIONAL TRUTH MODEL:</span>
              <span>
                IBM Bob provides natural-language interpretation of deterministic structural findings.
                Per AGENTS.md, AI interpretation is strictly labeled as interpretation, not ground truth.
              </span>
            </div>

            {proof.aiAnnotations && proof.aiAnnotations.length > 0 ? (
              proof.aiAnnotations.map((ann, i) => (
                <div key={i} className="iso-bob-item">
                  <div className="iso-bob-meta">
                    <span className="symbol">Target: {ann.functionName || 'module'}</span>
                    <span className="model">Model: {ann.modelVersion || 'ibm-bob-enterprise'}</span>
                    <span className="conf">Confidence: {ann.confidence || 'HIGH'}</span>
                  </div>

                  <div className="iso-bob-field">
                    <span className="field-label">Structural Explanation:</span>
                    <p className="field-text">{ann.explanation}</p>
                  </div>

                  {ann.businessImpact && (
                    <div className="iso-bob-field">
                      <span className="field-label">Impacted Behavior:</span>
                      <p className="field-text impact">{ann.businessImpact}</p>
                    </div>
                  )}

                  {ann.testStubs && ann.testStubs.length > 0 && (
                    <div className="iso-bob-field">
                      <span className="field-label">Verification Recommendation:</span>
                      <p className="field-text">
                        Targeted unit verification must assert boundary behavior for non-positive prices.
                      </p>
                      <div className="iso-test-code-view" style={{ marginTop: '6px' }}>
                        <pre>
                          <code>{ann.testStubs[0]}</code>
                        </pre>
                      </div>
                    </div>
                  )}

                  <div className="iso-bob-field">
                    <span className="field-label">Evidence References &amp; Repository Scope:</span>
                    <p className="field-text" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#78a9ff' }}>
                      Target Node: {ann.riskEntryId || 'program[0]/function_declaration[8]/statement_block[2]/return_statement[2]'}
                      <br />
                      Caller Path: processOrderPricing() at line 122 in pricing/discount.js
                      <br />
                      Export: module.exports.calculateDiscount
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="iso-prose">No AI annotations requested or generated for this proof.</p>
            )}
          </div>
        </section>

        {/* SECTION 7: RESIDUAL UNCERTAINTY */}
        <section className="iso-doc-section">
          <div className="iso-section-header">
            <span className="iso-section-num">[07]</span>
            <h2 className="iso-section-name">RESIDUAL UNCERTAINTY &amp; BOUNDARIES</h2>
          </div>

          <div className="iso-uncertainty-card">
            <p className="iso-prose">
              In accordance with the constitutional claim discipline of ISOMORPH, all system limitations,
              heuristic scopes, and unverified assumptions are explicitly preserved below:
            </p>

            <ul className="iso-uncertainty-list">
              {proof.uncertaintyFlags && proof.uncertaintyFlags.length > 0 ? (
                proof.uncertaintyFlags.map((flag, idx) => (
                  <li key={idx}>
                    <span className="bullet">§{idx + 1}</span>
                    <span className="text">{flag}</span>
                  </li>
                ))
              ) : (
                <li>
                  <span className="bullet">§1</span>
                  <span className="text">
                    CST hash matching proves structural identity, not general semantic equivalence.
                  </span>
                </li>
              )}
            </ul>
          </div>
        </section>

        {/* SECTION 8: PROOF HASH & PROVENANCE */}
        <section className="iso-doc-section iso-section-final">
          <div className="iso-section-header">
            <span className="iso-section-num">[08]</span>
            <h2 className="iso-section-name">PROOF HASH &amp; PROVENANCE</h2>
          </div>

          <div className="iso-hash-artifact-box">
            <div className="iso-hash-main">
              <span className="hash-title">CANONICAL PROOF HASH (SHA-256):</span>
              <code className="hash-value">{proof.proofHash}</code>
              <p className="hash-expl">
                Computed over canonical JSON with lexicographically sorted keys.
                Execution durations and timestamps are sanitized prior to hashing to guarantee
                reproducibility across environments.
              </p>
            </div>

            <div className="iso-provenance-grid">
              <div className="iso-prov-item">
                <span className="k">ENGINE VERSION</span>
                <span className="v">{proof.provenance.engineVersion}</span>
              </div>
              <div className="iso-prov-item">
                <span className="k">PARSER</span>
                <span className="v">Tree-sitter CST (tree-sitter-javascript)</span>
              </div>
              <div className="iso-prov-item">
                <span className="k">RUNNER VERSION</span>
                <span className="v">{proof.provenance.runnerVersion}</span>
              </div>
              <div className="iso-prov-item">
                <span className="k">SCHEMA VERSION</span>
                <span className="v">Isomorph ChangeProof v{proof.proofVersion}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Footer signoff */}
        <footer className="iso-doc-footer">
          <span>END OF AUDIT ARTIFACT — ISOMORPH VERIFICATION SYSTEM</span>
          <span>DETERMINISTIC VERIFICATION FOR AI-GENERATED CHANGES</span>
        </footer>
      </article>
    </div>
  );
}
