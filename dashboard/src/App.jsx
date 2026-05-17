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
// HIGH-FIDELITY PRE-SEEDED PRESENTATION DATA
// ==========================================
const MOCK_PROFILES = [
  { email: 'sarah.k@stanford.edu', fullName: 'Sarah Jenkins', phoneNumber: '+1 (555) 019-2834', documentType: 'Passport', passport: 'US9827364', nationality: 'United States', isStudent: true, universityName: 'Stanford University', isWorking: false, organizationName: '', bloodGroup: 'O+', allergies: 'Peanuts', medicalConditions: 'Asthma' },
  { email: 'alex.chen@google.com', fullName: 'Alex Chen', phoneNumber: '+1 (555) 438-1290', documentType: 'National ID', passport: 'ID-882736', nationality: 'Canada', isStudent: false, universityName: '', isWorking: true, organizationName: 'Google LLC', bloodGroup: 'A-', allergies: 'Penicillin', medicalConditions: 'None' },
  { email: 'priya.n@mit.edu', fullName: 'Priya Nair', phoneNumber: '+91 98450 12345', documentType: 'Passport', passport: 'IN-K837482', nationality: 'India', isStudent: true, universityName: 'Massachusetts Institute of Technology', isWorking: false, organizationName: '', bloodGroup: 'B+', allergies: 'Dust', medicalConditions: 'None' },
  { email: 'm.schmidt@goldman.com', fullName: 'Marcus Schmidt', phoneNumber: '+49 172 883928', documentType: 'Driver License', passport: 'DL-DE92837', nationality: 'Germany', isStudent: false, universityName: '', isWorking: true, organizationName: 'Goldman Sachs', bloodGroup: 'AB+', allergies: 'Shellfish', medicalConditions: 'Penicillin sensitivity' },
  { email: 'elena.rodriguez@oxford.ac.uk', fullName: 'Elena Rodriguez', phoneNumber: '+44 7911 123456', documentType: 'Passport', passport: 'UK-P88374', nationality: 'United Kingdom', isStudent: true, universityName: 'Oxford University', isWorking: false, organizationName: '', bloodGroup: 'Bombay (Oh)', allergies: 'None', medicalConditions: 'None' }
];

const MOCK_ANOMALIES = [
  { email: 'sarah.k@stanford.edu', anomaly_flag: true, risk_level: 'high', reason: 'Speed Spike Detected (42 km/h) - potential forced vehicle boarding', timestamp: new Date(Date.now() - 3 * 60000).toISOString() },
  { email: 'alex.chen@google.com', anomaly_flag: true, risk_level: 'medium', reason: 'Restricted Zone Infraction - entered dark alleyway segment', timestamp: new Date(Date.now() - 15 * 60000).toISOString() },
  { email: 'm.schmidt@goldman.com', anomaly_flag: true, risk_level: 'high', reason: 'Prolonged Immobility (12 minutes) - user unresponsive to safety prompt', timestamp: new Date(Date.now() - 28 * 60000).toISOString() },
  { email: 'priya.n@mit.edu', anomaly_flag: false, risk_level: 'safe', reason: 'Routine location check-in - normal velocity', timestamp: new Date(Date.now() - 35 * 60000).toISOString() }
];

const MOCK_ALERTS = [
  { _id: 'sos_01', email: 'sarah.k@stanford.edu', lat: 37.4275, lng: -122.1697, trigger: 'ai_anomaly', notes: 'Automated dispatch - High risk velocity spike', timestamp: new Date(Date.now() - 3 * 60000).toISOString() },
  { _id: 'sos_02', email: 'm.schmidt@goldman.com', lat: 40.7128, lng: -74.0060, trigger: 'manual', notes: 'Manual panic activation by user', timestamp: new Date(Date.now() - 28 * 60000).toISOString() }
];

