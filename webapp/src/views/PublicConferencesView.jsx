import React, { useState } from 'react';
import { RU as t } from '../constants/locales';

const PublicConferencesView = ({ onBack, onJoinConference }) => {
  const [activeTab, setActiveTab] = useState('upcoming');

  const upcomingConferences = [
    {
      id: 1,
      name: 'Vooky Music App Weekly Sync With Developers',
      date: '20 Мая',
      day: 'Сегодня',
      startingIn: '02 часа',
      duration: '40 минут',
      repeat: 'Еженедельно',
      docs: '2 Документа',
      participants: 7
    }
  ];

  const pastConferences = [
{ id: 2, name: 'Встреча с сотрудниками Оксфордского университета', date: 'Пятница, 24 апреля 2019 г.', time: '15:00', docs: '3 документа', participants: 5 },

{ id: 3, name: 'Получайте обновления от разработчиков', date: 'Среда, 17 апреля 2019 г.', time: '14:00', docs: '2 документа', participants: 6 },

{ id: 4, name: 'Синхронизация проектов с UI-дизайнерами', date: 'Четверг, 11 апреля 2019 г.', time: '16:30', docs: '-', participants: 4 },

];

  return (
    <div className="animate-fade-in">
      {/* Tabs */}
      <div className="tabs-container">
        <div className={`tab-item ${activeTab === 'upcoming' ? 'active' : ''}`} onClick={() => setActiveTab('upcoming')}>
          Предстоящие
        </div>
        <div className={`tab-item ${activeTab === 'past' ? 'active' : ''}`} onClick={() => setActiveTab('past')}>
          Прошлое
        </div>
      </div>

      {activeTab === 'upcoming' ? (
        <div className="upcoming-list">
          {upcomingConferences.map(conf => (
            <div key={conf.id} className="card-soft animate-fade-in" style={{ padding: 0, borderRadius: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '24px 28px' }}>
                <div style={{ background: '#ef4444', color: 'white', padding: '6px 14px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', background: 'white', borderRadius: '50%' }}></span>
                  {conf.day?.toUpperCase()}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary-text)' }}>20</div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#a0aec0', textTransform: 'uppercase' }}>Мая</div>
                </div>
              </div>
              
              <div style={{ padding: '0 28px 28px 28px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, lineHeight: 1.3, marginBottom: '24px', color: 'var(--primary-text)' }}>{conf.name}</h2>
                
                <div style={{ display: 'flex', gap: '10px', marginBottom: '28px' }}>
                  <div style={{ background: '#f7fafc', padding: '10px 14px', borderRadius: '16px', flex: 1 }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#a0aec0', textTransform: 'uppercase', marginBottom: '4px' }}>Начало</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary-text)' }}>{conf.startingIn}</div>
                  </div>
                  <div style={{ background: '#f7fafc', padding: '10px 14px', borderRadius: '16px', flex: 1 }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#a0aec0', textTransform: 'uppercase', marginBottom: '4px' }}>Длительность</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary-text)' }}>{conf.duration}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ background: '#edf2fd', color: '#1565c0', padding: '6px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                      {conf.repeat}
                    </div>
                  </div>
                  <div className="participant-stack" style={{ display: 'flex', alignItems: 'center' }}>
                    {[1,2,3].map(i => (
                      <div key={i} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2.5px solid white', background: '#edf2f7', marginLeft: i > 0 ? '-12px' : 0, overflow: 'hidden' }}>
                        <div style={{ width: '100%', height: '100%', background: '#CBD5E0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>👤</div>
                      </div>
                    ))}
                    <div style={{ background: '#111111', color: 'white', fontSize: '10px', fontWeight: 800, width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2.5px solid white', marginLeft: '-12px' }}>
                      {conf.participants}+
                    </div>
                  </div>
                </div>
                
                <button className="btn-solid" style={{ marginTop: '24px' }} onClick={() => onJoinConference(conf.id)}>
                  Присоединиться к сессии
                </button>
              </div>
            </div>
          ))}
          <div style={{ textAlign: 'center', padding: '20px', color: '#a0aec0', fontSize: '14px' }}>
            Показано {upcomingConferences.length} из 26
          </div>
        </div>
      ) : (
        <div className="past-list">
          {pastConferences.map(conf => (
            <div key={conf.id} className="animate-fade-in" style={{ padding: '0 0 24px 0', borderBottom: '1px solid #edf2f7', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '18px', color: 'var(--primary)', marginBottom: '8px', lineHeight: 1.4 }}>{conf.name}</h3>
                  <div style={{ fontSize: '12px', color: '#a0aec0', fontWeight: 500 }}>
                    {conf.date} | {conf.time}
                  </div>
                </div>
                {/* <button style={{ background: 'none', border: 'none', padding: '4px', color: '#a0aec0' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                </button> */}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: "7px" }}>
                {/* <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#a0aec0' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  {conf.docs}
                </div> */}
                <div className="participant-stack" style={{ display: 'flex', alignItems: 'center' }}>
                  {[1,2,3].map(i => (
                    <div key={i} style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2px solid white', background: '#edf2f7', marginLeft: i > 0 ? '-10px' : 0, overflow: 'hidden' }}>
                      <img src={`https://i.pravatar.cc/100?u=${i+conf.id}`} alt="user" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                  <div style={{ background: '#4fd1c5', color: 'white', fontSize: '10px', fontWeight: 700, width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white', marginLeft: '-10px' }}>
                    {conf.participants}+
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* <button 
        className="btn-solid" 
        style={{ 
          position: 'fixed', bottom: '100px', right: '20px', 
          width: '60px', height: '60px', borderRadius: '30px', 
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)', zIndex: 900,
          padding: 0
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button> */}
    </div>
  );
};

export default PublicConferencesView;
