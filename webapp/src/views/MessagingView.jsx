import React, { useState, useEffect, useRef } from 'react';

const MessagingView = ({ onBack, currentConference, onChatStateChange, onViewProfile, initialSelectedChat, chats = [], messages = [], onSelectChat, onSendMessage }) => {
  const [search, setSearch] = useState('');
  const [selectedChat, setSelectedChat] = useState(initialSelectedChat || null);
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (initialSelectedChat) {
      setSelectedChat(initialSelectedChat);
      onChatStateChange?.(true);
    }
  }, [initialSelectedChat]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedChat, messages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    await onSendMessage?.(inputText.trim());
    setInputText('');
  };

  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
    onSelectChat?.(chat);
    onChatStateChange?.(true);
  };

  const handleBackToList = () => {
    setSelectedChat(null);
    onChatStateChange?.(false);
  };

  const filteredChats = chats.filter(c =>
    (c.other?.name || c.name || '').toLowerCase().includes(search.toLowerCase())
  );

  // ── Selected Chat View ───────────────────────────────────────────────────
  if (selectedChat) {
    const chatMessages = Array.isArray(messages) ? messages : [];
    const chatName = selectedChat.other?.name || selectedChat.name || 'Чат';
    const chatAvatar = selectedChat.other?.avatarUrl;

    return (
      <div className="animate-fade-in" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '0 0 24px 0', borderBottom: '1.5px solid #edf2f7' }}>
          <button className="btn-outline" style={{ width: '44px', height: '44px', padding: 0, borderRadius: '14px', border: 'none', background: 'white', boxShadow: 'var(--card-shadow-sm)' }} onClick={handleBackToList}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <div
            style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1565c0', fontWeight: 700, fontSize: '18px', cursor: 'pointer' }}
            onClick={() => selectedChat.other && onViewProfile?.(selectedChat.other)}
          >
            {chatAvatar ? <img src={chatAvatar} style={{ width: '100%', height: '100%', borderRadius: '14px', objectFit: 'cover' }} alt={chatName} /> : '👤'}
          </div>
          <div>
            <div style={{ fontWeight: 800, color: 'var(--primary-text)', fontSize: '17px' }}>{chatName}</div>
            <div style={{ fontSize: '12px', color: '#a0aec0', fontWeight: 600 }}>
              {selectedChat.conferenceName || selectedChat.conference || 'Чат'}
            </div>
          </div>
        </div>

        {/* Message Area */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '24px 0', display: 'flex', flexDirection: 'column', gap: '12px' }} className="no-scrollbar">
          {chatMessages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#a0aec0', padding: '40px 20px', fontSize: '14px' }}>
              Нет сообщений. Напишите первым! 👋
            </div>
          ) : chatMessages.map(msg => (
            <div key={msg.id} style={{
              alignSelf: msg.fromSelf ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.fromSelf ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                padding: '14px 18px',
                borderRadius: msg.fromSelf ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                background: msg.fromSelf ? 'var(--primary-solid)' : 'white',
                color: msg.fromSelf ? 'white' : 'var(--primary-text)',
                fontSize: '15px',
                fontWeight: 500,
                boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
              }}>
                {msg.text}
              </div>
              <div style={{ fontSize: '10px', color: '#a0aec0', marginTop: '4px', fontWeight: 600, padding: '0 4px' }}>
                {typeof msg.time === 'string' ? msg.time : new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>

        {/* Input Area */}
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
            <button
              style={{ position: 'absolute', right: '8px', top: '8px', width: '38px', height: '38px', borderRadius: '50%', background: inputText.trim() ? 'var(--primary-solid)' : '#f8fafc', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: inputText.trim() ? 'white' : '#a0aec0', transition: 'all 0.2s' }}
              onClick={handleSend}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Chat List View ────────────────────────────────────────────────────────
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

      {/* Chat List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }} className="no-scrollbar">
        {filteredChats.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#a0aec0', fontSize: '14px' }}>
            Чатов пока нет. Отправьте запрос участнику конференции, чтобы начать общение.
          </div>
        ) : filteredChats.map(c => (
          <div
            key={c.chatRequestId || c.id}
            className="card-soft animate-fade-in"
            style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '16px 20px', borderRadius: '20px', cursor: 'pointer' }}
            onClick={() => handleSelectChat(c)}
          >
            <div
              style={{ width: '48px', height: '48px', borderRadius: '18px', background: '#edf2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0, cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); c.other && onViewProfile?.(c.other); }}
            >
              {c.other?.avatarUrl ? <img src={c.other.avatarUrl} style={{ width: '100%', height: '100%', borderRadius: '18px', objectFit: 'cover' }} alt={c.other.name} /> : '👤'}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '15px' }}>{c.other?.name || c.name}</div>
                <div style={{ fontSize: '11px', color: '#a0aec0', fontWeight: 600 }}>
                  {c.lastMessage?.time ? new Date(c.lastMessage.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : c.time || ''}
                </div>
              </div>
              <div style={{ fontSize: '13px', color: '#a0aec0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.lastMessage?.text || c.lastMsg || 'Нет сообщений'}
              </div>
              {c.conferenceName && (
                <div style={{ fontSize: '11px', color: 'var(--accent-blue)', fontWeight: 600, marginTop: '4px' }}>{c.conferenceName}</div>
              )}
            </div>
            {c.unreadCount > 0 && (
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#ef4444', color: 'white', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{c.unreadCount}</div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .filter-chip { padding: 10px 20px; border-radius: 16px; background: white; border: none; color: #718096; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: var(--card-shadow-sm); transition: all 0.2s; }
        .filter-chip.active { background: var(--primary-solid); color: white; }
      `}</style>
    </div>
  );
};

export default MessagingView;
