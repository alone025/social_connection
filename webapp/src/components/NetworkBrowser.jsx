import React, { useState } from 'react';
import { RU as t } from '../constants/locales';

const NetworkBrowser = ({ onBack, accessPhase, onOpenPayment, onViewProfile }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const participants = [
    { id: 1, name: 'Elena Gilbert', role: 'Investor', interests: ['Web3', 'AI'], icon: '👤' },
    { id: 2, name: 'Damon Salvatore', role: 'Speaker', interests: ['Energy', 'Tech'], icon: '🎤' },
    { id: 3, name: 'Stefan Salvatore', role: 'Founder', interests: ['Health', 'Sustainability'], icon: '🌱' },
    { id: 4, name: 'Bonnie Bennett', role: 'Developer', interests: ['Crypto', 'Security'], icon: '💻' },
    { id: 5, name: 'Caroline Forbes', role: 'Organizer', interests: ['Marketing', 'Events'], icon: '📋' },
  ];

  const filtered = participants.filter(p => 
    (filter === 'all' || p.role?.toLowerCase() === filter.toLowerCase()) &&
    (p.name?.toLowerCase()?.includes(search.toLowerCase()) || p.interests?.some(i => i?.toLowerCase()?.includes(search.toLowerCase())))
  );

  const isRestricted = accessPhase === 'payment_required';

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button className="btn btn-secondary" style={{ width: '40px', height: '40px', padding: 0, borderRadius: '12px', background: 'white', border: 'none', boxShadow: 'var(--card-shadow-sm)' }} onClick={onBack}>←</button>
        <div style={{ position: 'relative', flex: 1 }}>
          <input 
            className="search-input" 
            placeholder={t.networking.search_placeholder} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: '16px', border: 'none', background: 'white', boxShadow: 'var(--card-shadow-sm)', color: 'var(--primary)', fontWeight: 500 }}
          />
          <span style={{ position: 'absolute', left: '16px', top: '12px', width: '20px', height: '20px', color: 'var(--primary)', opacity: 0.5 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </span>
        </div>
      </div>

      {isRestricted && (
        <div className="card-soft" style={{ textAlign: 'center', background: '#fef2f2', border: '1.5px solid #fee2e2', marginBottom: '24px', padding: '24px' }}>
          <h4 style={{ color: '#991b1b', marginBottom: '8px', fontWeight: 700 }}>{t.access.restricted_title}</h4>
          <p style={{ fontSize: '13px', color: '#991b1b', opacity: 0.8, marginBottom: '16px', fontWeight: 500 }}>{t.access.restricted_desc}</p>
          <button className="btn-solid" style={{ background: '#991b1b' }} onClick={onOpenPayment}>
            {t.access.pay_btn}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '16px', marginBottom: '8px' }} className="no-scrollbar">
        {['all', 'investor', 'speaker', 'founder', 'developer'].map(f => (
          <button 
            key={f} 
            className={`tab-pill ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
            style={{ 
              padding: '8px 16px', 
              borderRadius: '20px', 
              border: 'none', 
              background: filter === f ? 'var(--primary)' : 'white', 
              color: filter === f ? 'white' : 'var(--primary)', 
              fontWeight: 600, 
              fontSize: '13px',
              boxShadow: 'var(--card-shadow-sm)',
              whiteSpace: 'nowrap',
              cursor: 'pointer'
            }}
          >
            {f === 'all' ? t.common.all : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="participant-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filtered.map(p => (
          <div key={p.id} className="card-soft" style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '16px', opacity: isRestricted ? 0.6 : 1 }}>
            <div 
              style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: 1, cursor: isRestricted ? 'default' : 'pointer' }}
              onClick={() => !isRestricted && onViewProfile?.(p)}
            >
              <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 700, flexShrink: 0 }}>
                {p.name[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '15px' }}>{isRestricted ? `${p.name?.split(' ')?.[0] || 'Member'} ...` : p.name}</div>
                <div style={{ fontSize: '12px', color: '#a0aec0', fontWeight: 600, marginTop: '2px' }}>{p.role}</div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  {p.interests.map(i => <span key={i} style={{ fontSize: '10px', background: '#f7fafc', color: '#718096', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>{i}</span>)}
                </div>
              </div>
            </div>
            {!isRestricted && (
              <button className="btn-solid" style={{ width: 'auto', padding: '10px 20px', fontSize: '13px' }}>
                {t.networking.meet_btn}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default NetworkBrowser;
