import { useState } from 'react';
import { Shield, KeyRound } from 'lucide-react';
import { setAdminKey } from '../api';

/**
 * The dashboard reads every user's medical details, passport numbers and live
 * position, so it asks for the operator key before it shows anything.
 */
export default function AdminKeyGate({ onUnlock, rejected }) {
  const [key, setKey] = useState('');

  const submit = event => {
    event.preventDefault();
    if (!key.trim()) return;
    setAdminKey(key.trim());
    onUnlock();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <form onSubmit={submit} className="glass-panel" style={{ padding: '40px', width: 'min(420px, 100%)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800 }}>AtlasWatch Command</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Operator access required</p>
          </div>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Admin key
          <input
            type="password"
            value={key}
            onChange={e => setKey(e.target.value)}
            autoFocus
            placeholder="ADMIN_API_KEY"
            style={{
              padding: '12px 14px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontFamily: 'monospace',
              textTransform: 'none',
              letterSpacing: 'normal',
            }}
          />
        </label>

        {rejected && (
          <p style={{ color: 'var(--color-danger)', fontSize: '13px' }}>
            That key was rejected. It is the backend&apos;s <code>ADMIN_API_KEY</code>, not a user password.
          </p>
        )}

        <button
          type="submit"
          className="glass-card"
          style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', borderRadius: '12px', fontWeight: 700 }}
        >
          <KeyRound size={16} /> Unlock dashboard
        </button>

        <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
          Stored for this browser tab only.
        </p>
      </form>
    </div>
  );
}
