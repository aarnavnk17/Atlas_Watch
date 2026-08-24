import { School, Building, Heart, AlertTriangle, FileText } from 'lucide-react';

/** Percentage helper that returns 0 rather than NaN for an empty cohort. */
const percent = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

function Bar({ icon, label, count, total, color }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px', fontWeight: 600 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{icon} {label}</span>
        <span>{count} / {total} ({percent(count, total)}%)</span>
      </div>
      <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${percent(count, total)}%`, background: color }} />
      </div>
    </div>
  );
}

export function DemographicsPanel({ profiles }) {
  const students = profiles.filter(p => p.isStudent).length;
  const working = profiles.filter(p => p.isWorking).length;
  const institutions = [...new Set(profiles.map(p => p.universityName || p.organizationName).filter(Boolean))];

  return (
    <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h4 style={{ fontSize: '16px', fontWeight: 800 }}>User cohorts</h4>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>Self-declared during profile setup</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Bar icon={<School size={16} color="var(--color-primary)" />} label="Students" count={students} total={profiles.length} color="var(--color-primary)" />
        <Bar icon={<Building size={16} color="var(--color-success)" />} label="Working professionals" count={working} total={profiles.length} color="var(--color-success)" />

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Institutions represented
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
            {institutions.map(name => (
              <span key={name} className="badge" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '10px' }}>
                {name}
              </span>
            ))}
            {institutions.length === 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>None declared yet</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MedicalPanel({ profiles }) {
  const withBloodGroup = profiles.filter(p => p.bloodGroup?.trim()).length;
  const withMedical = profiles.filter(p => p.allergies?.trim() || p.medicalConditions?.trim()).length;

  const rows = [
    { icon: <Heart size={20} color="var(--color-danger)" />, background: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239,68,68,0.2)', value: percent(withBloodGroup, profiles.length), label: 'have declared a blood group' },
    { icon: <AlertTriangle size={20} color="var(--color-warning)" />, background: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245,158,11,0.2)', value: percent(withMedical, profiles.length), label: 'have allergies or conditions on file' },
  ];

  return (
    <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h4 style={{ fontSize: '16px', fontWeight: 800 }}>Responder data coverage</h4>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>What first responders would receive</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'center', flex: 1 }}>
        {rows.map(row => (
          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: row.background, border: `1px solid ${row.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {row.icon}
            </div>
            <div>
              <span style={{ fontSize: '20px', fontWeight: 800 }}>{row.value}%</span>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{row.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VaultPanel({ profiles }) {
  const declared = profiles.filter(p => p.documentType?.trim());
  const matches = pattern => declared.filter(p => pattern.test(p.documentType.toLowerCase())).length;

  const passports = matches(/passport/);
  const ids = matches(/id|national/);
  const licenses = matches(/licen[cs]e|driver/);
  const other = Math.max(0, declared.length - passports - ids - licenses);

  const rows = [
    ['Passports', passports],
    ['National IDs', ids],
    ['Driving licences', licenses],
    ['Other documents', other],
  ];

  return (
    <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h4 style={{ fontSize: '16px', fontWeight: 800 }}>Identity documents</h4>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
          {declared.length} of {profiles.length} users have declared a document type
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, justifyContent: 'center' }}>
        {rows.map(([label, count]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <FileText size={14} /> {label}
            </span>
            <span style={{ fontWeight: 600 }}>{count} ({percent(count, declared.length)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
