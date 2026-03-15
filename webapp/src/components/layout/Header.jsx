import React from 'react';
import { RU as t } from '../../constants/locales';

const Header = ({ user, activeTab, setActiveTab, onOpenNotifications }) => {
  // Get dynamic title based on tab
  const getTitle = () => {
    switch(activeTab) {
      case 'conferences': return t.home?.public_conferences || 'Конференции';
      case 'networking': return 'Нетворкинг';
      case 'messaging': return t.home?.messaging || 'Сообщения';
      case 'profile': return t.profile?.title || 'Профиль';
      case 'home': return 'Добро пожаловать';
      default: return 'Конференции';
    }
  };

  return (
    <div className="container" style={{ paddingBottom: '10px', paddingTop: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <button 
          className="btn-outline" 
          onClick={() => setActiveTab('profile')}
          style={{ width: '44px', height: '44px', padding: 0, borderRadius: '14px', border: 'none', background: 'white', boxShadow: 'var(--card-shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </button>
        <button 
          className="btn-outline" 
          onClick={onOpenNotifications}
          style={{ width: '44px', height: '44px', padding: 0, borderRadius: '14px', border: 'none', background: 'white', boxShadow: 'var(--card-shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
        </button>
      </div>
      
      <div className="animate-fade-in" style={{ paddingLeft: '4px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '30px', fontWeight: 800, color: 'var(--primary-text)' }}>{getTitle()}</h1>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#a0aec0' }}>{activeTab === 'conferences' ? 'Все ваши предстоящие и прошедшие конференции' : t.home.subtitle}</p>
      </div>
    </div>
  );
};

export default Header;
