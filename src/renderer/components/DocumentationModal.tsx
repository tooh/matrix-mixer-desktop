import React, { useEffect, useState, useRef } from 'react';
import mermaid from 'mermaid';
import { apiRequest } from '../api';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    darkMode: true,
    background: '#090d16',
    primaryColor: '#38bdf8',
    primaryTextColor: '#f8fafc',
    primaryBorderColor: '#0284c7',
    lineColor: '#94a3b8',
    secondaryColor: '#10b981',
    tertiaryColor: '#162032'
  },
  securityLevel: 'loose'
});

function MermaidDiagram({ code, id }: { code: string; id: string }) {
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const render = async () => {
      try {
        const uniqueId = `mermaid_${id.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Math.random().toString(36).substring(2, 7)}`;
        const { svg } = await mermaid.render(uniqueId, code.trim());
        if (active) {
          setSvgHtml(svg);
          setRenderError(null);
        }
      } catch (err: any) {
        console.warn('Mermaid rendering error:', err);
        if (active) {
          setRenderError(err.message || 'Failed to render diagram');
        }
      }
    };
    render();
    return () => { active = false; };
  }, [code, id]);

  if (renderError) {
    return (
      <div style={{
        background: '#090d16',
        border: '1px solid rgba(239, 68, 68, 0.4)',
        borderRadius: '8px',
        padding: '12px 16px',
        margin: '14px 0',
        fontSize: '0.82rem',
        color: '#f87171'
      }}>
        <div style={{ marginBottom: '6px', fontWeight: 600 }}>⚠️ Failed to render diagram:</div>
        <pre style={{ margin: 0, overflowX: 'auto', color: '#94a3b8', fontSize: '0.78rem' }}>{code}</pre>
      </div>
    );
  }

  if (!svgHtml) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
        Rendering diagram...
      </div>
    );
  }

  return (
    <div 
      className="mermaid-container"
      style={{
        margin: '18px 0',
        padding: '18px',
        background: '#090d16',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        overflowX: 'auto',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)'
      }}
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type DocTab = 'FAM' | 'TAM' | 'CHANGELOG' | 'OPENAPI';

