import { useCallback, useEffect, useRef, useState } from 'react';
import { api, UnauthorizedError } from '../api';

const REFRESH_MS = 10000;

const EMPTY_STATS = {
  totalUsers: 0,
  activeJourneys: 0,
  anomaliesDetected: 0,
  activeSosCount: 0,
};

function computeStats(profiles, alerts, anomalies) {
  return {
    totalUsers: profiles.length,
    activeJourneys: profiles.filter(p => p.activeJourney).length,
    // Every anomaly the engine flagged — a detection count, not a claim that
    // something was prevented.
    anomaliesDetected: anomalies.filter(a => a.anomaly_flag).length,
    activeSosCount: alerts.length,
  };
}

/**
 * Polls the operator endpoints. Polling pauses while the tab is hidden, and the
 * loading flag is only raised for the first load so a background refresh does
 * not flash the whole dashboard.
 */
export function useDashboardData(authorized) {
  const [profiles, setProfiles] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  const hasLoadedOnce = useRef(false);

  const fetchData = useCallback(async () => {
    if (!hasLoadedOnce.current) setLoading(true);

    try {
      const [profileData, sosData, anomalyData] = await Promise.all([
        api.profiles(),
        api.sosAlerts(),
        api.anomalyLog(),
      ]);

      const activeProfiles = Array.isArray(profileData.profiles) ? profileData.profiles : [];
      const activeAlerts = (sosData.alerts || []).filter(a => a.status !== 'resolved');
      const recentAnomalies = anomalyData.logs || [];

      setProfiles(activeProfiles);
      setAlerts(activeAlerts);
      setAnomalies(recentAnomalies);
      setStats(computeStats(activeProfiles, activeAlerts, recentAnomalies));
      setIsLive(true);
      setUnauthorized(false);
      hasLoadedOnce.current = true;
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        setUnauthorized(true);
      } else {
        console.warn('Dashboard refresh failed:', err.message);
      }
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authorized) return undefined;

    let timer;
    const start = () => {
      fetchData();
      timer = setInterval(fetchData, REFRESH_MS);
    };
    const stop = () => clearInterval(timer);

    const onVisibilityChange = () => {
      stop();
      if (document.visibilityState === 'visible') start();
    };

    start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [authorized, fetchData]);

  const resolveAlert = useCallback(async id => {
    await api.resolveAlert(id);
    await fetchData();
  }, [fetchData]);

  return { profiles, alerts, anomalies, stats, loading, isLive, unauthorized, refresh: fetchData, resolveAlert };
}
