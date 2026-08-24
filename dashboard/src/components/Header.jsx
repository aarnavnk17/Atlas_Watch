import { Shield, Database, RefreshCw, LogOut } from 'lucide-react';

export default function Header({ isLive, loading, onRefresh, onLock }) {
  return (
    <header className="glass-panel" style={{ padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Shield size={26} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
            AtlasWatch <span style={{ color: 'var(--color-primary)', fontWeight: 400 }}>// Command</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Safety operations console</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          className="badge"
          style={{
            background: isLive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
            color: isLive ? 'var(--color-success)' : 'var(--color-warning)',
            border: `1px solid ${isLive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
            padding: '6px 14px',
            fontSize: '12px',
          }}
        >
          <Database size={14} style={{ marginRight: '4px' }} />
          {isLive ? 'LIVE' : 'DISCONNECTED'}
        </div>

        <button onClick={onRefresh} className="glass-card" style={buttonStyle}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span style={{ fontSize: '12px', fontWeight: 600 }}>Refresh</span>
        </button>

        <button onClick={onLock} className="glass-card" style={buttonStyle} title="Forget the admin key">
          <LogOut size={14} />
          <span style={{ fontSize: '12px', fontWeight: 600 }}>Lock</span>
        </button>
      </div>
    </header>
  );
}

const buttonStyle = {
  padding: '10px 16px',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: '8px',
  cursor: 'pointer',
  borderRadius: '12px',
};
