import React, { useState } from 'react';
import { apiRequest } from '../api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ScrumIssueModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [issueType, setIssueType] = useState('type: bug');
  const [priority, setPriority] = useState('prio: P3-normaal');
  const [moduleName, setModuleName] = useState('module: mixer');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ url: string; issueNumber: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const bodyMarkdown = `
### Properties
| Field | Value |
| :--- | :--- |
| **Type** | \`${issueType}\` |
| **Priority** | \`${priority}\` |
| **Module** | \`${moduleName}\` |
| **App Version** | \`1.0.0\` |
| **Timestamp** | ${new Date().toISOString()} |

### Description & Context
${description}

---
*Automatically logged via MatrixMixer In-App Scrum Logger*
    `.trim();

    try {
      const res = await apiRequest<{ success: boolean; url: string; issueNumber: string }>('/api/github/create-issue', {
        method: 'POST',
        body: JSON.stringify({
          title: `[${moduleName.replace('module: ', '').toUpperCase()}] ${title}`,
          body: bodyMarkdown,
          labels: [issueType, priority, moduleName]
        })
      });

      setResult({ url: res.url, issueNumber: res.issueNumber });
      setSubmitting(false);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setResult(null);
    setError(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">🐞 In-App GitHub Scrum Issue Logger</h3>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {result ? (
            <div style={{ background: '#064e3b', border: '1px solid #10b981', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
              <h4 style={{ color: '#a7f3d0', marginBottom: '8px' }}>🎉 Issue Successfully Registered!</h4>
              <p style={{ color: '#f8fafc', fontSize: '13px', marginBottom: '12px' }}>
                Issue number: <strong>{result.issueNumber}</strong>
              </p>
              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
                style={{ textDecoration: 'none' }}
              >
                View on GitHub ↗
              </a>
              <div style={{ marginTop: '16px' }}>
                <button className="btn" onClick={resetForm}>Log another issue</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {error && (
                <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div className="form-group">
                  <label className="form-label">Type:</label>
                  <select className="form-select" value={issueType} onChange={(e) => setIssueType(e.target.value)}>
                    <option value="type: bug">🐛 Bug (Patch)</option>
                    <option value="type: feature">✨ Feature (Minor)</option>
                    <option value="type: enhancement">⚡ Enhancement</option>
                    <option value="type: documentation">📖 Documentation</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Priority:</label>
                  <select className="form-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
                    <option value="prio: P1-critical">P1 - Critical</option>
                    <option value="prio: P2-high">P2 - High</option>
                    <option value="prio: P3-normal">P3 - Normal</option>
                    <option value="prio: P4-low">P4 - Low</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Module:</label>
                  <select className="form-select" value={moduleName} onChange={(e) => setModuleName(e.target.value)}>
                    <option value="module: mixer">Mixer Faders</option>
                    <option value="module: midi">MIDI & CC</option>
                    <option value="module: presets">Presets</option>
                    <option value="module: auth">Security / RBAC</option>
                    <option value="module: admin">Administration</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Short Title:</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Pan Reset does not center on Phones layer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description / Reproduction Steps:</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Clearly describe the context, acceptance criteria or steps to reproduce the issue..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>

              <div className="modal-footer" style={{ padding: '0', background: 'transparent' }}>
                <button type="button" className="btn" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit to GitHub'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
