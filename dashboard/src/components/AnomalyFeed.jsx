import { Compass } from 'lucide-react';

const RISK_BADGE = {
  high: 'badge-danger',
  medium: 'badge-warning',
  low: 'badge-success',
};

export default function AnomalyFeed({ anomalies }) {
  return (
    <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Compass size={20} color="var(--color-primary)" />
          <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Risk engine feed</h3>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>Most recent movement evaluations</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '320px', overflowY: 'auto', paddingRight: '8px' }}>
        {anomalies.map(anomaly => (
          <div
            key={anomaly._id}
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 700 }}>{anomaly.email}</span>
              <span className={`badge ${RISK_BADGE[anomaly.risk_level] || 'badge-success'}`} style={{ fontSize: '9px' }}>
                {anomaly.risk_level} risk
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{anomaly.reason}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span>{anomaly.anomaly_flag ? 'Anomaly flagged' : 'Nominal'}</span>
              <span>{new Date(anomaly.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        ))}
        {anomalies.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', margin: 'auto' }}>
            No evaluations recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}
