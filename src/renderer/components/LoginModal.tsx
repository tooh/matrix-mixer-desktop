import React, { useState } from 'react';
import { apiRequest } from '../api';
import { UserSession } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserSession) => void;
  currentUser: UserSession | null;
  onLogout: () => void;
}

export const LoginModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  currentUser,
  onLogout
}) => {
  const [authMode, setAuthMode] = useState<'PASSWORD' | 'PIN'>('PASSWORD');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const submitAuth = async (payload: { username?: string; password?: string; pin?: string }) => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiRequest<{ success: boolean; user: UserSession }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      localStorage.setItem('matrix_mixer_user', JSON.stringify(res.user));
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = authMode === 'PASSWORD' ? { username, password } : { pin };
    await submitAuth(payload);
  };

  const handleQuickPin = async (quickCode: string) => {
    setPin(quickCode);
    await submitAuth({ pin: quickCode });
  };

  const handleQuickPassword = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">🔐 User Authentication & Access Control (RBAC)</h3>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {currentUser ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center', padding: '16px' }}>
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>Currently signed in as:</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#38bdf8' }}>{currentUser.name}</div>
              <div style={{
                display: 'inline-block',
                alignSelf: 'center',
                padding: '4px 12px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 600,
                background: currentUser.role === 'ADMIN' ? 'rgba(239, 68, 68, 0.2)' : currentUser.role === 'OPERATOR' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: currentUser.role === 'ADMIN' ? '#f87171' : currentUser.role === 'OPERATOR' ? '#38bdf8' : '#fbbf24',
                border: '1px solid currentColor'
              }}>
                Role: {currentUser.role}
              </div>

              {/* Role Permissions Card */}
              <div style={{
                background: '#090d16',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                padding: '12px',
                textAlign: 'left',
                fontSize: '12px',
                color: '#cbd5e1',
                marginTop: '6px'
              }}>
                <div style={{ fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Role Capabilities:</div>
                {currentUser.role === 'ADMIN' && (
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <li>⭐ Full access across all matrix layers (1/4", XLR, Phones).</li>
                    <li>⭐ Full preset control: Load, Save, Edit, and Delete presets.</li>
                    <li>⭐ Configure server USB CoreMIDI output and MIDI layer channels.</li>
                    <li>⭐ Global system settings management.</li>
                  </ul>
                )}
                {currentUser.role === 'OPERATOR' && (
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <li>🎛️ Switch between all 3 output layers (1/4", XLR, Phones).</li>
                    <li>🎛️ Full real-time fader, pan, mute, and solo controls.</li>
                    <li>🎛️ Load, create, and edit mix presets.</li>
                    <li>🔒 Deleting presets and hardware routing changes restricted to Admin.</li>
                  </ul>
                )}
                {currentUser.role === 'BAND_MEMBER' && (
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <li>🎧 Dedicated to personal In-Ear Monitors (Matrix &gt; Phones Out only).</li>
                    <li>🎧 Adjust personal monitor mix faders, pan, and mute/solo.</li>
                    <li>🔒 Other matrix layers (1/4" &amp; XLR) locked for stage safety.</li>
                    <li>🔒 Preset creation, deletion, and MIDI settings locked.</li>
                  </ul>
                )}
              </div>

              <div style={{ marginTop: '12px' }}>
                <button className="btn btn-primary" onClick={onLogout}>Sign Out / Switch User</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #27354f', paddingBottom: '8px' }}>
                <button
                  type="button"
                  className={`btn ${authMode === 'PASSWORD' ? 'btn-primary' : ''}`}
                  onClick={() => setAuthMode('PASSWORD')}
                >
                  Password
                </button>
                <button
                  type="button"
                  className={`btn ${authMode === 'PIN' ? 'btn-primary' : ''}`}
                  onClick={() => setAuthMode('PIN')}
                >
                  Quick PIN (Stage)
                </button>
              </div>

              {error && (
                <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                  {error}
                </div>
              )}

              {authMode === 'PASSWORD' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Username or Email Address:</label>
                    <input
                      type="text"
                      className="form-input"
                      autoComplete="username"
                      placeholder="admin, foh, or band"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password:</label>
                    <input
                      type="password"
                      className="form-input"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  {/* Quick autofill chips */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', fontSize: '11px', color: '#64748b' }}>
                    <span>Quick fill:</span>
                    <button
                      type="button"
                      className="btn"
                      style={{ padding: '2px 6px', fontSize: '10px' }}
                      onClick={() => handleQuickPassword('admin', 'admin123')}
                    >
                      Admin
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{ padding: '2px 6px', fontSize: '10px' }}
                      onClick={() => handleQuickPassword('foh', 'foh123')}
                    >
                      FOH Operator
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{ padding: '2px 6px', fontSize: '10px' }}
                      onClick={() => handleQuickPassword('band', 'band123')}
                    >
                      Band Member
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Enter 4-digit PIN code:</label>
                    <input
                      type="password"
                      maxLength={4}
                      className="form-input"
                      style={{ fontSize: '24px', letterSpacing: '8px', textAlign: 'center' }}
                      placeholder="••••"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      required
                    />
                  </div>

                  {/* Instant 1-click stage PIN buttons */}
                  <div style={{
                    background: '#090d16',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    padding: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>
                      One-Touch Stage Login:
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn"
                        style={{ fontSize: '11px', padding: '6px 4px', borderColor: '#f59e0b', color: '#fbbf24' }}
                        onClick={() => handleQuickPin('1234')}
                        title="Log in as Band Member (PIN 1234)"
                      >
                        🎧 Band (1234)
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{ fontSize: '11px', padding: '6px 4px', borderColor: '#38bdf8', color: '#38bdf8' }}
                        onClick={() => handleQuickPin('5678')}
                        title="Log in as FOH Sound Engineer (PIN 5678)"
                      >
                        🎛️ FOH (5678)
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{ fontSize: '11px', padding: '6px 4px', borderColor: '#ef4444', color: '#f87171' }}
                        onClick={() => handleQuickPin('9999')}
                        title="Log in as Administrator (PIN 9999)"
                      >
                        ⚡ Admin (9999)
                      </button>
                    </div>
                  </div>
                </>
              )}

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Verifying...' : 'Sign In'}
              </button>
            </form>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
