import React from 'react';
import { RU as t } from '../constants/locales';

const ConferenceChatListView = ({ onSelectChat, onViewProfile, chats = [] }) => {
  return (
    <div className="animate-fade-in">
      <h3 style={{ marginBottom: '20px', color: 'var(--primary)' }}>Чаты конференции</h3>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {chats.length > 0 ? chats.map(chat => {
          const otherUser = chat.other;
          if (!otherUser) return null;

          return (
            <div key={chat.id} 
              className="chat-card" 
              style={{ display: 'flex', gap: '16px', padding: '16px 0', borderBottom: '1px solid #edf2f7' }}
            >
              <div 
                onClick={() => onViewProfile?.(otherUser)}
                style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, cursor: 'pointer', overflow: 'hidden' }}
              >
                {otherUser.avatarUrl ? (
                  <img src={otherUser.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={otherUser.name} />
                ) : (
                  otherUser.name?.[0] || '?'
                )}
              </div>
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => onSelectChat(chat)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--primary-text)', fontSize: '15px' }}>{otherUser.name}</span>
                  <span style={{ fontSize: '11px', color: '#a0aec0', fontWeight: 600 }}>
                    {chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#718096', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {chat.lastText || 'Нет сообщений'}
                </div>
              </div>
            </div>
          );
        }) : (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#a0aec0' }}>
            Активных чатов пока нет
          </div>
        )}
      </div>
    </div>
  );
};

export default ConferenceChatListView;
