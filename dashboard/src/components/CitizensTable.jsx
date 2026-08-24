import { UserCheck } from 'lucide-react';

const headerCell = {
  color: 'var(--text-muted)',
  fontSize: '11px',
  fontWeight: 800,
  textTransform: 'uppercase',
  padding: '12px 8px',
};
const cell = { padding: '16px 8px' };

export default function CitizensTable({ profiles }) {
  return (
    <section className="glass-panel" style={{ padding: '32px', marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserCheck size={20} color="var(--color-success)" />
          <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Registered users</h3>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
          Identity and responder information. Handle as confidential personal data.
        </p>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <th style={headerCell}>User</th>
              <th style={headerCell}>Role / organisation</th>
              <th style={headerCell}>Blood group</th>
              <th style={headerCell}>Allergies &amp; conditions</th>
              <th style={headerCell}>Identity document</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map(profile => (
              <tr key={profile.email} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                <td style={cell}>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{profile.fullName || 'Unnamed user'}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{profile.email}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {profile.phoneNumber || 'No phone registered'} · {profile.nationality || 'Unknown nationality'}
                  </div>
                </td>
                <td style={cell}>
                  {profile.isStudent ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="badge badge-primary" style={{ alignSelf: 'flex-start', fontSize: '10px' }}>Student</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{profile.universityName || 'Not declared'}</span>
                    </div>
                  ) : profile.isWorking ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="badge badge-success" style={{ alignSelf: 'flex-start', fontSize: '10px' }}>Professional</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{profile.organizationName || 'Not declared'}</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Not declared</span>
                  )}
                </td>
                <td style={cell}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 800,
                      border: profile.bloodGroup ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                      background: profile.bloodGroup ? 'rgba(239, 68, 68, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                      color: profile.bloodGroup ? 'var(--color-danger)' : 'var(--text-muted)',
                    }}
                  >
                    {profile.bloodGroup || 'UNKNOWN'}
                  </span>
                </td>
                <td style={{ ...cell, fontSize: '13px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {profile.allergies && (
                      <div>⚠️ <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>Allergies:</span> {profile.allergies}</div>
                    )}
                    {profile.medicalConditions && (
                      <div>🩺 <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Conditions:</span> {profile.medicalConditions}</div>
                    )}
                    {!profile.allergies && !profile.medicalConditions && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>None declared</span>
                    )}
                  </div>
                </td>
                <td style={cell}>
                  {profile.documentType ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>{profile.documentType}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {profile.passport || 'No document number'}
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No document</span>
                  )}
                </td>
              </tr>
            ))}
            {profiles.length === 0 && (
              <tr>
                <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                  No registered users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
