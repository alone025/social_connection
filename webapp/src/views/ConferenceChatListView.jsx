import React from 'react';
import { RU as t } from '../constants/locales';

const ConferenceChatListView = ({ onSelectChat, onViewProfile }) => {
  const chats = [
    { id: 1, name: 'Michal P.', lastMsg: 'See you at the summit!', time: '12:45', color: '#3182ce', role: 'Developer', company: 'Google' },
    { id: 2, name: 'Anna K.', lastMsg: 'Request accepted!', time: '11:20', color: '#38a169', role: 'Founder', company: 'StartupX' },
  ];

  return (
    <div className="animate-fade-in">
      <h3 style={{ marginBottom: '20px', color: 'var(--primary)' }}>Чаты конференции</h3>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {chats.length > 0 ? chats.map(chat => (
          <div key={chat.id} 
            className="chat-card" 
            style={{ display: 'flex', gap: '16px', padding: '16px 0', borderBottom: '1px solid #edf2f7' }}
          >
            <div 
              onClick={() => onViewProfile?.(chat)}
              style={{ width: '48px', height: '48px', borderRadius: '16px', background: chat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, cursor: 'pointer' }}
            >
              {chat.name[0]}
            </div>
            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => onSelectChat(chat)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontWeight: 700, color: 'var(--primary-text)', fontSize: '15px' }}>{chat.name}</span>
                <span style={{ fontSize: '11px', color: '#a0aec0', fontWeight: 600 }}>{chat.time}</span>
              </div>
              <div style={{ fontSize: '13px', color: '#718096', fontWeight: 500 }}>{chat.lastMsg}</div>
            </div>
          </div>
        )) : (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#a0aec0' }}>
            Активных чатов пока нет
          </div>
        )}
      </div>
    </div>
  );
};

export default ConferenceChatListView;
