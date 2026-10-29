import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { apiRequest } from '../api';

interface NetworkInfo {
  port: number;
  localIps: string[];
  primaryIp: string;
  remoteUrl: string;
}

interface StageWifiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StageWifiModal: React.FC<StageWifiModalProps> = ({ isOpen, onClose }) => {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [selectedIp, setSelectedIp] = useState<string>('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen) return;

    async function loadNetworkInfo() {
      setLoading(true);
      try {
        let info: NetworkInfo;
        const electronApi = (window as any).electronAPI;
        if (electronApi && typeof electronApi.getNetworkInfo === 'function') {
          info = await electronApi.getNetworkInfo();
        } else {
          info = await apiRequest<NetworkInfo>('/api/network/info');
        }

        setNetworkInfo(info);
        const ip = info.primaryIp || (info.localIps && info.localIps[0]) || 'localhost';
        setSelectedIp(ip);
      } catch (err) {
        console.warn('Could not load network info:', err);
        const fallback: NetworkInfo = {
          port: 3005,
          localIps: ['127.0.0.1'],
          primaryIp: '127.0.0.1',
          remoteUrl: 'http://localhost:3005'
        };
        setNetworkInfo(fallback);
        setSelectedIp('127.0.0.1');
      } finally {
        setLoading(false);
      }
    }

    loadNetworkInfo();
  }, [isOpen]);

  useEffect(() => {
    if (!selectedIp || !networkInfo) return;

    const url = `http://${selectedIp}:${networkInfo.port}`;
    QRCode.toDataURL(url, {
      width: 260,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then((dataUrl) => setQrCodeDataUrl(dataUrl))
      .catch((err) => console.error('QR code generation error:', err));
  }, [selectedIp, networkInfo]);

  if (!isOpen) return null;

  const currentUrl = networkInfo ? `http://${selectedIp}:${networkInfo.port}` : '';

  const handleCopy = () => {
    if (!currentUrl) return;
    navigator.clipboard.writeText(currentUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content wifi-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2>📱 Stage Wi-Fi Hub & QR Access</h2>
            <p className="modal-subtitle">
              Scan with an iPad, iPhone, or Android to mix faders wirelessly on stage
            </p>
          </div>
          <button className="btn-close" onClick={onClose} title="Close modal">
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ textAlign: 'center', padding: '16px 20px' }}>
          {loading ? (
            <div style={{ padding: '40px', color: '#94a3b8' }}>Detecting Wi-Fi & network adapters...</div>
          ) : (
            <>
              {/* QR Code Container */}
              <div
                style={{
                  background: '#ffffff',
                  display: 'inline-block',
                  padding: '12px',
                  borderRadius: '16px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
                  margin: '12px auto'
                }}
              >
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="Stage Wi-Fi QR Code"
                    style={{ width: '220px', height: '220px', display: 'block' }}
                  />
                ) : (
                  <div style={{ width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    Generating QR...
                  </div>
                )}
              </div>

              {/* URL Display & Copy */}
              <div
                style={{
                  margin: '14px auto',
                  maxWidth: '420px',
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '6px 12px'
                }}
              >
                <span
                  style={{
                    flex: 1,
                    fontFamily: 'monospace',
                    fontSize: '15px',
                    color: '#38bdf8',
                    textAlign: 'left',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {currentUrl}
                </span>
                <button
                  className="btn btn-secondary-action"
                  style={{ marginLeft: '10px', padding: '4px 10px', fontSize: '12px' }}
                  onClick={handleCopy}
                >
                  {copied ? '✓ Copied!' : '📋 Copy'}
                </button>
              </div>

              {/* Network Adapter Selector if multiple IPs */}
              {networkInfo && networkInfo.localIps && networkInfo.localIps.length > 1 && (
                <div style={{ margin: '12px auto', maxWidth: '420px', textAlign: 'left', fontSize: '13px', color: '#94a3b8' }}>
                  <label style={{ display: 'block', marginBottom: '4px' }}>
                    Network Adapter / Wi-Fi IP:
                  </label>
                  <select
                    value={selectedIp}
                    onChange={(e) => setSelectedIp(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: '#1e293b',
                      color: '#f8fafc',
                      border: '1px solid #475569',
                      borderRadius: '6px'
                    }}
                  >
                    {networkInfo.localIps.map((ip) => (
                      <option key={ip} value={ip}>
                        {ip} {ip === networkInfo.primaryIp ? '(Primary / Recommended)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Stage usage tips */}
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px',
                  background: 'rgba(30, 41, 59, 0.5)',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#94a3b8',
                  textAlign: 'left',
                  lineHeight: '1.5'
                }}
              >
                <div style={{ color: '#f8fafc', fontWeight: 600, marginBottom: '4px' }}>
                  💡 Stage Wi-Fi Tips:
                </div>
                • Connect iPads/smartphones to the same stage Wi-Fi network or router hotspot.<br />
                • Multiple musicians can open this URL at once and control their own monitor mix.<br />
                • Lock a musician's iPad to a single layer (e.g. <em>Phones</em> or <em>1/4"</em>) using the <strong>🔒 Lock</strong> button in their browser.
              </div>
            </>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={onClose} style={{ minWidth: '120px' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
