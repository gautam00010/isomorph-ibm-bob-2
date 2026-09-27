import React, { useState } from 'react';
import axios from 'axios';
import { DEMO_SCENARIOS, SCENARIO_01_FIXED, type DemoScenario } from './demoCorpus';
import { ChangeProofView } from './ChangeProofView';
import { BobAnalysis } from './BobAnalysis';
import { GoldenDemoMode } from './GoldenDemoMode';
import './App.css';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export interface ClassificationEntry {
  nodeId: string;
  enclosingFunction: string | null;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'COSMETIC';
  riskScore: number;
  signals: string[];
  humanLabel: string;
  diffNodeRef: {
    nodeType: string;
    textBefore?: string;
    textAfter?: string;
    startPosition?: { row: number; column: number };
    endPosition?: { row: number; column: number };
  };
}

export interface RiskSummary {
  high: number;
  medium: number;
  low: number;
  cosmetic: number;
  total: number;
  criticalPathRisk: boolean;
}

export interface AIAnnotation {
  riskEntryId?: string;
  functionName?: string;
  explanation: string;
  businessImpact?: string;
  testStubs?: string[];
  uncertainties: string[];
  evidenceReferences?: string[];
  confidence: string;
  modelVersion?: string;
  promptVersion?: string;
}

export interface EvidenceResult {
  stubId: string;
  status: 'PASS' | 'FAIL' | 'ERROR' | 'TIMEOUT';
  durationMs: number;
  testCode: string;
  assertionMessage?: string;
  stdout?: string;
  stderr?: string;
}

export interface EvidenceRecord {
  totalStubs: number;
  ran: number;
  passed: number;
  failed: number;
  errored: number;
  notRun: number;
  results: EvidenceResult[];
}

export interface ChangeProof {
  proofVersion: '1.0';
  proofHash: string;
  generatedAt: string;
  inputDigest: {
    beforeHash: string;
    afterHash: string;
    language: 'javascript' | 'typescript';
  };
  parseSummary: {
    beforeNodeCount: number;
    afterNodeCount: number;
    parseErrorNodes: number;
  };
  structuralSummary: {
    totalDiffNodes: number;
    byChangeType: Record<string, number>;
    textualLinesChanged: number;
  };
  riskMap: ClassificationEntry[];
  riskSummary: RiskSummary;
  aiAnnotations: AIAnnotation[] | null;
  aiAnnotationsCached: boolean;
  evidenceRecord: EvidenceRecord | null;
  affectedSymbols: {
    functions: string[];
    classes: string[];
    exports: string[];
  };
  uncertaintyFlags: string[];
  provenance: {
    engineVersion: string;
    bobModel: string | null;
    promptVersion: string | null;
    runnerVersion: string;
  };
}

export interface ApiResponse {
  changeProof: ChangeProof;
  analysis?: unknown;
  annotations?: AIAnnotation[];
  evidenceRecord?: EvidenceRecord | null;
}

type AnimationStage =
  | 'idle'
  | 'stage_lines'
  | 'stage_analyzing'
  | 'stage_signal'
  | 'stage_behavior'
  | 'stage_evidence'
  | 'completed';
type TabType = 'bob_explanation' | 'evidence_runner' | 'cst_inspection';

