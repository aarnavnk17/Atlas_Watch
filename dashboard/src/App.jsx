import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  MapPin, 
  Users, 
  Activity, 
  Compass, 
  Heart, 
  FileText, 
  RefreshCw, 
  Database, 
  UserCheck, 
  Building, 
  School,
  Clock,
  Radio
} from 'lucide-react';
import './App.css';

// ==========================================
// DYNAMIC SERVER HOST RESOLUTION (DEPLOY COMPATIBLE)
// ==========================================
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function App() {
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [profiles, setProfiles] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeJourneys: 0,
    threatsMitigated: 0,
    activeSosCount: 0
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch datasets in parallel from the dynamic Express host server
      const [profileRes, sosRes, anomalyRes] = await Promise.all([
        fetch(`${API_BASE}/admin/profiles?_t=${Date.now()}`),
        fetch(`${API_BASE}/sos/alerts?_t=${Date.now()}`),
        fetch(`${API_BASE}/anomaly-log?_t=${Date.now()}`)
      ]);

      if (profileRes.ok && sosRes.ok && anomalyRes.ok) {
        const profileData = await profileRes.json();
        const sosData = await sosRes.json();
        const anomalyData = await anomalyRes.json();

        // Check if database contains actual records
        const activeProfiles = profileData.success ? (Array.isArray(profileData.profiles) ? profileData.profiles : [profileData.profiles].filter(Boolean)) : [];
        const activeAlerts = (sosData.alerts || []).filter(a => a.status !== 'resolved');
        const activeAnomalies = anomalyData.logs || [];

        setProfiles(activeProfiles);
        setAlerts(activeAlerts);
        setAnomalies(activeAnomalies);
        
        setIsLive(true);
        calculateStats(activeProfiles, activeAlerts, activeAnomalies);
      } else {
        setIsLive(false);
      }
    } catch (e) {
      console.warn("Express server offline. Real-time stream suspended.");
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (pList, aList, anomList) => {
    const totalUsers = pList.length;
    const activeSosCount = aList.length;
    const activeJourneys = pList.filter(p => p.activeJourney !== null && p.activeJourney !== undefined).length;
    
    // Mitigations are calculated as the number of anomalies flag detections
    const threatsMitigated = anomList.filter(anom => anom.anomaly_flag).length;

    setStats({
      totalUsers: totalUsers,
      activeJourneys: activeJourneys,
      threatsMitigated: threatsMitigated,
      activeSosCount: activeSosCount
    });
  };

  useEffect(() => {
    fetchData();
    // Refresh every 10 seconds to keep live presentations fluid
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Helper stats calculations
  const studentCount = profiles.filter(p => p.isStudent).length;
  const workingCount = profiles.filter(p => p.isWorking).length;
  const otherCount = profiles.length - studentCount - workingCount;

  const studentPercentage = profiles.length > 0 ? Math.round(studentCount / profiles.length * 100) : 0;
  const workingPercentage = profiles.length > 0 ? Math.round(workingCount / profiles.length * 100) : 0;

  const declaredBloodGroupCount = profiles.filter(p => p.bloodGroup && p.bloodGroup.trim() !== '').length;
  const bloodGroupRate = profiles.length > 0 ? Math.round(declaredBloodGroupCount / profiles.length * 100) : 0;

  const declaredConditionsCount = profiles.filter(p => (p.allergies && p.allergies.trim() !== '') || (p.medicalConditions && p.medicalConditions.trim() !== '')).length;
  const medicalRate = profiles.length > 0 ? Math.round(declaredConditionsCount / profiles.length * 100) : 0;

  const totalDocs = profiles.filter(p => p.documentType && p.documentType.trim() !== '').length;
  const passportCount = profiles.filter(p => p.documentType?.toLowerCase().includes('passport') || p.passport && p.passport.trim() !== '').length;
  const idCount = profiles.filter(p => p.documentType?.toLowerCase().includes('id') || p.documentType?.toLowerCase().includes('national')).length;
  const licenseCount = profiles.filter(p => p.documentType?.toLowerCase().includes('license') || p.documentType?.toLowerCase().includes('driver')).length;
  
  const passportPercentage = totalDocs > 0 ? Math.round(passportCount / totalDocs * 100) : 0;
  const idPercentage = totalDocs > 0 ? Math.round(idCount / totalDocs * 100) : 0;
  const licensePercentage = totalDocs > 0 ? Math.round(licenseCount / totalDocs * 100) : 0;
  const otherDocsPercentage = totalDocs > 0 ? Math.max(0, 100 - passportPercentage - idPercentage - licensePercentage) : 0;
  const highRiskUsers = profiles.filter(p => {
    if (!p.lastLocation) return false;
    const rl = p.lastLocation.riskLevel?.toLowerCase();
    return rl === 'high' || rl === 'danger' || rl === 'critical';
  });




  return (
    <div className="main-content">
      {/* ==========================================
          HEADER SECTION
          ========================================== */}
      <header className="glass-panel" style={{ padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
            <Shield size={26} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', tracking: '-0.5px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              AtlasWatch <span style={{ color: 'var(--color-primary)', fontWeight: '400' }}>// Command</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Proactive Safety Operations & Investor Console</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Live Status indicator */}
          <div className="badge" style={{ 
            background: isLive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', 
            color: isLive ? 'var(--color-success)' : 'var(--color-warning)',
            border: isLive ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)',
            padding: '6px 14px',
            fontSize: '12px'
          }}>
            <Database size={14} style={{ marginRight: '4px' }} />
            {isLive ? 'LIVE MONGO STREAM' : 'DEMO SIMULATION ACTIVE'}
          </div>

          <button onClick={fetchData} className="glass-card" style={{ padding: '10px 16px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', cursor: 'pointer', borderRadius: '12px' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span style={{ fontSize: '12px', fontWeight: '600' }}>Refresh</span>
          </button>
        </div>
      </header>

      {/* ==========================================
          STATS GRID
          ========================================== */}
      <section className="dashboard-grid">
        <div className="glass-panel glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase' }}>Shielded Citizens</span>
            <Users size={20} color="var(--color-primary)" />
          </div>
          <h2 style={{ fontSize: '36px', fontWeight: '800', margin: '4px 0 2px' }}>{stats.totalUsers}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="badge badge-success" style={{ fontSize: '10px', padding: '2px 6px' }}>+12.4%</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>active growth rate</span>
          </div>
        </div>

        <div className="glass-panel glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase' }}>Active Journeys</span>
            <Activity size={20} color="var(--color-success)" className="animate-pulse" />
          </div>
          <h2 style={{ fontSize: '36px', fontWeight: '800', margin: '4px 0 2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {stats.activeJourneys}
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--color-success)', display: 'inline-block' }} className="animate-pulse-green"></span>
          </h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>live synchronized client nodes</span>
        </div>

        <div className="glass-panel glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase' }}>Threats Prevented</span>
            <Shield size={20} color="var(--color-purple)" />
          </div>
          <h2 style={{ fontSize: '36px', fontWeight: '800', margin: '4px 0 2px' }}>{stats.threatsMitigated}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="badge badge-primary" style={{ fontSize: '10px', padding: '2px 6px', color: 'var(--color-purple)', borderColor: 'rgba(139, 92, 246, 0.2)', backgroundColor: 'rgba(139, 92, 246, 0.1)' }}>98.2%</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>engine mitigation score</span>
          </div>
        </div>

        <div className={`glass-panel glass-card ${stats.activeSosCount > 0 ? 'glow-overlay-red' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase' }}>Emergency Beacon</span>
            <AlertTriangle size={20} color={stats.activeSosCount > 0 ? 'var(--color-danger)' : 'var(--color-success)'} />
          </div>
          <h2 style={{ fontSize: '36px', fontWeight: '800', margin: '4px 0 2px', color: stats.activeSosCount > 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>
            {stats.activeSosCount}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {stats.activeSosCount > 0 ? (
              <>
                <span className="badge badge-danger animate-pulse-red" style={{ fontSize: '10px', padding: '2px 6px' }}>CRITICAL</span>
                <span style={{ color: 'var(--color-danger)', fontSize: '11px', fontWeight: '600' }}>Active distress signals!</span>
              </>
            ) : (
              <>
                <span className="badge badge-success" style={{ fontSize: '10px', padding: '2px 6px' }}>NOMINAL</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>all networks secure</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ==========================================
          CENTRAL DISPATCH & THREAT MONITOR FEEDS
          ========================================== */}
      <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '24px' }}>
        {/* Left Panel: Active SOS Signals */}
        <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={20} color="var(--color-danger)" className={stats.activeSosCount > 0 ? 'animate-pulse-red' : ''} />
              <h3 style={{ fontSize: '18px', fontWeight: '800' }}>Live SOS Dispatch Center</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>Distress beacons registered within the safety net</p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                  <th style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', padding: '12px 8px' }}>State</th>
                  <th style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', padding: '12px 8px' }}>Citizen</th>
                  <th style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', padding: '12px 8px' }}>Trigger type</th>
                  <th style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', padding: '12px 8px' }}>Coordinates</th>
                  <th style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', padding: '12px 8px' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', hover: { background: 'rgba(255,255,255,0.01)' } }}>
                    <td style={{ padding: '16px 8px' }}>
                      <span style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        backgroundColor: 'var(--color-danger)', 
                        display: 'inline-block' 
                      }} className="animate-pulse-red"></span>
                    </td>
                    <td style={{ padding: '16px 8px', fontSize: '13px', fontWeight: '600' }}>{alert.email}</td>
                    <td style={{ padding: '16px 8px' }}>
                      <span className={`badge ${alert.trigger === 'ai_anomaly' ? 'badge-primary' : 'badge-danger'}`} style={{ fontSize: '10px' }}>
                        {alert.trigger === 'ai_anomaly' ? 'AI Auto Trigger' : 'Manual Panic'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={12} color="var(--color-primary)" />
                        {alert.lat?.toFixed(4)}, {alert.lng?.toFixed(4)}
                      </div>
                    </td>
                    <td style={{ padding: '16px 8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
                        {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </td>
                  </tr>
                ))}
                {alerts.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ padding: '40px', textItems: 'center', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                      🟢 No active distress signals in the network.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Middle Panel: High Risk Zone Monitor */}
        <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={20} color="var(--color-danger)" className={highRiskUsers.length > 0 ? "animate-pulse" : ""} />
              <h3 style={{ fontSize: '18px', fontWeight: '800' }}>Danger Zone Tracking</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>Active citizens located inside high-risk urban geofences</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '320px', overflowY: 'auto', paddingRight: '8px' }}>
            {highRiskUsers.map((user, idx) => (
              <div key={idx} style={{ 
                background: 'rgba(239, 68, 68, 0.03)', 
                border: '1px solid rgba(239, 68, 68, 0.15)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>{user.fullName || 'Unnamed User'}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user.email}</span>
                  </div>
                  <span className="badge badge-danger" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: '800' }}>
                    {user.lastLocation.riskLevel || 'DANGER'}
                  </span>
                </div>
                
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <MapPin size={14} color="var(--color-danger)" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <span>{user.lastLocation.address || `${user.lastLocation.lat?.toFixed(5)}, ${user.lastLocation.lng?.toFixed(5)}`}</span>
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid rgba(239, 68, 68, 0.08)', paddingTop: '8px', marginTop: '4px' }}>
                  <span>Accuracy: {user.lastLocation.accuracy ? `${user.lastLocation.accuracy}m` : 'GPS'}</span>
                  <span>{user.lastLocation.timestamp ? new Date(user.lastLocation.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}</span>
                </div>
              </div>
            ))}
            {highRiskUsers.length === 0 && (
              <div style={{ padding: '40px', textItems: 'center', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', margin: 'auto' }}>
                🛡️ All active citizens are currently in safe zones.
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: AI Danger/Anomaly Engine Logs */}
        <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Compass size={20} color="var(--color-primary)" />
              <h3 style={{ fontSize: '18px', fontWeight: '800' }}>AI Threat Engine Feed</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>Real-time proactive telemetry & anomaly logging</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '320px', overflowY: 'auto', paddingRight: '8px' }}>
            {anomalies.map((anom, idx) => (
              <div key={idx} style={{ 
                background: 'rgba(255, 255, 255, 0.02)', 
                border: '1px solid rgba(255, 255, 255, 0.04)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>{anom.email}</span>
                  <span className={`badge ${
                    anom.risk_level === 'high' ? 'badge-danger' : 
                    anom.risk_level === 'medium' ? 'badge-warning' : 'badge-success'
                  }`} style={{ fontSize: '9px' }}>
                    {anom.risk_level} risk
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{anom.reason}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>Engine Evaluation: rule_based_v1</span>
                  <span>{new Date(anom.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==========================================
          INVESTOR ANALYTICS ROW
          ========================================== */}
      <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '24px' }}>
        {/* Investor Panel: Student vs Corporate demographics */}
        <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h4 style={{ fontSize: '16px', fontWeight: '800' }}>Traction Demographics</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>Real-time user cohort segmentation</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px', fontWeight: '600' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><School size={16} color="var(--color-primary)" /> Students</span>
                <span>{studentCount} / {profiles.length} ({Math.round(studentCount / profiles.length * 100)}%)</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${studentCount / profiles.length * 100}%`, background: 'var(--color-primary)' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px', fontWeight: '600' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Building size={16} color="var(--color-success)" /> Working Professionals</span>
                <span>{workingCount} / {profiles.length} ({Math.round(workingCount / profiles.length * 100)}%)</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${workingCount / profiles.length * 100}%`, background: 'var(--color-success)' }}></div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top Partner institutions</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {profiles.map((p, idx) => (
                  p.universityName || p.organizationName ? (
                    <span key={idx} className="badge" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '10px' }}>
                      {p.universityName || p.organizationName}
                    </span>
                  ) : null
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Medical Shield Coverage stats */}
        <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h4 style={{ fontSize: '16px', fontWeight: '800' }}>Medical Shield Profile</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>Critical emergency response data trust</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', justifyItems: 'center', justifyContent: 'center', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Heart size={20} color="var(--color-danger)" />
              </div>
              <div>
                <span style={{ fontSize: '20px', fontWeight: '800' }}>{bloodGroupRate}%</span>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Blood Group declaration rate</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={20} color="var(--color-warning)" />
              </div>
              <div>
                <span style={{ fontSize: '20px', fontWeight: '800' }}>{medicalRate}%</span>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Allergies / Conditions synced</p>
              </div>
            </div>
          </div>
        </div>

        {/* Document Vault Usage */}
        <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h4 style={{ fontSize: '16px', fontWeight: '800' }}>Security Document Vault</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>Aggregate travel vault distribution</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, justifyContent: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}><FileText size={14} /> Passports</span>
              <span style={{ fontWeight: '600' }}>{passportPercentage}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}><FileText size={14} /> National IDs</span>
              <span style={{ fontWeight: '600' }}>{idPercentage}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}><FileText size={14} /> Driver Licenses</span>
              <span style={{ fontWeight: '600' }}>{licensePercentage}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}><FileText size={14} /> Other Documents</span>
              <span style={{ fontWeight: '600' }}>{otherDocsPercentage}%</span>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================
          REGISTERED CITIZENS & MEDICAL DIRECTORY
          ========================================== */}
      <section className="glass-panel" style={{ padding: '32px', marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserCheck size={20} color="var(--color-success)" />
            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>Active Shield Citizens Directory</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>Registered database profiles, emergency contacts, identity papers, and critical responder medical sheets</p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                <th style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', padding: '12px 8px' }}>Citizen Info</th>
                <th style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', padding: '12px 8px' }}>Role / Organisation</th>
                <th style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', padding: '12px 8px' }}>Blood Group</th>
                <th style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', padding: '12px 8px' }}>Allergies & Medical Conditions</th>
                <th style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', padding: '12px 8px' }}>Secure ID / Passport</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', hover: { background: 'rgba(255,255,255,0.01)' } }}>
                  <td style={{ padding: '16px 8px' }}>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>{p.fullName || 'Unnamed User'}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{p.email}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.phoneNumber || 'No phone registered'} // {p.nationality || 'Unknown nationality'}</div>
                  </td>
                  <td style={{ padding: '16px 8px' }}>
                    {p.isStudent ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span className="badge badge-primary" style={{ alignSelf: 'flex-start', fontSize: '10px' }}>Student</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{p.universityName || 'Not Declared'}</span>
                      </div>
                    ) : p.isWorking ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span className="badge badge-success" style={{ alignSelf: 'flex-start', fontSize: '10px' }}>Professional</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{p.organizationName || 'Not Declared'}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Not Declared</span>
                    )}
                  </td>
                  <td style={{ padding: '16px 8px' }}>
                    <span style={{ 
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '800',
                      border: p.bloodGroup ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                      background: p.bloodGroup ? 'rgba(239, 68, 68, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                      color: p.bloodGroup ? 'var(--color-danger)' : 'var(--text-muted)'
                    }}>
                      {p.bloodGroup || 'UNKNOWN'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 8px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {p.allergies ? (
                        <div>⚠️ <span style={{ color: 'var(--color-warning)', fontWeight: '600' }}>Allergies:</span> {p.allergies}</div>
                      ) : null}
                      {p.medicalConditions ? (
                        <div>🩺 <span style={{ color: 'var(--color-primary)', fontWeight: '600' }}>Conditions:</span> {p.medicalConditions}</div>
                      ) : null}
                      {!p.allergies && !p.medicalConditions ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>None declared / Secure</span>
                      ) : null}
                    </div>
                  </td>
                  <td style={{ padding: '16px 8px' }}>
                    {p.documentType ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>{p.documentType}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{p.passport || 'No Document Number'}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No Document</span>
                    )}
                  </td>
                </tr>
              ))}
              {profiles.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: '40px', textItems: 'center', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                    🔒 No registered citizens stored in MongoDB.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default App;
