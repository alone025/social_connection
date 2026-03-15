import React from 'react';

const ConferenceQuestionsListView = ({ onBack, questions = [], onUpvote }) => {
  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button className="btn-outline" style={{ width: '44px', height: '44px', padding: 0, borderRadius: '14px', border: 'none', background: 'white', boxShadow: 'var(--card-shadow-sm)' }} onClick={onBack}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <h3 style={{ margin: 0 }}>Все вопросы конференции</h3>
      </div>

      {questions.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#a0aec0', fontSize: '14px', padding: '40px 0' }}>
          Вопросов ещё нет
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {questions.map(q => (
            <div key={q.id} className="card-soft" style={{ padding: '20px', borderRadius: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#edf2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>👤</div>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>{q.authorName || q.authorFirstName || 'Аноним'}</div>
                </div>
                <div style={{ fontSize: '12px', color: '#a0aec0', fontWeight: 600 }}>
                  {new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <p style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--primary-text)', lineHeight: 1.5 }}>{q.text}</p>
              {onUpvote && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => onUpvote(q.id)}
                    style={{
                      background: q.hasUpvoted ? 'var(--accent-blue)' : 'none',
                      border: '1.5px solid var(--accent-blue)',
                      borderRadius: '10px',
                      padding: '4px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: q.hasUpvoted ? 'white' : 'var(--accent-blue)',
                    }}
                  >
                    ▲ {q.upvotes || 0}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConferenceQuestionsListView;
