import React, { useState } from 'react';
import { X, Zap, Cpu, HardDrive, AlertTriangle, Sparkles, Copy, Check, Clock, TrendingUp } from 'lucide-react';

export default function PerformanceProfilingModal({ isOpen, onClose, steps = [], graph = {} }) {
  if (!isOpen) return null;

  const [copied, setCopied] = useState(false);

  // Compute aggregate performance metrics
  const totalDuration = steps.reduce((sum, s) => sum + (s.perfMetrics?.latencyMs || 0), 0);
  const totalCpuTime = steps.reduce((sum, s) => sum + (s.perfMetrics?.cpuTimeMs || 0), 0);
  const peakMemoryDelta = steps.reduce((max, s) => Math.max(max, s.perfMetrics?.memoryDeltaMb || 0), 0);

  // Identify critical path step
  const bottleneckStep = steps.reduce((worst, s) => {
    if (!worst || (s.perfMetrics?.latencyMs || 0) > (worst.perfMetrics?.latencyMs || 0)) {
      return s;
    }
    return worst;
  }, null);

  const bottleneckPercent = totalDuration > 0 && bottleneckStep?.perfMetrics?.latencyMs
    ? Math.round((bottleneckStep.perfMetrics.latencyMs / totalDuration) * 100)
    : 0;

  // Gather retain cycle risks from all nodes in graph
  const retainRisks = [];
  Object.values(graph?.nodes || {}).forEach(node => {
    if (node.perfMeta?.retainCycleRisks?.length) {
      node.perfMeta.retainCycleRisks.forEach(risk => {
        retainRisks.push({
          nodeId: node.id,
          nodeName: node.name,
          filePath: node.sourceAnchor?.filePath || 'Sources/AuthSample',
          ...risk
        });
      });
    }
  });

  const optimizationPrompt = `### 🚀 SaaG Performance Optimization Directive
**Target System**: ${graph?.metadata?.projectName || 'AuthSample'}
**Bottleneck Profile**:
- **Total Flow Duration**: ${totalDuration} ms
- **Critical Path Bottleneck**: ${bottleneckStep?.title || 'External Service'} (${bottleneckStep?.perfMetrics?.latencyMs || 0} ms, ${bottleneckPercent}% of flow)
- **Peak Memory Delta**: +${peakMemoryDelta.toFixed(1)} MB

#### 1. Latency Optimization:
Component \`${bottleneckStep?.activeNodeId}\` is on the critical execution path.
- **Action**: Implement asynchronous local cache invalidation, request coalescing, or background prefetching to reduce latency below 100ms.

${retainRisks.length > 0 ? `#### 2. Retain Cycle & Memory Leak Fixes:
${retainRisks.map(r => `- **File**: \`${r.filePath}:${r.line}\` (${r.symbol})
  - **Issue**: ${r.description}
  - **Remediation**: ${r.suggestion}`).join('\n')}` : ''}

Please apply minimal non-breaking refactoring to solve these identified performance bottlenecks.`;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(optimizationPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Dataflow Performance & Resource Profiler
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Telemetry Active
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Waterfall Execution Latency, Memory Footprint & AST Static Retain Cycle Analysis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          
          {/* KPI Dashboard Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3.5 flex flex-col">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                Total Duration
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className={`text-2xl font-bold ${totalDuration > 250 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {totalDuration}
                </span>
                <span className="text-xs text-slate-400">ms</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1">
                {steps.length} sequential execution steps
              </span>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3.5 flex flex-col">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-purple-400" />
                Peak Memory Delta
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className={`text-2xl font-bold ${peakMemoryDelta > 10 ? 'text-rose-400' : 'text-purple-400'}`}>
                  +{peakMemoryDelta.toFixed(1)}
                </span>
                <span className="text-xs text-slate-400">MB</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1">
                Net allocation during flow
              </span>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3.5 flex flex-col">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
                Critical Bottleneck
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-rose-400 truncate" title={bottleneckStep?.title}>
                  {bottleneckStep?.activeNodeId ? graph?.nodes?.[bottleneckStep.activeNodeId]?.name || bottleneckStep.activeNodeId : 'None'}
                </span>
              </div>
              <span className="text-[11px] text-rose-300/80 mt-1">
                {bottleneckStep?.perfMetrics?.latencyMs || 0} ms ({bottleneckPercent}% of flow)
              </span>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3.5 flex flex-col">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Retain Cycle Risks
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className={`text-2xl font-bold ${retainRisks.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {retainRisks.length}
                </span>
                <span className="text-xs text-slate-400">detected</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1">
                Swift AST Static Analysis
              </span>
            </div>
          </div>

          {/* Execution Waterfall Chart */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-400" />
                Step Latency Waterfall Breakdown
              </h3>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> &lt;50ms
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> 50–250ms
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span> &gt;250ms (Bottleneck)
                </span>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              {steps.map((step, idx) => {
                const latency = step.perfMetrics?.latencyMs || 0;
                const percentage = totalDuration > 0 ? Math.max(2, (latency / totalDuration) * 100) : 5;
                const isCrit = step.perfMetrics?.isCriticalPath || latency > 250;
                const barColor = latency > 250 ? 'bg-rose-500' : latency > 50 ? 'bg-amber-500' : 'bg-emerald-500';
                const nodeName = graph?.nodes?.[step.activeNodeId]?.name || step.activeNodeId;

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-mono text-slate-400">#{step.stepIndex + 1}</span>
                        <span className="font-semibold text-slate-200">{nodeName}</span>
                        <span className="text-slate-400 truncate">— {step.title}</span>
                      </div>
                      <div className="flex items-center gap-3 font-mono shrink-0">
                        {step.perfMetrics?.memoryDeltaMb && (
                          <span className={`text-[11px] ${step.perfMetrics.memoryDeltaMb > 0 ? 'text-purple-400' : 'text-slate-400'}`}>
                            {step.perfMetrics.memoryDeltaMb > 0 ? `+${step.perfMetrics.memoryDeltaMb}MB` : `${step.perfMetrics.memoryDeltaMb}MB`}
                          </span>
                        )}
                        <span className={`font-bold ${isCrit ? 'text-rose-400' : 'text-slate-300'}`}>
                          {latency} ms
                        </span>
                        {isCrit && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            Critical
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Bar visualization */}
                    <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex">
                      <div
                        className={`h-full ${barColor} transition-all duration-500 rounded-full`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Static Retain Cycle Diagnostics Card */}
          {retainRisks.length > 0 && (
            <div className="bg-amber-950/20 border border-amber-500/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Swift AST Retain Cycle Risk Diagnostics
                </h3>
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {retainRisks.length} Memory Leak Potential
                </span>
              </div>

              <div className="space-y-2 pt-1">
                {retainRisks.map((risk, idx) => (
                  <div key={idx} className="bg-slate-900/60 border border-amber-500/20 rounded p-3 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-white font-bold">{risk.symbol}</span>
                        <span className="text-slate-400">({risk.filePath}:{risk.line})</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] uppercase font-semibold">
                        {risk.severity}
                      </span>
                    </div>
                    <p className="text-slate-300">{risk.description}</p>
                    <p className="text-emerald-400/90 font-medium">💡 Recommendation: {risk.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action: Optimize with Agent */}
          <div className="bg-gradient-to-r from-blue-950/40 via-indigo-950/40 to-slate-900 border border-blue-500/30 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-blue-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  Agentic Performance Remediation
                </h3>
                <p className="text-xs text-slate-400">
                  Generate a structured optimization directive with exact code anchors for your coding agent.
                </p>
              </div>
              <button
                onClick={handleCopyPrompt}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied Directive!' : 'Optimize with Agent'}
              </button>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded p-3 text-xs font-mono text-slate-300 overflow-x-auto max-h-32">
              <pre className="whitespace-pre-wrap">{optimizationPrompt}</pre>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-900/90 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors"
          >
            Close Profiler
          </button>
        </div>

      </div>
    </div>
  );
}
