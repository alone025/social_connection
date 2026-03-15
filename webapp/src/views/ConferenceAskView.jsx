import React from 'react';
import { RU as t } from '../constants/locales';

const ConferenceAskView = ({ onSeeAll }) => {
  const history = [
    { id: 101, text: 'Как ИИ изменит дизайн?', status: 'Moderating', time: '14:05' }
  ];

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>{t.conference?.ask_title || 'Задать вопрос'}</h3>
        <button 
          className="btn-outline" 
          onClick={onSeeAll}
          style={{ fontSize: '14px', padding: '6px 14px', borderRadius: '12px', border: 'none', background: 'white', fontWeight: 700 , width: 'max-content',}}
        >
          Все вопросы
        </button>
      </div>
      
      <div className="card-soft" style={{ marginBottom: '32px' }}>
        <textarea 
          className="form-input" 
          placeholder="Введите ваш вопрос..." 
          style={{ width: '100%', height: '120px', borderRadius: '20px', resize: 'none', background: '#f8fafc' }}
        />
        <button className="btn-solid" style={{ marginTop: '20px' }}>Отправить вопрос</button>
      </div>

      <h4 style={{ marginBottom: '16px' }}>Мои вопросы</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {history.map(h => (
          <div key={h.id} className="card-soft" style={{ padding: '16px', borderRadius: '20px' }}>
            <div style={{ fontSize: '14px', marginBottom: '8px' }}>{h.text}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '6px' }}>{h.status}</span>
              <span style={{ fontSize: '11px', color: '#a0aec0' }}>{h.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConferenceAskView;
