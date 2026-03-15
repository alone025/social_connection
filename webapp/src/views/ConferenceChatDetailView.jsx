import React, { useState, useEffect, useRef } from 'react';
import { RU as t } from '../constants/locales';

const ConferenceChatDetailView = ({ chat, onBack }) => {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState([
    { id: 1, text: 'Привет! Рад знакомству.', sender: 'them', time: '12:40' },
    { id: 2, text: 'Увидимся на сессии!', sender: 'them', time: '12:45' }
  ]);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    const newMsg = {
      id: Date.now(),
      text: inputText,
      sender: 'me',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages([...messages, newMsg]);
    setInputText('');
  };

  return (
    <div className="animate-fade-in" style={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '16px', borderBottom: '1.5px solid #edf2f7' }}>
        <button className="btn-outline" style={{ width: '36px', height: '36px', padding: 0, borderRadius: '12px', border: 'none', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }} onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: chat?.color || '#3182ce', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '14px' }}>
          {chat?.name?.[0] || 'U'}
        </div>
        <div>
          <div style={{ fontWeight: 800, color: 'var(--primary-text)', fontSize: '15px' }}>{chat?.name}</div>
          <div style={{ fontSize: '10px', color: '#a0aec0', fontWeight: 700 }}>В сети</div>
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }} className="no-scrollbar">
        {messages.map(msg => (
          <div key={msg.id} style={{ 
            alignSelf: msg.sender === 'me' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: msg.sender === 'me' ? 'flex-end' : 'flex-start',
            marginBottom: '12px'
          }}>
            <div style={{ 
              padding: '12px 16px', 
              borderRadius: msg.sender === 'me' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: msg.sender === 'me' ? 'var(--primary-solid)' : 'white',
              color: msg.sender === 'me' ? 'white' : 'var(--primary-text)',
              fontSize: '14px',
              fontWeight: 500,
              boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
            }}>
              {msg.text}
            </div>
            <div style={{ fontSize: '9px', color: '#a0aec0', marginTop: '4px', fontWeight: 600 }}>{msg.time}</div>
          </div>
        ))}
      </div>

      <div style={{ paddingTop: '16px', borderTop: '1.5px solid #edf2f7', display: 'flex', gap: '8px' }}>
        <input 
          className="form-input" 
          placeholder="Напишите..." 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          style={{ height: '44px', borderRadius: '22px', fontSize: '14px' }}
        />
        <button 
          style={{ width: '44px', height: '44px', borderRadius: '22px', background: inputText.trim() ? 'var(--primary-solid)' : '#f8fafc', border: 'none', color: inputText.trim() ? 'white' : '#a0aec0', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
          onClick={handleSend}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  );
};

export default ConferenceChatDetailView;
