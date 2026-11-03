import React, { useState } from 'react';
import { apiRequest } from '../api';

interface ScrumIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentActiveTab?: string;
}

export const ScrumIssueModal: React.FC<ScrumIssueModalProps> = ({ 
  isOpen, 
  onClose, 
  currentActiveTab = 'mixer' 
}) => {
  const [issueType, setIssueType] = useState<'bug' | 'feature' | 'story' | 'task'>('bug');
  const [module, setModule] = useState<string>(() => {
    switch (currentActiveTab) {
      case 'midi': return 'MIDI In/Out & CC Routing';
      case 'presets': return 'Presets & Scènes';
      case 'settings': return 'Instellingen & Stage Wi-Fi';
      case 'auth': return 'Security & RBAC (Admin/FOH/Band)';
      case 'mixer': default: return 'Mixer & Faders (1/4", XLR, Phones)';
    }
  });
  const [priority, setPriority] = useState<string>('P3 - Normaal');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [createdIssue, setCreatedIssue] = useState<{ url: string; number: string | number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyTemplate = (type: 'bug' | 'feature' | 'story' | 'task') => {
    setIssueType(type);
    if (type === 'story') {
      if (!description) {
        setDescription('Als geluidstechnicus / muzikant\nWil ik ...\nZodat ...');
      }
      if (!acceptanceCriteria) {
        setAcceptanceCriteria('- [ ] Het systeem toont ...\n- [ ] Als de gebruiker klikt op ..., gebeurt er ...\n- [ ] MIDI CC/PC sync werkt direct met Helix');
      }
    } else if (type === 'bug') {
      if (!description) {
        setDescription('1. Wat gebeurt er:\n\n2. Wat hoort er te gebeuren:\n');
      }
      if (!acceptanceCriteria) {
        setAcceptanceCriteria('Stappen om te reproduceren:\n1. Open scherm ...\n2. Beweeg fader / selecteer poort ...\n3. Zie foutmelding / gedrag');
      }
    } else {
      if (!description) {
        setDescription('Beschrijving van de gewenste functionaliteit:\n');
      }
      if (!acceptanceCriteria) {
        setAcceptanceCriteria('Acceptatiecriteria:\n- [ ] ');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Vul a.u.b. een korte titel in voor het issue.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const typeEmoji = issueType === 'bug' ? '🐛 Bug' : issueType === 'story' ? '📖 User Story' : issueType === 'feature' ? '✨ Feature Request' : '⚡ Verbetering';
    const bodyMarkdown = [
      `### 📋 Scrum Issue Report: ${typeEmoji}`,
      ``,
      `| Eigenschap | Waarde |`,
      `| :--- | :--- |`,
      `| **Type** | ${typeEmoji} |`,
      `| **Module** | ${module} |`,
      `| **Prioriteit** | ${priority} |`,
      `| **Gemeld via** | MatrixMixer Desktop (Helix Stadium 1.4) |`,
      ``,
      `---`,
      ``,
      `### 📝 Beschrijving & Context`,
      description ? description.trim() : '_Geen nadere beschrijving opgegeven._',
      ``,
      acceptanceCriteria && acceptanceCriteria.trim() ? `### 🎯 Acceptatiecriteria / Reproductiestappen\n${acceptanceCriteria.trim()}\n` : '',
      `---`,
      `*Automatisch geregistreerd vanuit de MatrixMixer Desktop Scrum Issue Logger.*`
    ].join('\n');

    try {
      const res = await apiRequest<{ success: boolean; url?: string; issueUrl?: string; issueNumber?: string | number; error?: string }>('/api/github/create-issue', {
        method: 'POST',
        body: JSON.stringify({
          title: `[${module.split(' ')[0]}] ${title.trim()}`,
          body: bodyMarkdown,
          labels: [
            issueType === 'bug' ? 'bug' : 'enhancement',
            priority.split(' ')[0]
          ]
        })
      });

      const issueUrl = res.issueUrl || res.url;
      const issueNumber = res.issueNumber || (issueUrl ? issueUrl.split('/').pop() : 0);

      if (issueUrl) {
        setCreatedIssue({
          url: issueUrl,
          number: issueNumber || 'new'
        });
      } else {
        setErrorMsg(res.error || 'Onbekende fout bij aanmaken issue op GitHub.');
      }
    } catch (err: any) {
      console.error('Error creating issue:', err);
      setErrorMsg(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setTitle('');
    setDescription('');
    setAcceptanceCriteria('');
    setCreatedIssue(null);
    setErrorMsg(null);
    setSubmitting(false);
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          borderRadius: '16px',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(67, 56, 202, 0.3) 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>🐞</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                GitHub Scrum Issue / Melding Loggen
              </h2>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Direct gelogd naar repository: <code>tooh/matrix-mixer-desktop</code>
              </span>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{
              padding: '4px 10px',
              fontSize: '1rem',
              borderRadius: '8px',
              border: 'none',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#f8fafc',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {createdIssue ? (
            <div style={{ textAlign: 'center', padding: '30px 10px' }}>
              <div style={{ fontSize: '50px', marginBottom: '12px' }}>🎉</div>
              <h3 style={{ fontSize: '1.25rem', color: '#f8fafc', marginBottom: '8px' }}>
                GitHub Issue Succesvol Aangemaakt!
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px' }}>
                Uw melding is direct opgenomen in de sprint backlog van MatrixMixer.
              </p>

              <div style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '24px',
                display: 'inline-block',
                maxWidth: '90%',
                textAlign: 'left'
              }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#818cf8', marginBottom: '6px' }}>
                  Issue #{createdIssue.number}: {title}
                </div>
                <a 
                  href={createdIssue.url} 
                  target="_blank" 
                  rel="noreferrer"
                  style={{ color: '#38bdf8', wordBreak: 'break-all', fontSize: '0.85rem' }}
                >
                  {createdIssue.url} ↗
                </a>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button 
                  type="button" 
                  onClick={handleReset}
                  className="btn btn-secondary"
                  style={{ padding: '10px 18px', borderRadius: '8px', cursor: 'pointer' }}
                >
                  ➕ Nog een issue aanmaken
                </button>
                <button 
                  type="button" 
                  onClick={onClose}
                  className="btn btn-primary"
                  style={{ padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', background: '#6366f1', color: '#fff', border: 'none' }}
                >
                  Klaar &amp; Sluiten
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {errorMsg && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#f87171',
                  fontSize: '0.85rem'
                }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              {/* Type selector tabs */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>
                  Type Melding *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'bug', label: '🐛 Bug / Fout' },
                    { id: 'feature', label: '✨ Feature' },
                    { id: 'story', label: '📖 User Story' },
                    { id: 'task', label: '⚡ Verbetering' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleApplyTemplate(t.id as any)}
                      style={{
                        padding: '8px 4px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        borderRadius: '8px',
                        background: issueType === t.id ? '#6366f1' : 'rgba(255, 255, 255, 0.04)',
                        color: issueType === t.id ? '#fff' : '#94a3b8',
                        border: issueType === t.id ? '1px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.1)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Module & Prioriteit */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: '#94a3b8' }}>
                    Module / Feature Area *
                  </label>
                  <select 
                    value={module} 
                    onChange={e => setModule(e.target.value)}
                    style={{ fontSize: '0.85rem', background: '#1e293b', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', padding: '8px' }}
                  >
                    <option value={'Mixer & Faders (1/4", XLR, Phones)'}>Mixer &amp; Faders (1/4", XLR, Phones)</option>
                    <option value="MIDI In/Out & CC Routing">MIDI In/Out &amp; CC Routing</option>
                    <option value="Presets & Scènes">Presets &amp; Scènes</option>
                    <option value="Stage Wi-Fi & SSE Remote">Stage Wi-Fi &amp; SSE Remote</option>
                    <option value="Security & RBAC (Admin, FOH, Band)">Security &amp; RBAC (Admin, FOH, Band)</option>
                    <option value="Algemeen / UI & Dark Theme">Algemeen / UI &amp; Dark Theme</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: '#94a3b8' }}>
                    Prioriteit *
                  </label>
                  <select 
                    value={priority} 
                    onChange={e => setPriority(e.target.value)}
                    style={{ fontSize: '0.85rem', background: '#1e293b', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', padding: '8px' }}
                  >
                    <option value="P1 - Kritiek (Blocker)">🔴 P1 - Kritiek (Blocker)</option>
                    <option value="P2 - Hoog">🟠 P2 - Hoog</option>
                    <option value="P3 - Normaal">🟡 P3 - Normaal</option>
                    <option value="P4 - Laag">🟢 P4 - Laag</option>
                  </select>
                </div>
              </div>

              {/* Titel */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: '#94a3b8' }}>
                  Korte Titel *
                </label>
                <input 
                  type="text"
                  required
                  placeholder="bijv.: Pan Reset centreert niet op Phones laag"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  style={{ fontSize: '0.85rem', background: '#1e293b', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', padding: '10px' }}
                />
              </div>

              {/* Beschrijving */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>
                    Beschrijving &amp; Verwacht Gedrag
                  </label>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Ondersteunt Markdown</span>
                </div>
                <textarea 
                  rows={4}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Beschrijf wat er gebeurt, wat de gewenste situatie is, of de audio/MIDI context..."
                  style={{ fontSize: '0.85rem', fontFamily: 'monospace', background: '#1e293b', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', padding: '10px' }}
                />
              </div>

              {/* Acceptatiecriteria of Stappen */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: '#94a3b8' }}>
                  {issueType === 'bug' ? 'Stappen om te reproduceren' : 'Acceptatiecriteria (Checklist)'}
                </label>
                <textarea 
                  rows={3}
                  value={acceptanceCriteria}
                  onChange={e => setAcceptanceCriteria(e.target.value)}
                  placeholder="- [ ] Criterium 1&#10;- [ ] Criterium 2"
                  style={{ fontSize: '0.85rem', fontFamily: 'monospace', background: '#1e293b', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', padding: '10px' }}
                />
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button 
                  type="button" 
                  onClick={onClose}
                  disabled={submitting}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: '#f8fafc',
                    cursor: 'pointer'
                  }}
                >
                  Annuleren
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#6366f1',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {submitting ? (
                    <>
                      <span>Bezig met loggen naar GitHub...</span>
                    </>
                  ) : (
                    <>
                      <span>🐙 Verstuur naar GitHub Issues</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScrumIssueModal;
