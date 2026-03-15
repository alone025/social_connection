import React, { useState } from 'react';
import { RU as t } from '../constants/locales';

const ConferenceAskView = ({ onSeeAll, questions = [], onSubmitQuestion }) => {
  const [text, setText] = useState('');

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await onSubmitQuestion?.(trimmed);
    setText('');
  };

  const statusColors = {
    pending: { bg: '#fef3c7', color: '#92400e', label: 'На модерации' },
    approved: { bg: '#d1fae5', color: '#065f46', label: 'Принят' },
    rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Отклонён' },
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>{t.conference?.ask_title || 'Задать вопрос'}</h3>
        <button
          className="btn-outline"
          onClick={onSeeAll}
          style={{ fontSize: '14px', padding: '6px 14px', borderRadius: '12px', border: 'none', background: 'white', fontWeight: 700, width: 'max-content' }}
        >
          Все вопросы
        </button>
      </div>

      <div className="card-soft" style={{ marginBottom: '32px' }}>
        <textarea
          className="form-input"
          placeholder="Введите ваш вопрос..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ width: '100%', height: '120px', borderRadius: '20px', resize: 'none', background: '#f8fafc' }}
        />
        <button className="btn-solid" style={{ marginTop: '20px' }} onClick={handleSend} disabled={!text.trim()}>
          Отправить вопрос
        </button>
      </div>

      <h4 style={{ marginBottom: '16px' }}>Мои вопросы</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {questions.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#a0aec0', fontSize: '14px', padding: '20px 0' }}>
            У вас ещё нет вопросов
          </div>
        ) : (
          questions.map(q => {
            const st = statusColors[q.status] || statusColors.pending;
            return (
              <div key={q.id} className="card-soft" style={{ padding: '16px', borderRadius: '20px' }}>
                <div style={{ fontSize: '14px', marginBottom: '8px' }}>{q.text}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, background: st.bg, color: st.color, padding: '2px 8px', borderRadius: '6px' }}>
                    {st.label}
                  </span>
                  <span style={{ fontSize: '11px', color: '#a0aec0' }}>
                    {new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ConferenceAskView;
