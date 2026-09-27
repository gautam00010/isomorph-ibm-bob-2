import React, { useEffect, useState, useRef } from 'react';
import './GoldenDemoMode.css';

export interface DemoStepConfig {
  step: number;
  timeRange: string;
  startSec: number;
  endSec: number;
  label: string;
  title: string;
  sub: string;
  script: string;
}

export const DEMO_STEPS: DemoStepConfig[] = [
  {
    step: 1,
    timeRange: '00:00 – 00:15',
    startSec: 0,
    endSec: 15,
    label: '01 · Problem',
    title: 'THE 842-LINE NOISE WALL',
    sub: 'An AI changed 842 lines. What actually changed?',
    script:
      '“An AI coding assistant changed 842 lines claiming to refactor for conciseness. A human reviewer cannot reliably find the regression in this wall of text diff. What actually changed?”',
  },
  {
    step: 2,
    timeRange: '00:15 – 00:35',
    startSec: 15,
    endSec: 35,
    label: '02 · Launch',
    title: 'LAUNCH ISOMORPH FORENSICS',
    sub: 'Tree-sitter CST parsing & structural differencing',
    script:
      '“We launch Isomorph. Tree-sitter parses the concrete syntax tree, builds deterministic node hashes, and diffs structurally, not textually.”',
  },
  {
    step: 3,
    timeRange: '00:35 – 01:05',
    startSec: 35,
    endSec: 65,
    label: '03 · Signal',
    title: 'NOISE → STRUCTURAL SIGNAL',
    sub: '842 textual lines collapse into 3 behavior-sensitive changes',
    script:
      '“842 lines of textual noise collapse into 3 isolated structural changes. 99% of the diff was syntactic noise: renames, whitespace, formatting. Only 3 regions alter behavior.”',
  },
  {
    step: 4,
    timeRange: '01:05 – 01:40',
    startSec: 65,
    endSec: 100,
    label: '04 · Forensics',
    title: 'HIGHEST-RISK REGION',
    sub: 'WHAT CHANGED · WHY IT MATTERS · SOURCE EVIDENCE',
    script:
      '“We inspect the highest-risk region in calculateDiscount. What changed: the negative-price guard was deleted. Why it matters: zero-dollar and negative items produce negative balances.”',
  },
  {
    step: 5,
    timeRange: '01:40 – 02:10',
    startSec: 100,
    endSec: 130,
    label: '05 · IBM Bob',
    title: 'IBM BOB CONTEXTUAL REASONING',
    sub: 'DETERMINISTIC FACT vs BOB INTERPRETATION',
    script:
      '“We consult IBM Bob. Bob receives only structured intermediate representation—never raw diff text. Bob interprets the business consequence, while deterministic facts remain cleanly separated from AI interpretation.”',
  },
  {
    step: 6,
    timeRange: '02:10 – 02:40',
    startSec: 130,
    endSec: 160,
    label: '06 · Verify',
    title: 'TARGETED VERIFICATION (FAIL → FIX → PASS)',
    sub: 'Subprocess test harness execution against unpatched and fixed candidate',
    script:
      '“Bob generated a targeted test stub. We run it in an isolated subprocess. First, it FAILS—confirming the regression is real. We restore the 1-line guard. We re-run. It PASSES. Evidence is observed, never inferred.”',
  },
  {
    step: 7,
    timeRange: '02:40 – 03:00',
    startSec: 160,
    endSec: 180,
    label: '07 · Proof',
    title: 'CHANGE PROOF & CLOSING',
    sub: 'Canonical SHA-256 reproducible evidence document',
    script:
      '“The final artifact is the Change Proof: a content-hashed, reproducible JSON evidence document. Same inputs, same hash. Isomorph: See what actually changed.”',
  },
];

