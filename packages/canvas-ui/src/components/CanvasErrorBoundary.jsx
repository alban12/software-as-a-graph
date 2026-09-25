import React from 'react';
import { AlertTriangle, RotateCcw, Copy, Check } from 'lucide-react';

export default class CanvasErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('🛡️ CanvasErrorBoundary caught an unhandled exception:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleCopyDiagnostics = () => {
    const { error, errorInfo } = this.state;
    const text = `SaaG Canvas Error Report\nDate: ${new Date().toISOString()}\nError: ${error?.toString()}\nComponent Stack: ${errorInfo?.componentStack || 'N/A'}`;
    navigator.clipboard?.writeText(text).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="canvas-error-boundary-overlay">
          <div className="canvas-error-boundary-card glass-panel">
            <div className="error-header">
              <div className="error-icon-box">
                <AlertTriangle size={24} color="#ef4444" />
              </div>
              <div>
                <h3 className="error-title">Canvas Renderer Interrupted</h3>
                <p className="error-subtitle">
                  An unexpected render exception occurred. The application state has been safely captured.
                </p>
              </div>
            </div>

            <div className="error-body">
              <div className="error-message-box">
                <code>{this.state.error?.toString() || 'Unknown render error'}</code>
              </div>

              {this.state.errorInfo?.componentStack && (
                <details className="error-details">
                  <summary>View Component Trace</summary>
                  <pre className="error-trace">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            <div className="error-actions">
              <button
                type="button"
                className="btn-pill primary"
                onClick={this.handleReset}
                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <RotateCcw size={14} />
                <span>Recover Canvas</span>
              </button>
              <button
                type="button"
                className="btn-pill"
                onClick={this.handleReload}
                style={{ padding: '8px 16px' }}
              >
                Reload Window
              </button>
              <button
                type="button"
                className="btn-pill subtle"
                onClick={this.handleCopyDiagnostics}
                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {this.state.copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                <span>{this.state.copied ? 'Copied' : 'Copy Diagnostics'}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
