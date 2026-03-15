import React from 'react';
import { RU as t } from '../constants/locales';

const ConferencePollsView = ({ polls = [], onVote }) => {
  if (!polls.length) return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#a0aec0', fontSize: '14px' }}>Нет активных опросов</div>
  );

  return (
    <div className="animate-fade-in">
      <h3>Conference Polls</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
        {polls.map(p => (
          <div key={p.id} className="card-soft" style={{ borderRadius: '24px' }}>
            <h4 style={{ margin: '0 0 20px 0', fontSize: '17px', color: 'var(--primary-text)' }}>{p.question}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {p.options?.map(o => (
                <button
                  key={o.id}
                  className="btn-outline"
                  style={{ justifyContent: 'space-between', padding: '14px 20px', borderRadius: '16px', position: 'relative', overflow: 'hidden' }}
                  onClick={() => onVote?.(p.id, o.id)}
                >
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${o.percent || 0}%`, background: 'rgba(0,0,0,0.05)', zIndex: 0 }} />
                  <span style={{ fontWeight: 600, position: 'relative', zIndex: 1 }}>{o.text}</span>
                  <span style={{ color: '#a0aec0', fontSize: '13px', position: 'relative', zIndex: 1 }}>{o.percent || 0}%</span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: '11px', marginTop: '16px', color: '#a0aec0', fontWeight: 600, textAlign: 'right' }}>{p.totalVotes || 0} голосов</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConferencePollsView;
