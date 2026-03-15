const ConferenceMembersView = ({ requestStatus, onOpenChat, onViewProfile, onSendRequest }) => {
  const members = [
    { id: 1, name: 'Michal P.', role: 'Developer', company: 'Google', about: 'Senior Frontend Engineer @ Google. Passionate about React and performant web apps.' },
    { id: 2, name: 'Anna K.', role: 'Founder', company: 'StartupX', about: 'Building the next generation of SaaS tools. Looking for AI experts.' },
    { id: 3, name: 'David L.', role: 'Investor', company: 'VC Firm', about: 'Early-stage tech investor. Interested in Web3 and Fintech.' },
  ];

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '40px' }}>
      <h3 style={{ marginBottom: '20px', color: 'var(--primary)', fontSize: '20px' }}>Участники</h3>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {members.map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 0', borderBottom: '1.5px solid #edf2f7' }}>
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, cursor: 'pointer' }}
              onClick={() => onViewProfile?.(m)}
            >
              <div style={{ width: '48px', height: '48px', borderRadius: '18px', background: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1565c0', fontWeight: 700, fontSize: '18px' }}>
                {m.name[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '15px' }}>{m.name}</div>
                <div style={{ fontSize: '12px', color: '#a0aec0', fontWeight: 500 }}>{m.role} @ {m.company}</div>
              </div>
            </div>
            
            <button 
              className="icon-btn-simple" 
              style={{ 
                color: requestStatus[m.id] === 'accepted' ? 'var(--accent-blue)' : (requestStatus[m.id] === 'pending' ? '#a0aec0' : 'var(--link-color)'), 
                background: 'none', border: 'none', padding: '12px',
                cursor: 'pointer',
                transition: '0.2s'
              }} 
              onClick={() => {
                if (!requestStatus[m.id]) {
                  onSendRequest?.(m);
                } else if (requestStatus[m.id] === 'accepted') {
                  onOpenChat?.(m);
                }
              }}
            >
              {!requestStatus[m.id] && (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              )}
              {requestStatus[m.id] === 'pending' && (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              )}
              {requestStatus[m.id] === 'accepted' && (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7 8.38 8.38 0 0 1 3.8.9L21 3z"/></svg>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConferenceMembersView;
