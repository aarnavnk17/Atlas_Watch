import { Radio, MapPin, Clock, Check } from 'lucide-react';

// Matches the trigger values the API actually stores. The old badge tested for
// 'ai_anomaly', which the backend has never sent, so automatic alerts were
// always labelled "Manual Panic".
const TRIGGER_LABELS = {
  manual: { text: 'Manual panic', className: 'badge-danger' },
  ai_auto: { text: 'AI auto-trigger', className: 'badge-primary' },
  inactivity: { text: 'Inactivity', className: 'badge-warning' },
  geofence: { text: 'Geofence breach', className: 'badge-warning' },
  anomaly: { text: 'Movement anomaly', className: 'badge-primary' },
};

const cell = { padding: '16px 8px' };
const headerCell = {
  color: 'var(--text-muted)',
  fontSize: '11px',
  fontWeight: 800,
  textTransform: 'uppercase',
  padding: '12px 8px',
};

export default function SosPanel({ alerts, onResolve }) {
  return (
    <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Radio size={20} color="var(--color-danger)" className={alerts.length > 0 ? 'animate-pulse-red' : ''} />
          <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Live SOS dispatch</h3>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>Unresolved distress beacons</p>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <th style={headerCell}>State</th>
              <th style={headerCell}>User</th>
              <th style={headerCell}>Trigger</th>
              <th style={headerCell}>Notified</th>
              <th style={headerCell}>Coordinates</th>
              <th style={headerCell}>Time</th>
              <th style={headerCell} />
            </tr>
          </thead>
          <tbody>
            {alerts.map(alert => {
              const trigger = TRIGGER_LABELS[alert.trigger] || TRIGGER_LABELS.manual;
              const notifications = alert.notifications || [];
              const sent = notifications.filter(n => n.status === 'sent').length;

              return (
                <tr key={alert._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <td style={cell}>
                    <span
                      style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-danger)', display: 'inline-block' }}
                      className="animate-pulse-red"
                    />
                  </td>
                  <td style={{ ...cell, fontSize: '13px', fontWeight: 600 }}>{alert.email}</td>
                  <td style={cell}>
                    <span className={`badge ${trigger.className}`} style={{ fontSize: '10px' }}>
                      {trigger.text}
                      {alert.aiScore != null ? ` · ${alert.aiScore}/100` : ''}
                    </span>
                  </td>
                  <td style={{ ...cell, fontSize: '12px', color: sent ? 'var(--color-success)' : 'var(--color-warning)' }}>
                    {notifications.length === 0
                      ? 'no contacts'
                      : sent > 0
                        ? `${sent}/${notifications.length} sent`
                        : 'not sent'}
                  </td>
                  <td style={{ ...cell, fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={12} color="var(--color-primary)" />
                      {alert.lat != null && alert.lng != null
                        ? `${alert.lat.toFixed(4)}, ${alert.lng.toFixed(4)}`
                        : 'unknown'}
                    </div>
                  </td>
                  <td style={{ ...cell, fontSize: '12px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  </td>
                  <td style={cell}>
                    <button
                      onClick={() => onResolve(alert._id)}
                      className="glass-card"
                      style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}
                    >
                      <Check size={12} /> Resolve
                    </button>
                  </td>
                </tr>
              );
            })}
            {alerts.length === 0 && (
              <tr>
                <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                  🟢 No active distress signals.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
