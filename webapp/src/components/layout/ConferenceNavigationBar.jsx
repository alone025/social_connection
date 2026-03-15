import React from 'react';
import { RU as t } from '../../constants/locales';

const ConferenceNavigationBar = ({ activeTab, setActiveTab }) => {
  return (
    <nav className="nav-bar">
      <div className={`nav-item ${activeTab === 'conf_members' ? 'active' : ''}`} onClick={() => setActiveTab('conf_members')}>
        <span className="nav-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </span>
      </div>
      <div className={`nav-item ${activeTab === 'conf_ask' ? 'active' : ''}`} onClick={() => setActiveTab('conf_ask')}>
        <span className="nav-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </span>
      </div>
      <div className={`nav-item ${activeTab === 'conf_home' ? 'active' : ''}`} onClick={() => setActiveTab('conf_home')}>
        <span className="nav-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </span>
      </div>
      <div className={`nav-item ${activeTab === 'conf_chats' ? 'active' : ''}`} onClick={() => setActiveTab('conf_chats')}>
        <span className="nav-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </span>
      </div>
      <div className={`nav-item ${activeTab === 'conf_polls' ? 'active' : ''}`} onClick={() => setActiveTab('conf_polls')}>
        <span className="nav-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
        </span>
      </div>
    </nav>
  );
};

export default ConferenceNavigationBar;
