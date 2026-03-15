import React from 'react';
import { RU as t } from '../constants/locales';

const ProfileView = ({ profile, onEdit }) => (
  <div className="animate-fade-in">
    <div className="card-soft" style={{ textAlign: 'center', padding: '40px 24px', marginBottom: '24px' }}>
      <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--accent-blue)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', color: 'var(--primary)', fontWeight: 700 }}>
        {profile?.firstName?.[0] || 'U'}
      </div>
      <h2 style={{ color: 'var(--primary)', marginBottom: '4px' }}>{profile?.firstName} {profile?.lastName}</h2>
      <p style={{ color: '#a0aec0', marginBottom: 0 }}>@{profile?.username || 'username'}</p>
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginTop: '32px' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '20px', color: 'var(--primary)' }}>12</div>
          <div style={{ fontSize: '12px', color: '#a0aec0', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.profile.meetings}</div>
        </div>
        <div style={{ width: '1px', background: '#edf2f7' }} />
        <div>
          <div style={{ fontWeight: 800, fontSize: '20px', color: 'var(--primary)' }}>48</div>
          <div style={{ fontSize: '12px', color: '#a0aec0', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.profile.connections}</div>
        </div>
      </div>
    </div>

    <div className="card-soft" style={{ padding: '24px', marginBottom: '24px' }}>
      <h3 style={{ color: 'var(--primary)', marginBottom: '20px', fontSize: '18px' }}>{t.profile.messengers}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <InfoRow label="Telegram" value={profile?.telegram ? `@${profile.telegram}` : null} />
        <InfoRow label="WhatsApp" value={profile?.whatsapp} />
      </div>
    </div>

    <div className="card-soft" style={{ padding: '24px', marginBottom: '100px' }}>
      <h3 style={{ color: 'var(--primary)', marginBottom: '20px', fontSize: '18px' }}>{t.profile.personal_info}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <InfoRow label={t.profile.about} value={profile?.about} isBio />
        <InfoRow label={t.profile.looking_for} value={profile?.lookingFor} />
        <div style={{ height: '1px', background: '#edf2f7', margin: '4px 0' }} />
        <InfoRow label={t.profile.company} value={profile?.company} />
        <InfoRow label={t.profile.position} value={profile?.position} />
        <div style={{ height: '1px', background: '#edf2f7', margin: '4px 0' }} />
        <InfoRow label={t.profile.country} value={profile?.country} />
        <InfoRow label={t.profile.region} value={profile?.region} />
        <InfoRow label={t.profile.city} value={profile?.city} />
        <div style={{ height: '1px', background: '#edf2f7', margin: '4px 0' }} />
        <InfoRow label={t.profile.email} value={profile?.email} />
        <InfoRow label={t.profile.phone} value={profile?.phone} />
      </div>
      
      <button className="btn-solid" style={{ width: '100%', marginTop: '32px' }} onClick={onEdit}>
        {t.profile.update_btn}
      </button>
    </div>
  </div>
);

const InfoRow = ({ label, value, isBio }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
    <label style={{ fontSize: '10px', fontWeight: 800, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>
    <div style={{ 
      color: value ? 'var(--primary-text)' : '#cbd5e0', 
      fontWeight: 600, 
      fontSize: '15px',
      lineHeight: isBio ? 1.5 : 1.2
    }}>
      {value || t.profile.not_set}
    </div>
  </div>
);

export default ProfileView;
