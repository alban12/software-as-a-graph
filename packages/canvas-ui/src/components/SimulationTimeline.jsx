import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, X, Info, CheckCircle2, AlertCircle, Sparkles, Zap, HardDrive, Cpu } from 'lucide-react';

export default function SimulationTimeline({
  simulation,
  currentStepIndex,
  onStepChange,
  onClose,
  onExportTest,
  onOpenProfiler,
  isPlaying,
  setIsPlaying
}) {
  if (!simulation || !simulation.steps?.length) return null;

  const [showDetails, setShowDetails] = useState(true);
  const currentStep = simulation.steps[currentStepIndex] || simulation.steps[0];
  const totalSteps = simulation.steps.length;

  // Auto-advance when playing
  useEffect(() => {
    let timer = null;
    if (isPlaying) {
      timer = setInterval(() => {
        onStepChange((prev) => {
          if (prev < totalSteps - 1) {
            return prev + 1;
          } else {
            setIsPlaying(false);
            return prev;
          }
        });
      }, 1400);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, totalSteps, onStepChange, setIsPlaying]);

  const handlePrev = () => {
    setIsPlaying(false);
    if (currentStepIndex > 0) onStepChange(currentStepIndex - 1);
  };

  const handleNext = () => {
    setIsPlaying(false);
    if (currentStepIndex < totalSteps - 1) onStepChange(currentStepIndex + 1);
  };

  const handleReset = () => {
    setIsPlaying(false);
    onStepChange(0);
  };

  return (
    <div className="simulation-timeline-container">
      {/* Floating Scrubber Bar */}
      <div className="timeline-bar glass-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="scenario-tag">
            <Sparkles size={13} color="var(--color-accent)" />
            <span>{simulation.title}</span>
          </div>

          <div className="playback-controls">
            <button className="ctrl-btn" onClick={handleReset} title="Reset to step 1">
              <RotateCcw size={14} />
            </button>
            <button className="ctrl-btn" onClick={handlePrev} disabled={currentStepIndex === 0} title="Previous step">
              <SkipBack size={14} />
            </button>
            <button
              className="ctrl-btn play-btn"
              onClick={() => setIsPlaying(!isPlaying)}
              title={isPlaying ? "Pause simulation" : "Play simulation"}
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button className="ctrl-btn" onClick={handleNext} disabled={currentStepIndex === totalSteps - 1} title="Next step">
              <SkipForward size={14} />
            </button>
          </div>
        </div>

        {/* Step Pills */}
        <div className="timeline-steps">
          {simulation.steps.map((step, idx) => {
            const isActive = idx === currentStepIndex;
            const isPassed = idx < currentStepIndex;
            const isError = step.status === 'error';

            let pillClass = 'step-pill';
            if (isActive) pillClass += isError ? ' active-error' : ' active';
            else if (isPassed) pillClass += ' passed';

            return (
              <div
                key={idx}
                className={pillClass}
                onClick={() => {
                  setIsPlaying(false);
                  onStepChange(idx);
                }}
                title={step.explanation}
              >
                <span className="step-num">{idx + 1}</span>
                <span className="step-name">{step.title}</span>
                {step.perfMetrics?.latencyMs !== undefined && (
                  <span className={`step-latency-badge ${step.perfMetrics.latencyMs > 250 ? 'bottleneck' : ''}`}>
                    {step.perfMetrics.latencyMs > 250 ? '⏳' : '⚡'}{step.perfMetrics.latencyMs}ms
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn-pill"
            style={{ padding: '5px 10px', fontSize: '11px', borderColor: '#f59e0b', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 5 }}
            onClick={onOpenProfiler}
            title="Open Dataflow Performance & Latency Waterfall Profiler"
          >
            <Zap size={13} color="#f59e0b" />
            <span>Profiler</span>
          </button>

          <button
            className="btn-pill"
            style={{ padding: '5px 10px', fontSize: '11px', borderColor: 'var(--color-viewmodel)', color: 'var(--color-viewmodel)' }}
            onClick={onExportTest}
            title="Export verified trace as native Apple Swift Testing code"
          >
            <span>Export Swift Test</span>
          </button>

          <button
            className={`btn-pill ${showDetails ? 'primary' : ''}`}
            style={{ padding: '5px 10px', fontSize: '11px' }}
            onClick={() => setShowDetails(!showDetails)}
          >
            <Info size={13} />
            <span>Trace Inspector</span>
          </button>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
            title="Exit simulation"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Slide-Up Trace Inspector Details */}
      {showDetails && currentStep && (
        <div className="trace-details-card glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px', fontWeight: 600 }}>
              {currentStep.status === 'error' ? (
                <AlertCircle size={15} color="var(--color-danger)" />
              ) : (
                <CheckCircle2 size={15} color="var(--color-success)" />
              )}
              <span>Step {currentStepIndex + 1}: {currentStep.title}</span>
            </div>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              Node: <strong style={{ color: 'var(--text-primary)' }}>{currentStep.activeNodeId}</strong>
            </span>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '4px 0' }}>
            {currentStep.explanation}
          </div>

          {/* Performance Telemetry Row */}
          {currentStep.perfMetrics && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(15, 23, 42, 0.6)', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', border: '1px solid rgba(255,255,255,0.06)', margin: '4px 0' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: currentStep.perfMetrics.latencyMs > 250 ? '#f43f5e' : '#10b981', fontWeight: 600 }}>
                <Zap size={12} />
                Latency: {currentStep.perfMetrics.latencyMs} ms {currentStep.perfMetrics.isCriticalPath ? '🔥 (Critical Path Bottleneck)' : ''}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#c084fc' }}>
                <HardDrive size={12} />
                Memory Delta: {currentStep.perfMetrics.memoryDeltaMb > 0 ? `+${currentStep.perfMetrics.memoryDeltaMb}` : currentStep.perfMetrics.memoryDeltaMb} MB
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
                <Cpu size={12} />
                CPU Time: {currentStep.perfMetrics.cpuTimeMs} ms
              </span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 6 }}>
            {/* Intermediate Payload */}
            <div className="trace-box">
              <span className="box-title">Socket Payload</span>
              <pre className="code-pre">
                {JSON.stringify(currentStep.payload, null, 2)}
              </pre>
            </div>

            {/* State Mutations */}
            <div className="trace-box">
              <span className="box-title">Mutated State</span>
              {Object.keys(currentStep.mutations || {}).length > 0 ? (
                <pre className="code-pre" style={{ color: '#f59e0b' }}>
                  {JSON.stringify(currentStep.mutations, null, 2)}
                </pre>
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', padding: 8 }}>
                  No state mutated in this step
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
