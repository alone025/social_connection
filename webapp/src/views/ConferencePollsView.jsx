import React from 'react';
import { RU as t } from '../constants/locales';

const ConferencePollsView = () => {
  const polls = [
    { id: 1, question: "How would you rate Sarah Chen's session?", options: ["Excellent", "Good", "Average", "Poor"], votes: 156 },
    { id: 2, question: "Should we have more AI topics tomorrow?", options: ["Definitely", "Maybe", "Not really"], votes: 89 }
  ];

  return (
    <div className="animate-fade-in">
      <h3>Conference Polls</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
        {polls.map(p => (
          <div key={p.id} className="card-soft" style={{ borderRadius: '24px' }}>
            <h4 style={{ margin: '0 0 20px 0', fontSize: '17px', color: 'var(--primary-text)' }}>{p.question}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {p.options.map(o => (
                <button key={o} className="btn-outline" style={{ justifyContent: 'space-between', padding: '14px 20px', borderRadius: '16px' }}>
                  <span style={{ fontWeight: 600 }}>{o}</span>
                  <span style={{ color: '#a0aec0', fontSize: '13px' }}>{Math.floor(Math.random() * 50)}%</span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: '11px', marginTop: '16px', color: '#a0aec0', fontWeight: 600, textAlign: 'right' }}>{p.votes} votes</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConferencePollsView;