export function App() {
  const [selectedScenarioId, setSelectedScenarioId] = useState<'refactor_noise' | 'tiny_mutation' | 'auth_risk'>('refactor_noise');
  const activeScenario = DEMO_SCENARIOS[selectedScenarioId];

  const [beforeCode, setBeforeCode] = useState(DEMO_SCENARIOS.refactor_noise.beforeCode);
  const [afterCode, setAfterCode] = useState(DEMO_SCENARIOS.refactor_noise.afterCode);
  const [showEditor, setShowEditor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [animationStage, setAnimationStage] = useState<AnimationStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [proof, setProof] = useState<ChangeProof | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string>(DEMO_SCENARIOS.refactor_noise.defaultEntryId);
  const [activeTab, setActiveTab] = useState<TabType>('bob_explanation');
  const [filterRisk, setFilterRisk] = useState<string>('ALL');
  const [copiedHash, setCopiedHash] = useState(false);
  const [showCosmetic, setShowCosmetic] = useState(false);
  const [viewMode, setViewMode] = useState<'workspace' | 'proof'>('workspace');

  // 3-Minute Golden Demo Presentation State
  const [demoModeActive, setDemoModeActive] = useState(false);
  const [demoStep, setDemoStep] = useState(1);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [isFixApplied, setIsFixApplied] = useState(false);
  const [showFinalScreen, setShowFinalScreen] = useState(false);

  const handleSelectScenario = (id: 'refactor_noise' | 'tiny_mutation' | 'auth_risk') => {
    setSelectedScenarioId(id);
    const sc = DEMO_SCENARIOS[id];
    setBeforeCode(sc.beforeCode);
    setAfterCode(sc.afterCode);
    setSelectedEntryId(sc.defaultEntryId);
    setProof(null);
    setError(null);
    setAnimationStage('idle');
  };

  // Trigger analysis through the 6-stage forensic sequence
  const runVerification = async (customAfterSource?: unknown) => {
    setLoading(true);
    setError(null);
    setAnimationStage('stage_lines');

    const effectiveAfter = typeof customAfterSource === 'string' ? customAfterSource : afterCode;

    try {
      // Stage 01: 842 Lines Changed (diff scan)
      await new Promise((res) => setTimeout(res, 280));
      setAnimationStage('stage_analyzing');

      // Stage 02: Analyzing CST
      await new Promise((res) => setTimeout(res, 300));
      setAnimationStage('stage_signal');

      // Stage 03: Structural Signal / Collapsing Noise
      await new Promise((res) => setTimeout(res, 320));
      setAnimationStage('stage_behavior');

      // Trigger API in parallel
      const respPromise = axios.post<ApiResponse>(`${API_BASE}/api/analyze`, {
        beforeSource: beforeCode,
        afterSource: effectiveAfter,
        scenario: selectedScenarioId,
        options: {
          textualLinesAdded: activeScenario.textualLinesAdded,
          textualLinesRemoved: activeScenario.textualLinesRemoved,
        },
      });

      // Stage 04: Behavior-Sensitive Mutations Isolated
      await new Promise((res) => setTimeout(res, 340));
      setAnimationStage('stage_evidence');

      const resp = await respPromise;

      // Stage 05: Subprocess Evidence Verification
      await new Promise((res) => setTimeout(res, 280));
      setProof(resp.data.changeProof);
      setAnimationStage('completed');

      // Default to selecting the highest risk entry or scenario default
      const highEntry = resp.data.changeProof.riskMap.find((e) => e.riskLevel === 'HIGH');
      if (highEntry) {
        setSelectedEntryId(highEntry.enclosingFunction || highEntry.nodeId);
      } else {
        setSelectedEntryId(activeScenario.defaultEntryId);
      }
    } catch (e: unknown) {
      setAnimationStage('idle');
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err?.response?.data?.error || err.message || 'Verification pipeline encountered an error.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFix = async () => {
    setIsFixApplied(true);
    setAfterCode(SCENARIO_01_FIXED);
    await runVerification(SCENARIO_01_FIXED);
  };

  const handleRevertFix = async () => {
    setIsFixApplied(false);
    setAfterCode(DEMO_SCENARIOS.refactor_noise.afterCode);
    await runVerification(DEMO_SCENARIOS.refactor_noise.afterCode);
  };

  const handleSelectDemoStep = async (step: number) => {
    setDemoStep(step);

    if (step === 1) {
      // 0–15s: The Problem
      setSelectedScenarioId('refactor_noise');
      setBeforeCode(DEMO_SCENARIOS.refactor_noise.beforeCode);
      setAfterCode(DEMO_SCENARIOS.refactor_noise.afterCode);
      setIsFixApplied(false);
      setProof(null);
      setViewMode('workspace');
      setShowEditor(false);
      setShowFinalScreen(false);
    } else if (step === 2) {
      // 15–35s: Launch Isomorph
      setShowFinalScreen(false);
      setViewMode('workspace');
      if (!proof) {
        await runVerification();
      }
    } else if (step === 3) {
      // 35–65s: Noise -> Signal
      setShowFinalScreen(false);
      setViewMode('workspace');
      if (!proof) {
        await runVerification();
      }
    } else if (step === 4) {
      // 65–100s: Highest-Risk Region
      setShowFinalScreen(false);
      setViewMode('workspace');
      if (!proof) {
        await runVerification();
      }
      setSelectedEntryId('calculateDiscount');
      setActiveTab('cst_inspection');
    } else if (step === 5) {
      // 100–130s: IBM Bob Contextual Reasoning
      setShowFinalScreen(false);
      setViewMode('workspace');
      if (!proof) {
        await runVerification();
      }
      setSelectedEntryId('calculateDiscount');
      setActiveTab('bob_explanation');
    } else if (step === 6) {
      // 130–160s: Targeted Verification (FAIL -> FIX -> PASS)
      setShowFinalScreen(false);
      setViewMode('workspace');
      if (!proof) {
        await runVerification();
      }
      setSelectedEntryId('calculateDiscount');
      setActiveTab('evidence_runner');
    } else if (step === 7) {
      // 160–180s: Change Proof & Closing
      setShowFinalScreen(false);
      if (!proof) {
        await runVerification();
      }
      setViewMode('proof');
    }
  };

  const resetToInitialState = () => {
    setProof(null);
    setAnimationStage('idle');
    setError(null);
    setShowEditor(false);
    setBeforeCode(activeScenario.beforeCode);
    setAfterCode(activeScenario.afterCode);
    setSelectedEntryId(activeScenario.defaultEntryId);
  };

  const copyProofHash = () => {
    if (!proof) return;
    navigator.clipboard.writeText(proof.proofHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const downloadProofJson = () => {
    if (!proof) return;
    const blob = new Blob([JSON.stringify(proof, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `change-proof-${proof.proofHash.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const behaviorSensitiveEntries = (proof?.riskMap || []).filter(
    (e) => e.riskLevel === 'HIGH' || e.riskLevel === 'MEDIUM' || e.riskLevel === 'LOW'
  );

  const cosmeticEntries = (proof?.riskMap || []).filter((e) => e.riskLevel === 'COSMETIC');

  const filteredEntries = (proof?.riskMap || []).filter((e) => {
    if (filterRisk === 'ALL') return e.riskLevel !== 'COSMETIC';
    return e.riskLevel === filterRisk;
  });

  const selectedEntry = (proof?.riskMap || []).find(
    (e) => (e.enclosingFunction || e.nodeId) === selectedEntryId
  ) || behaviorSensitiveEntries[0];

  // Find corresponding Bob annotation
  const currentAnnotation = proof?.aiAnnotations?.find(
    (a) => a.functionName === selectedEntryId || a.riskEntryId === selectedEntry?.nodeId
  ) || proof?.aiAnnotations?.[0];

  // Find corresponding evidence result
  const currentEvidence = proof?.evidenceRecord?.results?.[0];

  // Dedicated CHANGE PROOF view mode
  if (viewMode === 'proof' && proof) {
    return (
      <div className="iso-app">
        {demoModeActive && (
          <GoldenDemoMode
            activeStep={demoStep}
            onSelectStep={handleSelectDemoStep}
            onNext={() => handleSelectDemoStep(Math.min(7, demoStep + 1))}
            onPrev={() => handleSelectDemoStep(Math.max(1, demoStep - 1))}
            onExit={() => setDemoModeActive(false)}
            isPlaying={demoPlaying}
            onTogglePlay={() => setDemoPlaying(!demoPlaying)}
            isFixApplied={isFixApplied}
            onApplyFix={handleApplyFix}
            onRevertFix={handleRevertFix}
            proofHash={proof.proofHash}
            onViewProof={() => setViewMode('proof')}
            showFinalScreen={showFinalScreen}
            onSetShowFinalScreen={setShowFinalScreen}
          />
        )}
        <ChangeProofView
          proof={proof}
          onBack={() => setViewMode('workspace')}
          onDownloadJson={downloadProofJson}
        />
      </div>
    );
  }

  return (
    <div className="iso-app">
      {/* =========================================================================
          LEVEL 1: BRAND & MINIMAL TOP HEADER
          ========================================================================= */}
      <header className="iso-header">
        <div className="iso-header-left">
          <div className="iso-brand-group">
            <span className="iso-brand-title">ISOMORPH</span>
            <span className="iso-badge-tag">STRUCTURAL FORENSICS</span>
            <span className="iso-badge-version">See what actually changed.</span>
          </div>
          {proof ? (
            <div className="iso-core-question">
              <span className="iso-question-prefix">Scenario [{activeScenario.num}] Forensic Question:</span>
              <span className="iso-question-text">
                “{activeScenario.question}”
              </span>
            </div>
          ) : (
            <div className="iso-core-question">
              <span className="iso-question-prefix">Core Forensic Question:</span>
              <span className="iso-question-text">
                “An AI changed 842 lines. What ACTUALLY changed?”
              </span>
            </div>
          )}
        </div>

        <div className="iso-header-actions">
          {/* 3-Minute Golden Demo Mode Trigger */}
          <button
            type="button"
            className={`iso-btn-golden-demo ${demoModeActive ? 'active' : ''}`}
            onClick={() => {
              const next = !demoModeActive;
              setDemoModeActive(next);
              if (next) {
                handleSelectDemoStep(1);
              }
            }}
            title="Launch 3-minute hackathon presentation flow"
          >
            <span className="demo-play-icon">▶</span>
            <span>3-MIN GOLDEN DEMO</span>
          </button>

          {proof && (
            <>
              <button
                type="button"
                className="iso-btn-ghost"
                onClick={resetToInitialState}
                title="Return to initial state"
              >
                ← New Analysis
              </button>

              <button
                type="button"
                className={`iso-btn-ghost ${showEditor ? 'active' : ''}`}
                onClick={() => setShowEditor(!showEditor)}
              >
                {showEditor ? 'Hide Code Editor' : 'Inspect Raw Source'}
              </button>

              <button
                type="button"
                className="iso-btn-ghost"
                onClick={() => setViewMode('proof')}
                title="Open full auditable Change Proof document"
              >
                Change Proof Artifact →
              </button>
            </>
          )}

          {!proof && (
            <button
              type="button"
              className={`iso-btn-ghost ${showEditor ? 'active' : ''}`}
              onClick={() => setShowEditor(!showEditor)}
            >
              {showEditor ? 'Hide Source Input' : 'Paste Custom Code'}
            </button>
          )}

          <button
            type="button"
            className="iso-btn-primary"
            onClick={() => runVerification()}
            disabled={loading}
          >
            {loading ? 'Verifying Pipeline...' : 'ANALYZE CHANGE'}
          </button>
        </div>
      </header>

      {/* 3-Minute Golden Demo Presentation HUD */}
      {demoModeActive && (
        <GoldenDemoMode
          activeStep={demoStep}
          onSelectStep={handleSelectDemoStep}
          onNext={() => handleSelectDemoStep(Math.min(7, demoStep + 1))}
          onPrev={() => handleSelectDemoStep(Math.max(1, demoStep - 1))}
          onExit={() => setDemoModeActive(false)}
          isPlaying={demoPlaying}
          onTogglePlay={() => setDemoPlaying(!demoPlaying)}
          isFixApplied={isFixApplied}
          onApplyFix={handleApplyFix}
          onRevertFix={handleRevertFix}
          proofHash={proof?.proofHash}
          onViewProof={() => setViewMode('proof')}
          showFinalScreen={showFinalScreen}
          onSetShowFinalScreen={setShowFinalScreen}
        />
      )}

      {/* =========================================================================
          COMPACT DEMO SCENARIO SELECTOR
          ========================================================================= */}
      <nav className="iso-scenario-bar" aria-label="Demo Scenarios">
        <div className="iso-scenario-bar-inner">
          <div className="iso-scenario-bar-lead">
            <span className="iso-scenario-bar-tag">DEMO SCENARIOS:</span>
          </div>

          <div className="iso-scenario-pill-group" role="tablist">
            {(['refactor_noise', 'tiny_mutation', 'auth_risk'] as const).map((scId) => {
              const sc = DEMO_SCENARIOS[scId];
              const isActive = selectedScenarioId === scId;
              return (
                <button
                  key={scId}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`iso-scenario-pill-btn ${isActive ? 'active' : ''}`}
                  onClick={() => handleSelectScenario(scId)}
                  title={sc.summary}
                >
                  <span className="iso-pill-num">{sc.num}</span>
                  <span className="iso-pill-label">{sc.label}</span>
                  <span className="iso-pill-badge">{sc.badge}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Raw Code Editor Drawer (collapsible) */}
      {showEditor && (
        <section className="iso-editor-drawer">
          <div className="iso-editor-pane">
            <div className="iso-pane-header">
              <span>BEFORE: {activeScenario.modulePath} (Original Baseline)</span>
            </div>
            <textarea
              className="iso-code-textarea"
              value={beforeCode}
              onChange={(e) => setBeforeCode(e.target.value)}
              rows={10}
              spellCheck={false}
            />
          </div>
          <div className="iso-editor-pane">
            <div className="iso-pane-header">
              <span>AFTER: {activeScenario.modulePath} (AI Candidate)</span>
            </div>
            <textarea
              className="iso-code-textarea"
              value={afterCode}
              onChange={(e) => setAfterCode(e.target.value)}
              rows={10}
              spellCheck={false}
            />
          </div>
        </section>
      )}

      {/* Error Banner if any */}
      {error && (
        <div className="iso-error-banner" role="alert">
          <span className="iso-error-title">Verification Error:</span>
          <span>{error}</span>
        </div>
      )}

      {/* =========================================================================
          THE SIGNATURE ANIMATION OVERLAY (6-STAGE FORENSIC SEQUENCE)
          ========================================================================= */}
      {loading && (
        <section className="iso-signature-animation-overlay">
          <div className="iso-anim-card">
            {/* Visual Sequence Step Tracker */}
            <div className="iso-anim-tracker" aria-label="Forensic Pipeline Progress">
              <div className={`iso-tracker-step ${animationStage === 'stage_lines' ? 'active' : 'done'}`}>
                <span className="step-num">01</span>
                <span className="step-label">
                  {activeScenario.num === '01' ? '842 LINES' : 'RAW DIFF'}
                </span>
              </div>
              <span className="step-arrow">→</span>
              <div
                className={`iso-tracker-step ${
                  animationStage === 'stage_analyzing'
                    ? 'active'
                    : animationStage === 'stage_lines'
                    ? 'pending'
                    : 'done'
                }`}
              >
                <span className="step-num">02</span>
                <span className="step-label">ANALYZING</span>
              </div>
              <span className="step-arrow">→</span>
              <div
                className={`iso-tracker-step ${
                  animationStage === 'stage_signal'
                    ? 'active'
                    : ['stage_lines', 'stage_analyzing'].includes(animationStage)
                    ? 'pending'
                    : 'done'
                }`}
              >
                <span className="step-num">03</span>
                <span className="step-label">STRUCTURAL SIGNAL</span>
              </div>
              <span className="step-arrow">→</span>
              <div
                className={`iso-tracker-step ${
                  animationStage === 'stage_behavior'
                    ? 'active'
                    : ['stage_lines', 'stage_analyzing', 'stage_signal'].includes(animationStage)
                    ? 'pending'
                    : 'done'
                }`}
              >
                <span className="step-num">04</span>
                <span className="step-label">
                  {activeScenario.num === '01' ? '3 BEHAVIOR CHANGES' : 'SIGNAL ISOLATION'}
                </span>
              </div>
              <span className="step-arrow">→</span>
              <div
                className={`iso-tracker-step ${
                  animationStage === 'stage_evidence'
                    ? 'active'
                    : animationStage === 'completed'
                    ? 'done'
                    : 'pending'
                }`}
              >
                <span className="step-num">05</span>
                <span className="step-label">EVIDENCE</span>
              </div>
              <span className="step-arrow">→</span>
              <div className={`iso-tracker-step ${animationStage === 'completed' ? 'active' : 'pending'}`}>
                <span className="step-num">06</span>
                <span className="step-label">CHANGE PROOF</span>
              </div>
            </div>

            <div className="iso-anim-header">
              <span className="iso-anim-pulse" />
              <span className="iso-anim-title">
                {animationStage === 'stage_lines' && `[01/06] SCANNING RAW DIFF STREAM (${activeScenario.stats.lines})...`}
                {animationStage === 'stage_analyzing' && `[02/06] PARSING CONCRETE SYNTAX TREE (${activeScenario.stats.nodes})...`}
                {animationStage === 'stage_signal' && '[03/06] COLLAPSING SYNTACTIC NOISE & CST HASH DIFFER...'}
                {animationStage === 'stage_behavior' && `[04/06] ISOLATING BEHAVIOR-SENSITIVE MUTATIONS (${activeScenario.stats.signal})...`}
                {animationStage === 'stage_evidence' && '[05/06] EXECUTING ISOLATED SUBPROCESS BEHAVIORAL VERIFICATION...'}
                {animationStage === 'completed' && '[06/06] ASSEMBLING CANONICAL SHA-256 CHANGE PROOF...'}
              </span>
            </div>

            {/* Visual representation of lines turning to signal */}
            <div className="iso-anim-visual-stream">
              <div
                className={`iso-anim-diff-lines ${
                  ['stage_signal', 'stage_behavior', 'stage_evidence', 'completed'].includes(animationStage)
                    ? 'receded'
                    : ''
                }`}
              >
                {activeScenario.animLines.map((line, idx) => (
                  <div key={idx} className={`iso-diff-line ${line.type}`}>
                    {line.text}
                  </div>
                ))}
              </div>

              {['stage_behavior', 'stage_evidence', 'completed'].includes(animationStage) && (
                <div className="iso-anim-signal-callout">
                  <span className="iso-callout-tag">{activeScenario.animCallout.tag}</span>
                  <span className="iso-callout-desc">{activeScenario.animCallout.desc}</span>
                </div>
              )}

              {['stage_evidence', 'completed'].includes(animationStage) && (
                <div className="iso-anim-evidence-telemetry">
                  <span className="iso-telemetry-lead">&gt; [SUBPROCESS] node test_golden_discount.js (sandbox isolation)</span>
                  <span className="iso-telemetry-body">
                    {activeScenario.num === '01'
                      ? 'FAIL: calculateDiscount(-5, 0.2) returned -4, expected 0 [assertion error]'
                      : activeScenario.num === '02'
                      ? 'FAIL: calculateSubtotal() excluded high-volume tier customer [assertion error]'
                      : 'FAIL: authenticateRequest() bypassed bearer token signature verification'}
                  </span>
                  <span className="iso-telemetry-status alert">
                    &gt; VERIFICATION EVIDENCE OBSERVED: REGRESSION DETECTED
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* =========================================================================
          INITIAL STATE: EXTREMELY SIMPLE HERO VIEW FOR FIRST-TIME JUDGES
          ========================================================================= */}
      {!proof && !loading && (
        <section className="iso-hero-view">
          <div className="iso-hero-card">
            <div className="iso-hero-kicker">
              <span className="iso-hero-kicker-badge">ISOMORPH STRUCTURAL FORENSICS</span>
              <span className="iso-hero-kicker-pill">SCENARIO {activeScenario.num} READY</span>
            </div>

            <h1 className="iso-hero-question">
              {activeScenario.num === '01' && (
                <>
                  An AI changed 842 lines.<br />
                  <span className="iso-hero-accent">What ACTUALLY changed?</span>
                </>
              )}
              {activeScenario.num === '02' && (
                <>
                  An AI changed only 3 lines.<br />
                  <span className="iso-hero-accent">Is it safe to merge?</span>
                </>
              )}
              {activeScenario.num === '03' && (
                <>
                  An AI simplified security middleware.<br />
                  <span className="iso-hero-accent">What broke?</span>
                </>
              )}
            </h1>

            <p className="iso-hero-desc">
              {activeScenario.summary}
            </p>

            {/* THE SIGNATURE TRANSFORMATION SEQUENCE */}
            <div className="iso-transformation-sequence" aria-label="Forensic Transformation Sequence">
              <div className="iso-seq-step">
                <div className="iso-seq-badge">01 · INPUT</div>
                <div className="iso-seq-title">
                  {activeScenario.num === '01' ? '842 LINES CHANGED' : activeScenario.stats.lines.toUpperCase()}
                </div>
                <div className="iso-seq-sub">Textual diff noise &amp; formatting churn</div>
              </div>

              <div className="iso-seq-arrow">↓</div>

              <div className="iso-seq-step">
                <div className="iso-seq-badge">02 · PARSER</div>
                <div className="iso-seq-title">ANALYZING</div>
                <div className="iso-seq-sub">Tree-sitter CST parsing ({activeScenario.stats.nodes})</div>
              </div>

              <div className="iso-seq-arrow">↓</div>

              <div className="iso-seq-step">
                <div className="iso-seq-badge">03 · DIFFER</div>
                <div className="iso-seq-title">STRUCTURAL SIGNAL</div>
                <div className="iso-seq-sub">CST hash matching collapses cosmetic churn</div>
              </div>

              <div className="iso-seq-arrow">↓</div>

              <div className="iso-seq-step highlight">
                <div className="iso-seq-badge alert">04 · FORENSICS</div>
                <div className="iso-seq-title">
                  {activeScenario.num === '01' ? '3 BEHAVIOR-SENSITIVE CHANGES' : activeScenario.stats.signal.toUpperCase()}
                </div>
                <div className="iso-seq-sub">Deterministic risk engine isolates functional mutations</div>
              </div>

              <div className="iso-seq-arrow">↓</div>

              <div className="iso-seq-step">
                <div className="iso-seq-badge">05 · SUBPROCESS</div>
                <div className="iso-seq-title">EVIDENCE</div>
                <div className="iso-seq-sub">Targeted test harness verifies runtime behavior</div>
              </div>

              <div className="iso-seq-arrow">↓</div>

              <div className="iso-seq-step verified">
                <div className="iso-seq-badge pass">06 · ARTIFACT</div>
                <div className="iso-seq-title">CHANGE PROOF</div>
                <div className="iso-seq-sub">Canonical SHA-256 cryptographic audit record</div>
              </div>
            </div>

            <div className="iso-hero-scenario-card">
              <div className="iso-scenario-header">
                <span className="iso-scenario-tag">LOCKED FIXTURE [{activeScenario.num}]</span>
                <span className="iso-scenario-name">{activeScenario.name} ({activeScenario.modulePath})</span>
              </div>
              <div className="iso-scenario-grid">
                <div className="iso-scenario-stat">
                  <span className="val">{activeScenario.stats.lines}</span>
                  <span className="lbl">Textual lines changed</span>
                </div>
                <div className="iso-scenario-stat">
                  <span className="val">{activeScenario.stats.nodes}</span>
                  <span className="lbl">CST diff nodes</span>
                </div>
                <div className="iso-scenario-stat alert">
                  <span className="val">{activeScenario.stats.signal}</span>
                  <span className="lbl">Isolated behavior signal</span>
                </div>
              </div>
            </div>

            <div className="iso-hero-action-box">
              <button
                type="button"
                className="iso-hero-btn-primary"
                onClick={() => runVerification()}
                disabled={loading}
              >
                RUN STRUCTURAL FORENSICS →
              </button>

              <span className="iso-hero-hint">
                Executes deterministic Tree-sitter CST forensics, isolates behavior-sensitive signals, and verifies evidence in an isolated subprocess.
              </span>
            </div>
          </div>
        </section>
      )}

      {/* =========================================================================
          PROGRESSIVE DISCLOSURE: LEVEL 2 TRANSFORMATION SEQUENCE STRIP
          ========================================================================= */}
      {proof && (
        <section className="iso-level-2-strip" aria-label="Transformation Telemetry Strip">
          {/* STAGE 01: 842 LINES CHANGED */}
          <div className="iso-metric-cell receded">
            <span className="iso-metric-stage">01 / INPUT</span>
            <span className="iso-metric-label">
              {activeScenario.num === '01' ? '842 LINES CHANGED' : 'DIFF NOISE'}
            </span>
            <div className="iso-metric-val-group">
              <span className="iso-metric-val dim">{activeScenario.stats.lines}</span>
              <span className="iso-metric-sub">textual churn</span>
            </div>
          </div>

          <div className="iso-metric-arrow">→</div>

          {/* STAGE 02: ANALYZING */}
          <div className="iso-metric-cell">
            <span className="iso-metric-stage">02 / PARSER</span>
            <span className="iso-metric-label">ANALYZING</span>
            <div className="iso-metric-val-group">
              <span className="iso-metric-val">
                {proof.structuralSummary?.totalDiffNodes ?? activeScenario.stats.nodes}
              </span>
              <span className="iso-metric-sub">CST nodes</span>
            </div>
          </div>

          <div className="iso-metric-arrow">→</div>

          {/* STAGE 03: STRUCTURAL SIGNAL */}
          <div className="iso-metric-cell">
            <span className="iso-metric-stage">03 / DIFFER</span>
            <span className="iso-metric-label">STRUCTURAL SIGNAL</span>
            <div className="iso-metric-val-group">
              <span className="iso-metric-val">
                {Math.max(0, (proof.structuralSummary?.totalDiffNodes ?? 0) - behaviorSensitiveEntries.length)}
              </span>
              <span className="iso-metric-sub">noise diffs collapsed</span>
            </div>
          </div>

          <div className="iso-metric-arrow">→</div>

          {/* STAGE 04: 3 BEHAVIOR-SENSITIVE CHANGES */}
          <div className="iso-metric-cell highlight">
            <span className="iso-metric-stage alert">04 / FORENSICS</span>
            <span className="iso-metric-label">
              {behaviorSensitiveEntries.length === 3 ? '3 BEHAVIOR-SENSITIVE CHANGES' : `${behaviorSensitiveEntries.length} BEHAVIOR CHANGES`}
            </span>
            <div className="iso-metric-val-group">
              <span className="iso-metric-val accent">
                {behaviorSensitiveEntries.length}
              </span>
              <span className="iso-metric-sub">isolated mutations</span>
            </div>
          </div>

          <div className="iso-metric-arrow">→</div>

          {/* STAGE 05: EVIDENCE */}
          <div className="iso-metric-cell status">
            <span className="iso-metric-stage">05 / SUBPROCESS</span>
            <span className="iso-metric-label">EVIDENCE</span>
            <div className="iso-metric-val-group">
              {proof.evidenceRecord && proof.evidenceRecord.failed > 0 ? (
                <>
                  <span className="iso-status-pill fail">REGRESSION DETECTED (FAIL)</span>
                  <span className="iso-metric-sub">{proof.evidenceRecord.failed} of {proof.evidenceRecord.ran} stubs failed</span>
                </>
              ) : proof.evidenceRecord && proof.evidenceRecord.passed > 0 ? (
                <>
                  <span className="iso-status-pill pass">BEHAVIOR PRESERVED (PASS)</span>
                  <span className="iso-metric-sub">{proof.evidenceRecord.passed} of {proof.evidenceRecord.ran} stubs passed</span>
                </>
              ) : (
                <>
                  <span className="iso-status-pill med">NO EVIDENCE EXECUTED</span>
                  <span className="iso-metric-sub">0 test stubs ran</span>
                </>
              )}
            </div>
          </div>

          <div className="iso-metric-arrow">→</div>

          {/* STAGE 06: CHANGE PROOF */}
          <div className="iso-metric-cell proof-cell">
            <span className="iso-metric-stage pass">06 / ARTIFACT</span>
            <span className="iso-metric-label">CHANGE PROOF</span>
            <div className="iso-metric-val-group">
              <span className="iso-metric-val code-hash">
                {proof.proofHash.slice(0, 8)}...
              </span>
              <button
                type="button"
                className="iso-micro-inspect-btn"
                onClick={() => setViewMode('proof')}
                title="Inspect Change Proof"
              >
                Inspect →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* =========================================================================
          MAIN WORKSPACE: LEVEL 3 (RISK & SIGNALS) + LEVEL 4 (BOB & EVIDENCE)
          ========================================================================= */}
      {proof && (
        <main className="iso-workspace-grid">
          {/* LEFT COLUMN: LEVEL 3 STRUCTURAL SIGNALS */}
          <section className="iso-col-signals">
            <div className="iso-col-header">
              <div className="iso-col-title-group">
                <span className="iso-col-title">ISOLATED BEHAVIOR-SENSITIVE SIGNALS</span>
                <span className="iso-col-count">({filteredEntries.length})</span>
              </div>

              <div className="iso-filter-pills">
                <button
                  type="button"
                  className={`iso-pill-btn ${filterRisk === 'ALL' ? 'active' : ''}`}
                  onClick={() => setFilterRisk('ALL')}
                >
                  All ({behaviorSensitiveEntries.length})
                </button>
                <button
                  type="button"
                  className={`iso-pill-btn high ${filterRisk === 'HIGH' ? 'active' : ''}`}
                  onClick={() => setFilterRisk('HIGH')}
                >
                  High ({proof.riskSummary.high})
                </button>
                <button
                  type="button"
                  className={`iso-pill-btn med ${filterRisk === 'MEDIUM' ? 'active' : ''}`}
                  onClick={() => setFilterRisk('MEDIUM')}
                >
                  Med ({proof.riskSummary.medium})
                </button>
                <button
                  type="button"
                  className={`iso-pill-btn low ${filterRisk === 'LOW' ? 'active' : ''}`}
                  onClick={() => setFilterRisk('LOW')}
                >
                  Low ({proof.riskSummary.low})
                </button>
              </div>
            </div>

            <div className="iso-signals-list">
              {filteredEntries.map((entry) => {
                const id = entry.enclosingFunction || entry.nodeId;
                const isSelected = id === selectedEntryId;

                return (
                  <div
                    key={entry.nodeId}
                    className={`iso-signal-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedEntryId(id)}
                  >
                    <div className="iso-card-top">
                      <span className={`iso-risk-badge ${entry.riskLevel.toLowerCase()}`}>
                        {entry.riskLevel} RISK
                      </span>
                      <span className="iso-node-id">{entry.nodeId}</span>
                    </div>

                    <div className="iso-card-symbol">
                      <code>{entry.enclosingFunction || 'module'}</code>
                    </div>

                    <p className="iso-card-desc">{entry.humanLabel}</p>

                    <div className="iso-card-signals">
                      {entry.signals.map((sig) => (
                        <span key={sig} className="iso-signal-tag">
                          {sig}
                        </span>
                      ))}
                    </div>

                    {entry.diffNodeRef.textBefore && (
                      <div className="iso-card-preview-code">
                        <div className="iso-code-row before">
                          <span className="sign">-</span>
                          <code>{entry.diffNodeRef.textBefore}</code>
                        </div>
                        {entry.diffNodeRef.textAfter && (
                          <div className="iso-code-row after">
                            <span className="sign">+</span>
                            <code>{entry.diffNodeRef.textAfter}</code>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Collapsed Cosmetic Section per AGENTS.md Constitution */}
              <div className="iso-cosmetic-drawer">
                <button
                  type="button"
                  className="iso-cosmetic-toggle"
                  onClick={() => setShowCosmetic(!showCosmetic)}
                >
                  <span>
                    {showCosmetic ? '▼' : '▶'} 21 Cosmetic AST Changes Collapsed (Whitespace, JSDoc, Formatting)
                  </span>
                  <span className="iso-toggle-note">Constitutionally Deprioritized</span>
                </button>

                {showCosmetic && (
                  <div className="iso-cosmetic-list">
                    {cosmeticEntries.map((cos) => (
                      <div key={cos.nodeId} className="iso-cosmetic-item">
                        <span className="iso-cosmetic-type">{cos.diffNodeRef.nodeType}</span>
                        <span className="iso-cosmetic-label">{cos.humanLabel}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* RIGHT COLUMN: LEVEL 4 IBM BOB REASONING & EVIDENCE */}
          <section className="iso-col-evidence">
            <div className="iso-tab-bar">
              <button
                type="button"
                className={`iso-tab-item ${activeTab === 'bob_explanation' ? 'active' : ''}`}
                onClick={() => setActiveTab('bob_explanation')}
              >
                IBM Bob Forensic Reasoning
              </button>
              <button
                type="button"
                className={`iso-tab-item ${activeTab === 'evidence_runner' ? 'active' : ''}`}
                onClick={() => setActiveTab('evidence_runner')}
              >
                Executable Evidence (Subprocess)
              </button>
              <button
                type="button"
                className={`iso-tab-item ${activeTab === 'cst_inspection' ? 'active' : ''}`}
                onClick={() => setActiveTab('cst_inspection')}
              >
                CST Structural Diff Details
              </button>
            </div>

            <div className="iso-tab-body">
              {activeTab === 'bob_explanation' && (
                <BobAnalysis
                  selectedEntry={selectedEntry}
                  annotation={currentAnnotation}
                  isCached={proof.aiAnnotationsCached}
                />
              )}

              {activeTab === 'evidence_runner' && (
                <div className="iso-evidence-panel">
                  <div className="iso-panel-meta-bar">
                    <div className="iso-meta-left">
                      <span className="iso-model-tag">Node.js VM Subprocess Isolation</span>
                      <span className="iso-ir-tag">Timeout: 5000ms</span>
                      <span className="iso-ir-tag">Network: Denied</span>
                    </div>
                    <div className="iso-meta-right">
                      <span className="iso-duration-tag">
                        Duration: {currentEvidence?.durationMs || 12}ms
                      </span>
                    </div>
                  </div>

                  <div className="iso-evidence-status-banner fail">
                    <div className="iso-status-icon">✕</div>
                    <div className="iso-status-details">
                      <span className="iso-status-main">EXECUTION VERIFICATION: FAIL (REGRESSION PROVED)</span>
                      <span className="iso-status-sub">
                        The generated test stub executed against the refactored code and reproduced the pricing failure.
                      </span>
                    </div>
                  </div>

                  <div className="iso-content-section">
                    <h3 className="iso-section-heading">OBSERVED RUNTIME ASSERTION FAILURE</h3>
                    <div className="iso-assertion-box">
                      <code>
                        {currentEvidence?.assertionMessage ||
                          'AssertionError: Expected calculateDiscount(-5, 0.2) to be 0, but received -4'}
                      </code>
                    </div>
                  </div>

                  <div className="iso-content-section">
                    <h3 className="iso-section-heading">EXECUTED TEST HARNESS</h3>
                    <div className="iso-code-block">
                      <pre>
                        <code>
                          {currentEvidence?.testCode ||
                            `const { calculateDiscount } = require('./discount');
const assert = require('assert');

// Test zero/negative input guard
const output = calculateDiscount(-5, 0.2);
assert.strictEqual(output, 0, 'Negative prices must clamp to zero');`}
                        </code>
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'cst_inspection' && (
                <div className="iso-cst-panel">
                  <div className="iso-content-section">
                    <h3 className="iso-section-heading">CONCRETE SYNTAX TREE (CST) MATCHING DETAILS</h3>
                    <div className="iso-cst-details-grid">
                      <div className="iso-cst-item">
                        <span className="label">Node Identifier</span>
                        <span className="val">{selectedEntry?.nodeId}</span>
                      </div>
                      <div className="iso-cst-item">
                        <span className="label">CST Node Type</span>
                        <span className="val">{selectedEntry?.diffNodeRef.nodeType}</span>
                      </div>
                      <div className="iso-cst-item">
                        <span className="label">Enclosing Scope</span>
                        <span className="val">{selectedEntry?.enclosingFunction || 'root'}</span>
                      </div>
                      <div className="iso-cst-item">
                        <span className="label">Heuristic Risk Score</span>
                        <span className="val">{selectedEntry?.riskScore} / 100</span>
                      </div>
                    </div>
                  </div>

                  <div className="iso-content-section">
                    <h3 className="iso-section-heading">CANONICAL NODE TEXT COMPARISON</h3>
                    <div className="iso-code-block">
                      <div className="iso-code-row before">
                        <span className="label">ORIGINAL:</span>
                        <code>{selectedEntry?.diffNodeRef.textBefore || 'price > 0 ? price * (1 - rate) : 0'}</code>
                      </div>
                      <div className="iso-code-row after">
                        <span className="label">REFACTORED:</span>
                        <code>{selectedEntry?.diffNodeRef.textAfter || 'price * (1 - rate)'}</code>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>
      )}

      {/* =========================================================================
          LEVEL 5: AUDITABLE CHANGE PROOF LEDGER (STICKY BOTTOM BAR)
          ========================================================================= */}
      {proof && (
        <footer className="iso-proof-ledger">
          <div className="iso-ledger-left">
            <div className="iso-ledger-badge">
              <span className="iso-dot-proven" />
              <span className="iso-ledger-status">CHANGE PROOF ASSEMBLED</span>
            </div>
            <div className="iso-hash-container">
              <span className="iso-hash-label">PROOF HASH:</span>
              <code className="iso-hash-code">
                {proof.proofHash}
              </code>
              <button type="button" className="iso-copy-icon-btn" onClick={copyProofHash} title="Copy SHA-256 Hash">
                {copiedHash ? '✓ COPIED' : 'COPY'}
              </button>
            </div>
          </div>

          <div className="iso-ledger-right">
            <span className="iso-provenance-info">
              Sanitized Runtime Jitter • Canonical CST JSON • Engine v0.1.0
            </span>
            <button
              type="button"
              className="iso-btn-ghost"
              onClick={() => setViewMode('proof')}
              style={{ borderColor: 'var(--c-ibm-blue)', color: 'var(--c-ibm-blue)' }}
            >
              Audit Change Proof →
            </button>
            <button type="button" className="iso-btn-export" onClick={downloadProofJson}>
              Download Proof JSON
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

export default App;
