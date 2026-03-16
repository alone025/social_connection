import React, { useState } from 'react';
import { RU as t } from '../constants/locales';

const NetworkBrowser = ({ onBack, accessPhase, onOpenPayment, onViewProfile, participants = [], onSearch }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = participants.filter(p =>
    (filter === 'all' || p.role?.toLowerCase() === filter.toLowerCase()) &&
    ((p.displayName || p.name)?.toLowerCase()?.includes(search.toLowerCase()) ||
      p.interests?.some(i => i?.toLowerCase()?.includes(search.toLowerCase())))
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
            onChange={(e) => {
              const val = e.target.value;
              setSearch(val);
              onSearch?.(val);
            }}
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
            <div
              key={p.id}
              className="card-soft animate-fade-in"
              style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '20px', borderRadius: '24px', cursor: 'pointer' }}
              onClick={() => !p.isRestricted && onViewProfile?.(p)}
            >
              <div style={{ width: '54px', height: '54px', borderRadius: '18px', background: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                {p.avatarUrl ? <img src={p.avatarUrl} style={{ width: '100%', height: '100%', borderRadius: '18px', objectFit: 'cover' }} alt={(p.displayName || p.name)} /> : '👤'}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '15px', marginBottom: '2px' }}>{p.displayName || p.name}</div>
                <div style={{ fontSize: '12px', color: '#a0aec0', fontWeight: 600 }}>{p.role}{p.company ? ` • ${p.company}` : ''}</div>
                {!p.isRestricted && p.interests?.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {p.interests.slice(0, 3).map(tag => (
                      <span key={tag} style={{ fontSize: '11px', fontWeight: 700, background: 'var(--accent-blue)', color: '#1565c0', padding: '2px 8px', borderRadius: '6px' }}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default NetworkBrowser;
