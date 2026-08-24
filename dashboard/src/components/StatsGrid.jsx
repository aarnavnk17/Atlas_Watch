import { Users, Activity, Shield, AlertTriangle } from 'lucide-react';

function StatCard({ label, value, icon, footnote, danger, children }) {
  return (
    <div className={`glass-panel glass-card ${danger ? 'glow-overlay-red' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>{label}</span>
        {icon}
      </div>
      <h2 style={{ fontSize: '36px', fontWeight: 800, margin: '4px 0 2px', display: 'flex', alignItems: 'center', gap: '8px', color: danger ? 'var(--color-danger)' : 'var(--text-primary)' }}>
        {value}
        {children}
      </h2>
      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{footnote}</span>
    </div>
  );
}

/**
 * Counts come from the database. The previous version sat fabricated figures
 * ("+12.4% growth", "98.2% mitigation score") next to the real ones, which made
 * every number on the page look like a guess.
 */
export default function StatsGrid({ stats }) {
  const sosActive = stats.activeSosCount > 0;

  return (
    <section className="dashboard-grid">
      <StatCard
        label="Registered users"
        value={stats.totalUsers}
        icon={<Users size={20} color="var(--color-primary)" />}
        footnote="accounts in the database"
      />

      <StatCard
        label="Active journeys"
        value={stats.activeJourneys}
        icon={<Activity size={20} color="var(--color-success)" className="animate-pulse" />}
        footnote="journeys currently being tracked"
      >
        {stats.activeJourneys > 0 && (
          <span
            style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--color-success)', display: 'inline-block' }}
            className="animate-pulse-green"
          />
        )}
      </StatCard>

      <StatCard
        label="Anomalies detected"
        value={stats.anomaliesDetected}
        icon={<Shield size={20} color="var(--color-purple)" />}
        footnote="flagged in the last 200 engine evaluations"
      />

      <StatCard
        label="Active SOS"
        value={stats.activeSosCount}
        icon={<AlertTriangle size={20} color={sosActive ? 'var(--color-danger)' : 'var(--color-success)'} />}
        footnote={sosActive ? 'unresolved distress signals' : 'no active distress signals'}
        danger={sosActive}
      />
    </section>
  );
}
