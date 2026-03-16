import React from 'react';
import { RU as t } from '../constants/locales';

const ConferenceHomeView = ({ conference, onSeeAllQuestions, onSeeAllPolls, onViewProfile, members = [], polls = [], questions = [] }) => {
  const audience = members.slice(0, 7);
  const latestQuestion = questions.find(q => q.status === 'approved') || questions[0];
  const activePoll = polls.find(p => p.isActive) || polls[0];

  return (
    <div className="animate-fade-in" style={{ padding: '0 0 100px 0' }}>
      {/* Dark Host Card */}
      <div className="card-soft" style={{ background: '#111111', color: 'white', padding: '24px', borderRadius: '24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid var(--accent-blue)', padding: '2px', overflow: 'hidden' }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                {conference?.organizer?.avatarUrl ? (
                  <img src={conference.organizer.avatarUrl} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt="Host" />
                ) : '👤'}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>
                {conference?.organizer ? `${conference.organizer.firstName} ${conference.organizer.lastName || ''}`.trim() : 'Организатор'} (Host)
              </div>
            </div>
          </div>
          <div style={{ background: '#ef4444', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', background: 'white', borderRadius: '50%' }}></span>
            LIVE
          </div>
        </div>

        <h2 style={{ fontSize: '22px', fontWeight: 700, lineHeight: 1.3, marginBottom: '24px' }}>{conference?.name || conference?.title || 'Конференция'}</h2>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            👥 {members.length}
          </div>
          {conference?.code && (
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              🔗 {conference.code}
            </div>
          )}
          {conference?.startsAt && (
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              🕒 {new Date(conference.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>

      {/* Audience Section */}
      <div style={{ marginTop: '24px', padding: '0 4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontWeight: 700 }}>Аудитория</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px 12px' }}>
          {audience.map((m, idx) => (
            <div key={m.id || idx} style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => onViewProfile?.(m)}>
              <div style={{ width: '100%', aspectRatio: '1/1', position: 'relative', marginBottom: '8px' }}>
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#edf2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>{m.avatarUrl ? <img src={m.avatarUrl} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt={m.displayName} /> : '👤'}</div>
                {m.role?.toLowerCase().includes('speaker') && (
                  <div style={{ position: 'absolute', right: '0', bottom: '0', width: '30px', height: '30px', background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>🎙️</div>
                )}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary-text)' }}>{m.displayName?.split(' ')[0] || m.name}</div>
            </div>
          ))}
          {members.length > 7 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: '50%', background: '#f7fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0aec0', fontWeight: 700, fontSize: '12px' }}>+{members.length - 7} ещё</div>
            </div>
          )}
        </div>
      </div>

      {/* Featured Widgets Section */}
      <div style={{ marginTop: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontWeight: 700 }}>Последние вопросы</h3>
          <span style={{ fontSize: '12px', color: 'var(--accent-blue)', fontWeight: 700, cursor: 'pointer' }} onClick={onSeeAllQuestions}>Все</span>
        </div>
        {latestQuestion ? (
          <div className="card-soft" style={{ padding: '20px', cursor: 'pointer', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#edf2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>👤</div>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>{latestQuestion.authorName || latestQuestion.authorFirstName}</div>
            </div>
            <p style={{ margin: 0, fontSize: '15px', color: 'var(--primary-text)', fontWeight: 500 }}>{latestQuestion.text}</p>
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: '#a0aec0', fontSize: '14px', marginBottom: '24px' }}>Нет вопросов</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontWeight: 700 }}>Активные опросы</h3>
          <span style={{ fontSize: '12px', color: 'var(--accent-blue)', fontWeight: 700, cursor: 'pointer' }} onClick={onSeeAllPolls}>Все</span>
        </div>
        {activePoll ? (
          <div className="card-soft" style={{ padding: '24px', borderRadius: '28px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>{activePoll.question}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activePoll.options?.map(o => (
                <div key={o.id} style={{ position: 'relative', height: '44px', borderRadius: '12px', background: '#f8fafc', overflow: 'hidden', display: 'flex', alignItems: 'center', padding: '0 16px' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${o.percent || 0}%`, background: 'rgba(0,0,0,0.05)' }}></div>
                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '13px', fontWeight: 600 }}>
                    <span>{o.text}</span>
                    <span style={{ color: '#a0aec0' }}>{o.percent || 0}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: '#a0aec0', fontSize: '14px' }}>Нет активных опросов</div>
        )}
      </div>

      {/* Live Controls Bar */}
      {/* <div style={{ position: 'fixed', bottom: '100px', left: '0', right: '0', display: 'flex', justifyContent: 'center', gap: '12px', zIndex: 999 }}>
        {[ '💬', '🎙️', '✋', '❌'].map((icon, idx) => (
          <button 
            key={idx} 
            style={{ 
              width: '48px', height: '48px', borderRadius: '24px', border: 'none', 
              background: idx === 2 ? 'var(--tg-theme-link-color)' : (idx === 3 ? '#ef4444' : 'white'), 
              boxShadow: '0 5px 15px rgba(0,0,0,0.1)', color: (idx === 2 || idx === 3) ? 'white' : 'black',
              fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            {icon}
          </button>
        ))}
      </div> */}
    </div>
  );
};

export default ConferenceHomeView;
