import React from 'react';
import { RU as t } from '../constants/locales';

const HomeView = ({ user, onJoin, onPolls, accessPhase }) => (
  <div className="animate-fade-in">
    {accessPhase === 'grace' && (
      <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '16px', padding: '12px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '18px' }}>⚠️</span>
        <p style={{ fontSize: '13px', margin: 0, color: '#92400e', fontWeight: 600 }}>{t.access.grace_period} 1 {t.access.hours} 59 {t.access.minutes}</p>
      </div>
    )}

    <div className="card-soft" style={{ background: '#111111', color: 'white', display: 'flex', flexDirection: 'column', gap: '20px', borderRadius: '32px', padding: '32px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '150px', height: '150px', background: 'var(--link-color)', filter: 'blur(80px)', opacity: 0.4 }}></div>
      <h1 style={{ color: 'white', margin: 0, fontSize: '28px', lineHeight: 1.2 }}>Общайтесь и развивайтесь вместе с мыслителями со всего мира</h1>
      <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0, fontSize: '15px' }}>Найдите интересных людей и расширьте свою сеть контактов уже сегодня в нашем аудиосообществе.</p>
      
      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
        <button className="btn-solid" style={{ background: 'white', color: 'black', flex: 1, padding: '14px' }} onClick={onJoin}>
          Найти события
        </button>
      </div>
    </div>

    <div style={{ marginTop: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, color: 'var(--primary)' }}>Главные события</h3>
        <span style={{ fontSize: '12px', color: 'var(--link-color)', fontWeight: 700, cursor: 'pointer' }} onClick={onJoin}>Все</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="card-soft" style={{ padding: '20px', cursor: 'pointer' }} onClick={onJoin}>
          <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--primary)', marginBottom: '4px' }}>Tech Summit SF</div>
          <div style={{ fontSize: '13px', color: '#a0aec0' }}>Сан-Франциско • Завтра</div>
        </div>
      </div>
    </div>
    
    <div style={{ marginTop: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, color: 'var(--primary)' }}>Актуальные опросы</h3>
      </div>
      <div className="card-soft" style={{ padding: '20px', cursor: 'pointer' }} onClick={onPolls}>
        <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--primary)' }}>Что является наиболее важной темой для 2026 года?</div>
        <div style={{ fontSize: '12px', color: '#a0aec0', marginTop: '6px' }}>ИИ против устойчивого развития • 112 голосов</div>
      </div>
    </div>
  </div>
);

export default HomeView;
