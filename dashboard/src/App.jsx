import { useMemo, useState } from 'react';

import './App.css';
import { clearAdminKey, getAdminKey } from './api';
import { useDashboardData } from './hooks/useDashboardData';
import AdminKeyGate from './components/AdminKeyGate';
import Header from './components/Header';
import StatsGrid from './components/StatsGrid';
import SosPanel from './components/SosPanel';
import DangerZonePanel from './components/DangerZonePanel';
import AnomalyFeed from './components/AnomalyFeed';
import { DemographicsPanel, MedicalPanel, VaultPanel } from './components/CohortPanels';
import CitizensTable from './components/CitizensTable';

const HIGH_RISK_LEVELS = new Set(['high', 'danger', 'critical']);

export default function App() {
  const [hasKey, setHasKey] = useState(() => Boolean(getAdminKey()));
  const { profiles, alerts, anomalies, stats, loading, isLive, unauthorized, refresh, resolveAlert } =
    useDashboardData(hasKey);

  const highRiskUsers = useMemo(
    () => profiles.filter(p => p.lastLocation && HIGH_RISK_LEVELS.has(p.lastLocation.riskLevel?.toLowerCase())),
    [profiles],
  );

  const lock = () => {
    clearAdminKey();
    setHasKey(false);
  };

  if (!hasKey || unauthorized) {
    return <AdminKeyGate onUnlock={() => setHasKey(true)} rejected={unauthorized} />;
  }

  return (
    <div className="main-content">
      <Header isLive={isLive} loading={loading} onRefresh={refresh} onLock={lock} />

      <StatsGrid stats={stats} />

      <section style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.1fr 1fr', gap: '24px' }}>
        <SosPanel alerts={alerts} onResolve={resolveAlert} />
        <DangerZonePanel users={highRiskUsers} />
        <AnomalyFeed anomalies={anomalies} />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '24px' }}>
        <DemographicsPanel profiles={profiles} />
        <MedicalPanel profiles={profiles} />
        <VaultPanel profiles={profiles} />
      </section>

      <CitizensTable profiles={profiles} />
    </div>
  );
}