export const DocumentationModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [activeDoc, setActiveDoc] = useState<DocTab>('FAM');
  const [content, setContent] = useState<string>('Loading...');
  const [loading, setLoading] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const docFiles: Record<DocTab, string> = {
    FAM: 'Functional_Application_Manual_FAM.md',
    TAM: 'Technical_Application_Manual_TAM.md',
    CHANGELOG: 'CHANGELOG.md',
    OPENAPI: 'openapi.yaml'
  };

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    apiRequest<{ content: string }>('/api/docs/read', {
      method: 'POST',
      body: JSON.stringify({ file: docFiles[activeDoc] })
    })
      .then((res) => {
        setContent(res.content);
        setLoading(false);
      })
      .catch((err) => {
        setContent(`Error loading documentation: ${err.message}`);
        setLoading(false);
      });
  }, [isOpen, activeDoc]);

  if (!isOpen) return null;

  const slugify = (text: string): string => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
  };

  const handleAnchorClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rawTarget = href.replace(/^#/, '').toLowerCase().trim();
    if (!contentRef.current) return;

    let targetEl = contentRef.current.querySelector(`[id="${rawTarget}"]`);

    if (!targetEl) {
      const cleanTarget = rawTarget.replace(/[^\w]/g, '');
      targetEl = contentRef.current.querySelector(`[data-clean="${cleanTarget}"]`);
    }

    if (!targetEl) {
      const headings = contentRef.current.querySelectorAll('h1, h2, h3, h4');
      const simplifiedTarget = rawTarget.replace(/[^\w]/g, '');
      for (const h of Array.from(headings)) {
        const hText = (h.textContent || '').toLowerCase().trim();
        const simplifiedHT = hText.replace(/[^\w]/g, '');
        if (simplifiedHT.includes(simplifiedTarget) || simplifiedTarget.includes(simplifiedHT)) {
          targetEl = h;
          break;
        }
      }
    }

    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const formatInline = (text: string): React.ReactNode => {
    if (!text) return text;
    const tokenRegex = /(`[^`]+`|\*\*[^*]+?\*\*|\*[^*]+?\*|\[[^\]]+?\]\([^)]+?\))/g;
    const parts = text.split(tokenRegex);

    return parts.map((part, i) => {
      if (!part) return null;
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code key={i} style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', color: '#38bdf8', fontSize: '0.85em', fontFamily: 'monospace' }}>
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        const inner = part.slice(2, -2);
        return (
          <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
            {inner.includes('`') ? formatInline(inner) : inner}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return (
          <em key={i} style={{ color: 'var(--text-secondary)' }}>
            {part.slice(1, -1)}
          </em>
        );
      }
      if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
        const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (match) {
          const linkText = match[1];
          const href = match[2];
          if (href.startsWith('#')) {
            return (
              <a
                key={i}
                href={href}
                onClick={(e) => handleAnchorClick(e, href)}
                style={{ color: '#38bdf8', textDecoration: 'underline', cursor: 'pointer' }}
              >
                {linkText}
              </a>
            );
          }
          return (
            <a key={i} href={href} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>
              {linkText}
            </a>
          );
        }
      }
      return part;
    });
  };

  const renderMarkdown = (md: string) => {
    const lines = md.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];
    let codeLang = '';
    let inTable = false;
    let tableRows: string[][] = [];

    const flushTable = (key: string) => {
      if (tableRows.length === 0) return null;
      const headers = tableRows[0];
      const rows = tableRows.slice(2);
      const tableEl = (
        <div key={key} style={{ overflowX: 'auto', margin: '18px 0', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'rgba(56, 189, 248, 0.15)' }}>
                {headers.map((h, i) => (
                  <th key={i} style={{ borderBottom: '1px solid var(--border-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {formatInline(h.trim())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, rIdx) => (
                <tr key={rIdx} style={{ background: rIdx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {r.map((c, cIdx) => (
                    <td key={cIdx} style={{ padding: '9px 14px', color: 'var(--text-secondary)' }}>
                      {formatInline(c.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
      return tableEl;
    };

    lines.forEach((line, idx) => {
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          if (codeLang === 'mermaid') {
            elements.push(
              <MermaidDiagram key={`mermaid-${idx}`} id={`dia-${idx}`} code={codeContent.join('\n')} />
            );
          } else {
            const rawCode = codeContent.join('\n');
            elements.push(
              <div key={`code-${idx}`} style={{ position: 'relative', margin: '14px 0' }}>
                <pre style={{
                  background: '#090d16',
                  padding: '14px 18px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  overflowX: 'auto',
                  fontSize: '0.82rem',
                  color: '#38bdf8',
                  fontFamily: 'monospace',
                  margin: 0
                }}>
                  <code>{rawCode}</code>
                </pre>
              </div>
            );
          }
          codeContent = [];
          codeLang = '';
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          codeLang = line.trim().slice(3).trim().toLowerCase();
        }
        return;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        return;
      }

      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        inTable = true;
        const cells = line.split('|').slice(1, -1);
        tableRows.push(cells);
        return;
      } else if (inTable) {
        const table = flushTable(`table-${idx}`);
        if (table) elements.push(table);
      }

      // Headings
      if (line.startsWith('# ')) {
        const rawTitle = line.replace('# ', '').trim();
        const slug = slugify(rawTitle);
        const clean = rawTitle.toLowerCase().replace(/[^\w]/g, '');
        elements.push(
          <h1 id={slug} data-clean={clean} key={idx} style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px', borderBottom: '2px solid rgba(56, 189, 248, 0.4)', paddingBottom: '8px', scrollMarginTop: '20px' }}>
            {formatInline(rawTitle)}
          </h1>
        );
      } else if (line.startsWith('## ')) {
        const rawTitle = line.replace('## ', '').trim();
        const slug = slugify(rawTitle);
        const clean = rawTitle.toLowerCase().replace(/[^\w]/g, '');
        elements.push(
          <h2 id={slug} data-clean={clean} key={idx} style={{ fontSize: '1.2rem', fontWeight: 700, color: '#38bdf8', marginTop: '22px', marginBottom: '8px', scrollMarginTop: '20px' }}>
            {formatInline(rawTitle)}
          </h2>
        );
      } else if (line.startsWith('### ')) {
        const rawTitle = line.replace('### ', '').trim();
        const slug = slugify(rawTitle);
        const clean = rawTitle.toLowerCase().replace(/[^\w]/g, '');
        elements.push(
          <h3 id={slug} data-clean={clean} key={idx} style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f1f5f9', marginTop: '16px', marginBottom: '6px', scrollMarginTop: '20px' }}>
            {formatInline(rawTitle)}
          </h3>
        );
      } else if (line.startsWith('#### ')) {
        const rawTitle = line.replace('#### ', '').trim();
        const slug = slugify(rawTitle);
        const clean = rawTitle.toLowerCase().replace(/[^\w]/g, '');
        elements.push(
          <h4 id={slug} data-clean={clean} key={idx} style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '12px', marginBottom: '4px', scrollMarginTop: '20px' }}>
            {formatInline(rawTitle)}
          </h4>
        );
      } else if (line.startsWith('> [!NOTE]') || line.startsWith('> [!TIP]') || line.startsWith('> [!IMPORTANT]') || line.startsWith('> [!WARNING]')) {
        const isTip = line.includes('[!TIP]');
        const isWarn = line.includes('[!WARNING]');
        const isImportant = line.includes('[!IMPORTANT]');
        const accent = isTip ? '#10b981' : isWarn ? '#ef4444' : isImportant ? '#f59e0b' : '#38bdf8';
        elements.push(
          <div key={idx} style={{
            background: 'rgba(56, 189, 248, 0.08)',
            borderLeft: `4px solid ${accent}`,
            padding: '10px 14px',
            borderRadius: '0 8px 8px 0',
            margin: '12px 0',
            fontSize: '0.85rem'
          }}>
            <strong style={{ color: 'var(--text-primary)' }}>{line.replace('>', '').trim()}</strong>
          </div>
        );
      } else if (line.startsWith('> ')) {
        elements.push(
          <div key={idx} style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderLeft: '3px solid #64748b',
            padding: '8px 14px',
            margin: '8px 0',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)'
          }}>
            {formatInline(line.replace('> ', ''))}
          </div>
        );
      } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const indent = line.search(/\S/) > 2 ? '32px' : '18px';
        elements.push(
          <div key={idx} style={{ display: 'flex', gap: '8px', marginLeft: indent, fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '3px 0', lineHeight: '1.5' }}>
            <span style={{ color: '#38bdf8', fontSize: '0.8rem', lineHeight: '1.6' }}>•</span>
            <div style={{ flex: 1 }}>{formatInline(line.trim().replace(/^[-*]\s+/, ''))}</div>
          </div>
        );
      } else if (/^\d+\.\s+/.test(line.trim())) {
        const numMatch = line.trim().match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          elements.push(
            <div key={idx} style={{ display: 'flex', gap: '8px', marginLeft: '12px', fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '4px 0', lineHeight: '1.5' }}>
              <span style={{ fontWeight: 700, color: '#38bdf8', minWidth: '22px' }}>{numMatch[1]}.</span>
              <div style={{ flex: 1 }}>{formatInline(numMatch[2])}</div>
            </div>
          );
        }
      } else if (line.trim() === '---') {
        elements.push(<hr key={idx} style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '22px 0' }} />);
      } else if (line.trim() !== '') {
        elements.push(
          <p key={idx} style={{ fontSize: '0.88rem', lineHeight: '1.6', color: 'var(--text-secondary)', margin: '8px 0' }}>
            {formatInline(line)}
          </p>
        );
      }
    });

    if (inTable) {
      const table = flushTable('table-final');
      if (table) elements.push(table);
    }

    return elements;
  };

  const handlePrint = () => {
    if (!contentRef.current) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${docFiles[activeDoc]} - MatrixMixer</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #0f172a; line-height: 1.6; }
              h1 { font-size: 1.6rem; border-bottom: 2px solid #0284c7; padding-bottom: 6px; }
              h2 { font-size: 1.3rem; color: #0369a1; margin-top: 20px; }
              h3 { font-size: 1.1rem; margin-top: 16px; }
              table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 13px; }
              th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
              th { background-color: #f1f5f9; font-weight: 700; }
              pre { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px; }
              code { font-family: monospace; }
              .mermaid-container svg { max-width: 100%; height: auto; }
            </style>
          </head>
          <body>
            ${contentRef.current.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 300);
    }
  };

  const handleCopyYaml = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-dialog modal-dialog-large" 
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '92vw',
          maxWidth: '1080px',
          height: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
          borderRadius: '16px',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '14px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '24px' }}>📖</span>
            <div>
              <h3 className="modal-title" style={{ margin: 0, fontSize: '1.15rem' }}>
                System Documentation &amp; Manuals
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Line 6 Helix Stadium 1.4 Architecture, FAM, TAM &amp; OpenAPI Specifications
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="btn" onClick={handlePrint} title="Print or save as PDF">
              🖨️ Print / PDF
            </button>
            <button className="modal-close-btn" onClick={onClose}>&times;</button>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ 
          display: 'flex', 
          background: '#090d16', 
          borderBottom: '1px solid var(--border-color)', 
          padding: '8px 16px', 
          gap: '8px',
          overflowX: 'auto',
          flexShrink: 0
        }}>
          {[
            { id: 'FAM', label: '📘 Functional Manual (FAM)' },
            { id: 'TAM', label: '🛠️ Technical Manual (TAM)' },
            { id: 'CHANGELOG', label: '📋 Changelog' },
            { id: 'OPENAPI', label: '🔌 REST API (OpenAPI)' }
          ].map((tab) => (
            <button
              key={tab.id}
              className={`btn ${activeDoc === tab.id ? 'btn-primary' : ''}`}
              onClick={() => setActiveDoc(tab.id as DocTab)}
              style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal body */}
        <div 
          ref={contentRef}
          className="modal-body" 
          style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', background: 'var(--bg-main)' }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
              Loading document...
            </div>
          ) : activeDoc === 'OPENAPI' ? (
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
              {/* OpenAPI Hero */}
              <div style={{
                padding: '16px 20px',
                marginBottom: '20px',
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(14, 165, 233, 0.2) 100%)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap'
              }}>
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: '#38bdf8', fontWeight: 700 }}>
                    ⚡ Interactive Swagger UI API Console
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Test endpoints live, verify MIDI parameters, inspect request/response schemas.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <a 
                    href="/api-docs" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn btn-primary btn-sm"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                  >
                    🚀 Open Swagger UI ↗
                  </a>
                  <a 
                    href="/api/openapi.json" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn btn-secondary btn-sm"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    📄 openapi.json
                  </a>
                  <a 
                    href="/api/openapi.yaml" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn btn-secondary btn-sm"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    📑 openapi.yaml
                  </a>
                </div>
              </div>

              {/* OpenAPI Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Endpoints</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>14 Endpoints</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Categories</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>Mixer, MIDI, Presets, Docs</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Specification</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#a855f7' }}>OpenAPI 3.0.3</div>
                </div>
              </div>

              {/* Specification Source Code Header */}
              <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Specification Source Code (docs/openapi.yaml)
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCopyYaml}
                  style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                >
                  {copySuccess ? '✅ Copied!' : '📋 Copy YAML'}
                </button>
              </div>

              <pre style={{
                background: '#090d16',
                color: '#e2e8f0',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '16px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '0.8rem',
                lineHeight: '1.5',
                overflowX: 'auto',
                maxHeight: '520px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                <code>{content}</code>
              </pre>
            </div>
          ) : (
            <div className="docs-content" style={{ maxWidth: '900px', margin: '0 auto' }}>
              {renderMarkdown(content)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ padding: '12px 20px', flexShrink: 0 }}>
          <a
            href="/api-docs"
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
            style={{ textDecoration: 'none' }}
          >
            Open Swagger UI Console ↗
          </a>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
