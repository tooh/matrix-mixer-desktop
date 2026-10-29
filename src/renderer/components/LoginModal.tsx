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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = authMode === 'PASSWORD' ? { username, password } : { pin };
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">🔐 User Authentication & Access Control (RBAC)</h3>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {currentUser ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'center', padding: '16px' }}>
              <div style={{ fontSize: '14px', color: '#94a3b8' }}>Currently signed in as:</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#38bdf8' }}>{currentUser.name}</div>
              <div style={{ fontSize: '12px', color: '#10b981' }}>Role: {currentUser.role}</div>
              <div style={{ marginTop: '16px' }}>
                <button className="btn btn-primary" onClick={onLogout}>Sign Out</button>
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
                </>
              ) : (
                <div className="form-group">
                  <label className="form-label">Enter 4-digit PIN code (e.g. 1234 for Band, 9999 for Admin):</label>
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
