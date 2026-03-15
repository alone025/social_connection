import React from 'react';
import { RU as t } from '../constants/locales';

const ConferenceQuestionsListView = ({ onBack }) => {
  const questions = [
    { id: 1, user: 'Alex Reed', text: 'How do you see AI affecting pure digital art in 2026?', time: '14:20', votes: 12 },
    { id: 2, user: 'Sarah Chen', text: 'Will sustainability be a key factor in future design?', time: '14:25', votes: 8 },
    { id: 3, user: 'Michal P.', text: 'What are the main challenges for entertainment industry?', time: '14:30', votes: 5 },
  ];

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button className="btn-outline" style={{ width: '44px', height: '44px', padding: 0, borderRadius: '14px', border: 'none', background: 'white', boxShadow: 'var(--card-shadow-sm)' }} onClick={onBack}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <h3 style={{ margin: 0 }}>Все вопросы конференции</h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {questions.map(q => (
          <div key={q.id} className="card-soft" style={{ padding: '20px', borderRadius: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#edf2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>👤</div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>{q.user}</div>
              </div>
              <div style={{ fontSize: '12px', color: '#a0aec0', fontWeight: 600 }}>{q.time}</div>
            </div>
            <p style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--primary-text)', lineHeight: 1.5 }}>{q.text}</p>
            {/* <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-blue)' }}>{q.votes} голосa</span>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 10l5 5 5-5"/></svg>
              </button>
            </div> */}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConferenceQuestionsListView;