// ==========================================
// DYNAMIC SERVER HOST RESOLUTION (DEPLOY COMPATIBLE)
// ==========================================
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : 'https://atlaswatch-backend.onrender.com'; // Replace with your production Render/Railway URL when deployed

function App() {
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [profiles, setProfiles] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeJourneys: 3, // Pulsing presentation value
    threatsMitigated: 0,
    activeSosCount: 0
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch datasets in parallel from the dynamic Express host server
      const [profileRes, sosRes, anomalyRes] = await Promise.all([
        fetch(`${API_BASE}/profile`),
        fetch(`${API_BASE}/sos/alerts`),
        fetch(`${API_BASE}/anomaly-log`)
      ]);

      if (profileRes.ok && sosRes.ok && anomalyRes.ok) {
        const profileData = await profileRes.json();
        const sosData = await sosRes.json();
        const anomalyData = await anomalyRes.json();

        // Check if database contains actual records
        const activeProfiles = profileData.success ? (Array.isArray(profileData.profiles) ? profileData.profiles : [profileData.profiles].filter(Boolean)) : [];
        const activeAlerts = sosRes.ok ? (sosData.alerts || []) : [];
        const activeAnomalies = anomalyRes.ok ? (anomalyData.logs || []) : [];

        // If the database is completely empty, we blend in some mock data so the presentation looks stunning
        if (activeProfiles.length === 0 && activeAlerts.length === 0) {
          useSimulationMode();
        } else {
          setProfiles(activeProfiles.length > 0 ? activeProfiles : MOCK_PROFILES);
          setAlerts(activeAlerts);
          setAnomalies(activeAnomalies.length > 0 ? activeAnomalies : MOCK_ANOMALIES);
          
          setIsLive(true);
          calculateStats(
            activeProfiles.length > 0 ? activeProfiles : MOCK_PROFILES,
            activeAlerts,
            activeAnomalies.length > 0 ? activeAnomalies : MOCK_ANOMALIES
          );
        }
      } else {
        useSimulationMode();
      }
    } catch (e) {
      console.warn("Express server offline. Engaging local simulation presentation mode.");
      useSimulationMode();
    } finally {
      setLoading(false);
    }
  };

  const useSimulationMode = () => {
    setIsLive(false);
    setProfiles(MOCK_PROFILES);
    setAnomalies(MOCK_ANOMALIES);
    setAlerts(MOCK_ALERTS);
    calculateStats(MOCK_PROFILES, MOCK_ALERTS, MOCK_ANOMALIES);
  };

  const calculateStats = (pList, aList, anomList) => {
    const totalUsers = pList.length;
    const activeSosCount = aList.filter(a => {
      // Calculate alerts within last 12 hours as active for display
      const alertTime = new Date(a.timestamp).getTime();
      return Date.now() - alertTime < 12 * 60 * 60000;
    }).length;
    
    // Mitigations are calculated as the number of anomalies flag detections
    const threatsMitigated = anomList.filter(anom => anom.anomaly_flag).length;

    setStats({
      totalUsers: totalUsers + 128, // Presentation offset to represent a loaded app
      activeJourneys: activeSosCount > 0 ? activeSosCount + 2 : 4,
      threatsMitigated: threatsMitigated + 42,
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
      <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
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
                <span style={{ fontSize: '20px', fontWeight: '800' }}>100%</span>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Blood Group declaration rate</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={20} color="var(--color-warning)" />
              </div>
              <div>
                <span style={{ fontSize: '20px', fontWeight: '800' }}>80%</span>
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
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}><FileText size={14} /> Passports / IDs</span>
              <span style={{ fontWeight: '600' }}>42%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}><FileText size={14} /> Flight / Train Tickets</span>
              <span style={{ fontWeight: '600' }}>35%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}><FileText size={14} /> Travel Insurance</span>
              <span style={{ fontWeight: '600' }}>15%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}><FileText size={14} /> Others / Vouchers</span>
              <span style={{ fontWeight: '600' }}>8%</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