interface GoldenDemoModeProps {
  activeStep: number;
  onSelectStep: (step: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onExit: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  isFixApplied: boolean;
  onApplyFix: () => void;
  onRevertFix: () => void;
  proofHash?: string;
  onViewProof: () => void;
  showFinalScreen: boolean;
  onSetShowFinalScreen: (show: boolean) => void;
}

export function GoldenDemoMode({
  activeStep,
  onSelectStep,
  onNext,
  onPrev,
  onExit,
  isPlaying,
  onTogglePlay,
  isFixApplied,
  onApplyFix,
  onRevertFix,
  proofHash,
  onViewProof,
  showFinalScreen,
  onSetShowFinalScreen,
}: GoldenDemoModeProps) {
  const [seconds, setSeconds] = useState(0);
  const currentStepConfig = DEMO_STEPS.find((s) => s.step === activeStep) || DEMO_STEPS[0];
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize timer when step changes
  useEffect(() => {
    setSeconds(currentStepConfig.startSec);
  }, [activeStep, currentStepConfig.startSec]);

  // Timer playback
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setSeconds((prev) => {
        const next = prev + 1;
        if (next >= 180) {
          onSetShowFinalScreen(true);
          return 180;
        }

        // Auto-advance step if crossing boundary
        const nextStepObj = DEMO_STEPS.find((s) => next >= s.startSec && next < s.endSec);
        if (nextStepObj && nextStepObj.step !== activeStep) {
          onSelectStep(nextStepObj.step);
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, activeStep, onSelectStep, onSetShowFinalScreen]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Final Closing Screen at 180s
  if (showFinalScreen) {
    return (
      <div className="iso-final-screen-overlay">
        <div className="iso-final-screen-card">
          <div className="iso-final-kicker">
            <span className="iso-kicker-dot" />
            <span className="iso-kicker-text">GOLDEN DEMO COMPLETE · 180 SECONDS</span>
          </div>

          <h1 className="iso-final-brand">ISOMORPH</h1>
          <p className="iso-final-tagline">See what actually changed.</p>

          <div className="iso-final-divider" />

          <div className="iso-final-summary-grid">
            <div className="iso-final-stat-box">
              <span className="label">ORIGINAL DIFF</span>
              <span className="val dim">842 lines</span>
              <span className="sub">formatting, renames &amp; noise</span>
            </div>

            <div className="iso-final-stat-box">
              <span className="label">FORENSIC SIGNAL</span>
              <span className="val highlight">3 mutations</span>
              <span className="sub">behavior-sensitive changes</span>
            </div>

            <div className="iso-final-stat-box">
              <span className="label">EVIDENCE RUNNER</span>
              <span className="val pass">FAIL → PASS</span>
              <span className="sub">verified in isolated subprocess</span>
            </div>

            <div className="iso-final-stat-box">
              <span className="label">CHANGE PROOF</span>
              <span className="val code">{proofHash ? `${proofHash.slice(0, 10)}...` : 'sha256:c4e361e9...'}</span>
              <span className="sub">canonical content hash</span>
            </div>
          </div>

          <div className="iso-final-actions">
            <button
              type="button"
              className="iso-btn-primary"
              onClick={() => {
                onSetShowFinalScreen(false);
                onSelectStep(1);
              }}
            >
              ⟲ Replay 3-Minute Golden Demo
            </button>

            <button
              type="button"
              className="iso-btn-ghost"
              onClick={() => {
                onSetShowFinalScreen(false);
                onViewProof();
              }}
            >
              Audit Full Change Proof →
            </button>

            <button
              type="button"
              className="iso-btn-ghost"
              onClick={() => {
                onSetShowFinalScreen(false);
                onExit();
              }}
            >
              Exit Demo Mode
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <aside className="iso-demo-hud" aria-label="3-Minute Golden Demo Player">
      {/* Top Telemetry & Control Bar */}
      <div className="iso-hud-top-bar">
        <div className="iso-hud-left">
          <div className="iso-hud-badge">
            <span className="iso-hud-dot" />
            <span className="iso-hud-badge-title">GOLDEN DEMO</span>
            <span className="iso-hud-badge-time">3-MIN VIDEO WALKTHROUGH</span>
          </div>

          <div className="iso-hud-timer-container">
            <span className="iso-hud-timer-val">{formatTimer(seconds)}</span>
            <span className="iso-hud-timer-total">/ 03:00</span>
          </div>

          <div className="iso-hud-playback-controls">
            <button
              type="button"
              className={`iso-hud-control-btn ${isPlaying ? 'active' : ''}`}
              onClick={onTogglePlay}
              title={isPlaying ? 'Pause Auto-Play' : 'Start Auto-Play'}
            >
              {isPlaying ? '⏸ PAUSE' : '▶ AUTO-PLAY'}
            </button>

            <button
              type="button"
              className="iso-hud-nav-btn"
              onClick={onPrev}
              disabled={activeStep <= 1}
              title="Previous Step"
            >
              ← Prev
            </button>

            <button
              type="button"
              className="iso-hud-nav-btn primary"
              onClick={onNext}
              disabled={activeStep >= 7}
              title="Next Step"
            >
              Next Step →
            </button>

            {activeStep === 7 && (
              <button
                type="button"
                className="iso-hud-nav-btn finish"
                onClick={() => onSetShowFinalScreen(true)}
              >
                Show Final Screen →
              </button>
            )}
          </div>
        </div>

        <div className="iso-hud-right">
          <button
            type="button"
            className="iso-hud-exit-btn"
            onClick={onExit}
            title="Exit Demo Mode"
          >
            ✕ Exit Demo Mode
          </button>
        </div>
      </div>

      {/* 7-Step Horizontal Timeline Track */}
      <nav className="iso-hud-timeline-track" aria-label="Demo Timeline Steps">
        {DEMO_STEPS.map((s) => {
          const isActive = s.step === activeStep;
          const isDone = s.step < activeStep;
          return (
            <button
              key={s.step}
              type="button"
              className={`iso-timeline-step-btn ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
              onClick={() => onSelectStep(s.step)}
            >
              <div className="iso-step-top">
                <span className="iso-step-num">{s.label}</span>
                <span className="iso-step-time">{s.timeRange}</span>
              </div>
              <span className="iso-step-title">{s.title}</span>
            </button>
          );
        })}
      </nav>

      {/* Presenter Teleprompter & Step Detail Strip */}
      <div className="iso-hud-script-strip">
        <div className="iso-script-left">
          <span className="iso-script-tag">PRESENTER CUE [{currentStepConfig.timeRange}]:</span>
          <p className="iso-script-text">{currentStepConfig.script}</p>
        </div>

        {/* Dynamic Action Callouts for Step 6 (FAIL -> FIX -> PASS) */}
        {activeStep === 6 && (
          <div className="iso-hud-step-action-box">
            {!isFixApplied ? (
              <div className="iso-action-fail-group">
                <span className="iso-evidence-fail-badge">❌ 1/1 SUBPROCESS STUBS FAILED</span>
                <button
                  type="button"
                  className="iso-hud-action-btn fix"
                  onClick={onApplyFix}
                  title="Restore guard clause and re-run subprocess tests"
                >
                  🛠️ RESTORE GUARD (APPLY FIX) &amp; RE-VERIFY →
                </button>
              </div>
            ) : (
              <div className="iso-action-pass-group">
                <span className="iso-evidence-pass-badge">✅ PASS: BEHAVIOR PRESERVED (1/1)</span>
                <span className="iso-pass-msg">FAIL → FIX → PASS VERIFIED</span>
                <button
                  type="button"
                  className="iso-hud-action-btn revert"
                  onClick={onRevertFix}
                  title="Re-introduce the logic mutation to re-test failure"
                >
                  ⟲ Revert Fix
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
