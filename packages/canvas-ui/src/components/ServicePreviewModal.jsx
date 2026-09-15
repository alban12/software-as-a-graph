import React, { useState } from 'react';
import { X, Flame, Shield, Database, Activity, ExternalLink, RefreshCw, CheckCircle2, Key, Users, Server } from 'lucide-react';
import FirebaseLogo from './FirebaseLogo';

export default function ServicePreviewModal({ isOpen, onClose, node }) {
  if (!isOpen || !node) return null;

  const [activeTab, setActiveTab] = useState('auth'); // 'auth' | 'firestore' | 'metrics'
  const [selectedCollection, setSelectedCollection] = useState('users');
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState(null);

  const service = node.serviceMeta || {
    serviceType: 'firebase',
    provider: 'Firebase Authentication & Cloud Firestore',
    projectRef: 'authsample-dev',
    status: 'online',
    consoleUrl: 'https://console.firebase.google.com/project/authsample-dev',
    collections: ['users', 'user_sessions', 'audit_logs'],
    endpoints: ['identitytoolkit.googleapis.com', 'firestore.googleapis.com']
  };

  const handlePing = () => {
    setIsPinging(true);
    setPingResult(null);
    setTimeout(() => {
      setIsPinging(false);
      setPingResult({
        status: 200,
        latency: Math.floor(Math.random() * 25 + 22), // 22-47ms
        timestamp: new Date().toLocaleTimeString(),
        endpoint: 'identitytoolkit.googleapis.com/v1/accounts:lookup'
      });
    }, 450);
  };

  const mockUsers = [
    { uid: 'usr_alban_901', email: 'alban@example.com', provider: 'password', created: '2026-09-01', lastSignIn: 'Just now', verified: true },
    { uid: 'usr_demo_442', email: 'demo@saag.dev', provider: 'apple.com', created: '2026-08-15', lastSignIn: '2 hours ago', verified: true }
  ];

  const mockDocs = {
    users: {
      id: 'usr_alban_901',
      data: {
        email: 'alban@example.com',
        displayName: 'Alban',
        role: 'admin',
        createdAt: '2026-09-01T10:00:00Z',
        tier: 'developer_pro'
      }
    },
    user_sessions: {
      id: 'sess_jwt_99182',
      data: {
        userId: 'usr_alban_901',
        tokenHash: 'sha256_e4b8a21f7c9e',
        issuedAt: '2026-09-08T04:30:00Z',
        expiresIn: 3600,
        device: 'iPhone 16 Pro (iOS 18.0)'
      }
    },
    audit_logs: {
      id: 'log_evt_3301',
      data: {
        event: 'auth.login_success',
        clientIp: '192.168.1.42',
        actor: 'node_authviewmodel',
        durationMs: 38
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card glass-panel service-preview-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="service-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="service-logo-pill">
              <FirebaseLogo size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                  {service.provider || 'Firebase Cloud Service'}
                </h3>
                <span className="badge-online">
                  <span className="pulse-dot" />
                  <span>{service.status || 'Online'}</span>
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>
                Project: <strong style={{ color: 'var(--text-primary)' }}>{service.projectRef}</strong> · Region: <span style={{ color: '#38bdf8' }}>us-central1 (Iowa)</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a
              href={service.consoleUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-pill"
              style={{ fontSize: '11px', gap: 4, textDecoration: 'none' }}
              title="Open Google Firebase Console"
            >
              <span>Console</span>
              <ExternalLink size={12} />
            </a>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="service-modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'auth' ? 'active' : ''}`}
            onClick={() => setActiveTab('auth')}
          >
            <Key size={13} />
            <span>Authentication & Tokens</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'firestore' ? 'active' : ''}`}
            onClick={() => setActiveTab('firestore')}
          >
            <Database size={13} />
            <span>Firestore Collections</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'metrics' ? 'active' : ''}`}
            onClick={() => setActiveTab('metrics')}
          >
            <Activity size={13} />
            <span>Health & Endpoints</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="service-modal-content">
          {activeTab === 'auth' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="service-subcard">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={14} color="#38bdf8" />
                    <span>Registered Auth Identities ({mockUsers.length})</span>
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Auto-provisioned for simulation</span>
                </div>

                <div className="auth-user-table">
                  {mockUsers.map((u) => (
                    <div key={u.uid} className="auth-user-row">
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{u.email}</div>
                        <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>UID: {u.uid}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="provider-badge">{u.provider}</span>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>{u.lastSignIn}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* JWT Session Token Preview */}
              <div className="service-subcard">
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Shield size={14} color="#a855f7" />
                  <span>Active Session JWT Claims</span>
                </div>
                <pre className="jwt-preview-block">
{`{
  "iss": "https://securetoken.google.com/authsample-dev",
  "aud": "authsample-dev",
  "sub": "usr_alban_901",
  "email": "alban@example.com",
  "email_verified": true,
  "role": "admin",
  "auth_time": 1725769800,
  "exp": 1725773400
}`}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'firestore' && (
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, minHeight: 240 }}>
              {/* Collection list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderRight: '1px solid var(--border-subtle)', paddingRight: 8 }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Collections
                </span>
                {(service.collections || ['users', 'user_sessions', 'audit_logs']).map((col) => (
                  <button
                    key={col}
                    className={`collection-item-btn ${selectedCollection === col ? 'active' : ''}`}
                    onClick={() => setSelectedCollection(col)}
                  >
                    <Database size={12} />
                    <span>{col}</span>
                  </button>
                ))}
              </div>

              {/* Document details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Document: <strong style={{ color: '#38bdf8' }}>{mockDocs[selectedCollection]?.id || 'doc_01'}</strong>
                  </span>
                  <span className="badge-online" style={{ fontSize: '9px' }}>Read/Write OK</span>
                </div>

                <pre className="jwt-preview-block" style={{ flex: 1, maxHeight: 220 }}>
                  {JSON.stringify(mockDocs[selectedCollection]?.data || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'metrics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="service-subcard">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>Endpoint Health & Connectivity</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Verify roundtrip latency from local app node to Firebase gateway</div>
                  </div>
                  <button
                    className="btn-pill primary"
                    onClick={handlePing}
                    disabled={isPinging}
                    style={{ fontSize: '11px', padding: '6px 12px' }}
                  >
                    {isPinging ? <RefreshCw size={12} className="spin-animation" /> : <Activity size={12} />}
                    <span>Test Ping</span>
                  </button>
                </div>

                {pingResult && (
                  <div className="ping-result-box">
                    <CheckCircle2 size={16} color="var(--color-success)" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-success)' }}>
                        HTTP {pingResult.status} OK · {pingResult.latency}ms Roundtrip
                      </div>
                      <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {pingResult.endpoint} at {pingResult.timestamp}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="service-subcard">
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Configured Cloud Gateways
                </div>
                {(service.endpoints || ['identitytoolkit.googleapis.com', 'firestore.googleapis.com']).map((ep) => (
                  <div key={ep} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>https://{ep}</span>
                    <span style={{ color: 'var(--color-success)', fontSize: '10px' }}>⚡ 99.99% SLA</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
