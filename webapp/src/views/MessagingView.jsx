import React, { useState, useEffect, useRef } from 'react';
import { RU as t } from '../constants/locales';

const MessagingView = ({ onBack, currentConference, onChatStateChange, onViewProfile, initialSelectedChat }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(initialSelectedChat?.confId || currentConference?.id || 'all');
  const [selectedChat, setSelectedChat] = useState(initialSelectedChat || null);
  const [messages, setMessages] = useState({});
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (initialSelectedChat) {
      setSelectedChat(initialSelectedChat);
      onChatStateChange?.(true);
    }
  }, [initialSelectedChat]);

  const chats = [
    { id: 'system', name: 'System Chat', lastMsg: 'Запрос принят!', time: '16:55', conference: 'Системные', type: 'system', icon: '⚙️', color: '#718096' },
    { id: 1, name: 'Алекс Рид', lastMsg: 'Увидимся на саммите!', time: '12:45', conference: 'Tech Summit SF', confId: 1, type: 'user', color: '#6b46c1', role: 'Developer', company: 'Google' },
    { id: 2, name: 'Сара Чен', lastMsg: 'Слайды готовы.', time: '11:20', conference: 'Global Tech Expo', confId: 2, type: 'user', color: '#38a169', role: 'Speaker', company: 'Global Tech' },
    { id: 3, name: 'Михаил П.', lastMsg: 'Как насчет кофе?', time: 'Вчера', conference: 'Tech Summit SF', confId: 1, type: 'user', color: '#3182ce', role: 'Designer', company: 'Studio' },
  ];

  const initialMessages = {
    'system': [
      { id: 1, text: 'Добро пожаловать в Social Connections!', sender: 'system', time: '10:00' },
      { id: 2, text: 'Вы присоединились к Tech Summit SF.', sender: 'system', time: '10:05' },
      { id: 3, text: 'Алекс Рид хочет начать чат с вами.', sender: 'system', time: '16:50', isAction: true, actionText: 'Принять запрос' }
    ],
    1: [
      { id: 1, text: 'Привет! Как дела?', sender: 'them', time: '12:40' },
      { id: 2, text: 'Увидимся на саммите!', sender: 'them', time: '12:45' }
    ]
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedChat, messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    const chatId = selectedChat.id;
    const newMsg = {
      id: Date.now(),
      text: inputText,
      sender: 'me',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), newMsg]
    }));
    setInputText('');
  };

  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
    onChatStateChange?.(true);
  };

  const handleBackToList = () => {
    setSelectedChat(null);
    onChatStateChange?.(false);
  };

  const filteredChats = chats.filter(chat => {
    const matchesSearch = chat.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || chat.confId === filter || chat.id === 'system';
    return matchesSearch && matchesFilter;
  });

  const conferences = [
    { id: 1, name: 'Tech Summit SF' },
    { id: 2, name: 'Global Tech Expo' },
  ];

  if (selectedChat) {
    const chatMessages = messages[selectedChat.id] || initialMessages[selectedChat.id] || [];
    const isSystem = selectedChat.type === 'system';

    return (
      <div className="animate-fade-in" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '0 0 24px 0', borderBottom: '1.5px solid #edf2f7' }}>
          <button className="btn-outline" style={{ width: '44px', height: '44px', padding: 0, borderRadius: '14px', border: 'none', background: 'white', boxShadow: 'var(--card-shadow-sm)' }} onClick={handleBackToList}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: selectedChat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '18px' }}>
            {selectedChat.icon || selectedChat.name[0]}
          </div>
          <div>
            <div style={{ fontWeight: 800, color: 'var(--primary-text)', fontSize: '17px' }}>{selectedChat.name}</div>
            <div style={{ fontSize: '12px', color: '#a0aec0', fontWeight: 600 }}>{isSystem ? 'Автоматический чат' : 'В сети'}</div>
          </div>
        </div>

        {/* Message Area */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '24px 0', display: 'flex', flexDirection: 'column', gap: '12px' }} className="no-scrollbar">
          {chatMessages.map(msg => (
            <div key={msg.id} style={{ 
              alignSelf: msg.sender === 'me' ? 'flex-end' : (msg.sender === 'system' ? 'start' : 'flex-start'),
              maxWidth: msg.sender === 'system' ? '100%' : '80%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.sender === 'me' ? 'flex-end' : 'flex-start'
            }}>
              <div style={{ 
                padding: msg.isAction ? '20px' : '14px 18px', 
                borderRadius: msg.sender === 'me' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                background: msg.sender === 'me' ? 'var(--primary-solid)' : (msg.sender === 'system' ? '#f8fafc' : 'white'),
                color: msg.sender === 'me' ? 'white' : 'var(--primary-text)',
                fontSize: '15px',
                fontWeight: 500,
                boxShadow: msg.sender === 'system' ? 'none' : '0 4px 15px rgba(0,0,0,0.03)',
                boxSizing: 'border-box',
                textAlign: msg.sender === 'system' ? 'center' : 'left',
                border: msg.sender === 'system' ? '1px dashed #e2e8f0' : 'none'
              }}>
                {msg.text}
                {msg.isAction && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button className="btn-solid" style={{ background: 'var(--primary-solid)', padding: '10px 20px', fontSize: '13px', flex: 1 }}>
                      Принять
                    </button>
                    <button className="btn-outline" style={{ background: 'white', padding: '10px 20px', fontSize: '13px', flex: 1 }}>
                      Отклонить
                    </button>
                  </div>
                )}
              </div>
              <div style={{ fontSize: '10px', color: '#a0aec0', marginTop: '4px', fontWeight: 600, padding: '0 4px' }}>
                {msg.time}
              </div>
            </div>
          ))}
        </div>

        {/* Input Area */}
        {!isSystem && (
          <div style={{ paddingTop: '20px', borderTop: '1.5px solid #edf2f7', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input 
                className="form-input" 
                placeholder="Сообщение..." 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                style={{ borderRadius: '24px', paddingRight: '50px' }}
              />
              <button style={{ position: 'absolute', right: '8px', top: '8px', width: '38px', height: '38px', borderRadius: '50%', background: inputText.trim() ? 'var(--primary-solid)' : '#f8fafc', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: inputText.trim() ? 'white' : '#a0aec0', transition: 'all 0.2s' }} onClick={handleSend}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      {/* Search Bar */}
      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <input 
          className="form-input" 
          placeholder="Поиск по имени..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '16px 16px 16px 48px', marginBottom: 0, borderRadius: '20px', border: 'none', background: 'white', boxShadow: 'var(--card-shadow-sm)' }}
        />
        <span style={{ position: 'absolute', left: '16px', top: '16px', opacity: 0.5, color: 'var(--primary)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </span>
      </div>

      {/* Conference Filters */}
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '20px', marginBottom: '8px' }} className="no-scrollbar">
        <button 
          key="all"
          className={`filter-chip ${filter === 'all' ? 'active' : ''}`} 
          onClick={() => setFilter('all')}
        >
          Все
        </button>
        {conferences.map(conf => (
          <button 
            key={conf.id} 
            className={`filter-chip ${filter === conf.id ? 'active' : ''}`}
            onClick={() => setFilter(conf.id)}
            style={{ whiteSpace: 'nowrap' }}
          >
            {conf.name}
          </button>
        ))}
      </div>

      {/* Chat List */}
      <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }} className="no-scrollbar">
        {filteredChats.length > 0 ? filteredChats.map(chat => (
          <div key={chat.id} 
            className="chat-card" 
            style={{ display: 'flex', gap: '16px', padding: '16px 0', borderBottom: '1px solid #edf2f7' }}
          >
            <div 
              onClick={() => chat.id !== 'system' && onViewProfile?.(chat)}
              style={{ width: '56px', height: '56px', borderRadius: '18px', background: chat.color || 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '20px', cursor: chat.id === 'system' ? 'default' : 'pointer' }}
            >
              {chat.icon || chat.name[0]}
            </div>
            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => handleSelectChat(chat)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontWeight: 800, color: 'var(--primary-text)', fontSize: '16px' }}>{chat.name}</span>
                <span style={{ fontSize: '11px', color: '#a0aec0', fontWeight: 600 }}>{chat.time}</span>
              </div>
              <div style={{ fontSize: '13px', color: '#718096', marginBottom: '6px', fontWeight: 500 }}>{chat.lastMsg}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', background: chat.id === 'system' ? '#f7fafc' : 'var(--accent-blue)', color: chat.id === 'system' ? '#a0aec0' : '#1565c0', padding: '3px 10px', borderRadius: '8px', fontWeight: 700 }}>
                  {chat.conference}
                </span>
                {chat.type === 'system' && (
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }}></div>
                )}
              </div>
            </div>
          </div>
        )) : (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#a0aec0' }}>
            Чаты не найдены
          </div>
        )}
      </div>

      <style>{`
        .filter-chip {
          padding: 10px 20px;
          border-radius: 16px;
          background: white;
          border: none;
          color: #718096;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: var(--card-shadow-sm);
          transition: all 0.2s;
        }
        .filter-chip.active {
          background: var(--primary-solid);
          color: white;
        }
        .chat-card:active {
          opacity: 0.7;
          transform: scale(0.98);
        }
      `}</style>
    </div>
  );
};

export default MessagingView;
