import { MapPin } from 'lucide-react';

export default function DangerZonePanel({ users }) {
  return (
    <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapPin size={20} color="var(--color-danger)" className={users.length > 0 ? 'animate-pulse' : ''} />
          <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Danger zone tracking</h3>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>Users whose last fix scored high risk</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '320px', overflowY: 'auto', paddingRight: '8px' }}>
        {users.map(user => (
          <div
            key={user.email}
            style={{
              background: 'rgba(239, 68, 68, 0.03)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '13px', fontWeight: 800 }}>{user.fullName || 'Unnamed user'}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user.email}</span>
              </div>
              <span className="badge badge-danger" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800 }}>
                {user.lastLocation.riskLevel || 'high'}
              </span>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
              <MapPin size={14} color="var(--color-danger)" style={{ marginTop: '2px', flexShrink: 0 }} />
              <span>
                {user.lastLocation.address ||
                  `${user.lastLocation.lat?.toFixed(5)}, ${user.lastLocation.lng?.toFixed(5)}`}
              </span>
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid rgba(239, 68, 68, 0.08)', paddingTop: '8px', marginTop: '4px' }}>
              <span>Accuracy: {user.lastLocation.accuracy ? `${Math.round(user.lastLocation.accuracy)}m` : 'GPS'}</span>
              <span>
                {user.lastLocation.timestamp
                  ? new Date(user.lastLocation.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'live'}
              </span>
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', margin: 'auto' }}>
            🛡️ No users are currently in high-risk areas.
          </div>
        )}
      </div>
    </div>
  );
}
