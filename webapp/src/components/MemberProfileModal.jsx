import React from 'react';
import { RU as t } from '../constants/locales';

const MemberProfileModal = ({ isOpen, member, requestStatus, onSendRequest, onOpenChat, onClose }) => {
  if (!isOpen || !member) return null;

  const currentStatus = requestStatus[member.id];

  const InfoRow = ({ label, value, isBio }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
      <label style={{ fontSize: '10px', fontWeight: 800, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>
      <div style={{ 
        color: value ? 'var(--primary-text)' : '#cbd5e0', 
        fontWeight: 600, 
        fontSize: '15px',
        lineHeight: isBio ? 1.5 : 1.2
      }}>
        {value || t.profile.not_set}
      </div>
    </div>
  );

  return (
    <div className="modal-overlay animate-fade-in" style={{ zIndex: 2100 }} onClick={onClose}>
      <div 
        className="modal-content animate-pop-in" 
        style={{ paddingBottom: '32px', maxHeight: '85vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          style={{ position: 'absolute', right: '20px', top: '20px', background: '#f8fafc', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}
        >
<svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewBox="0 0 24 24" fill="none">
<path fill-rule="evenodd" clip-rule="evenodd" d="M5.29289 5.29289C5.68342 4.90237 6.31658 4.90237 6.70711 5.29289L12 10.5858L17.2929 5.29289C17.6834 4.90237 18.3166 4.90237 18.7071 5.29289C19.0976 5.68342 19.0976 6.31658 18.7071 6.70711L13.4142 12L18.7071 17.2929C19.0976 17.6834 19.0976 18.3166 18.7071 18.7071C18.3166 19.0976 17.6834 19.0976 17.2929 18.7071L12 13.4142L6.70711 18.7071C6.31658 19.0976 5.68342 19.0976 5.29289 18.7071C4.90237 18.3166 4.90237 17.6834 5.29289 17.2929L10.5858 12L5.29289 6.70711C4.90237 6.31658 4.90237 5.68342 5.29289 5.29289Z" fill="#0F1729"/>
</svg>        </button>

        <div style={{ textAlign: 'center', marginBottom: '32px', marginTop: '10px' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '28px', background: 'var(--accent-blue)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', color: 'var(--primary)', fontWeight: 700 }}>
            {member.name[0]}
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary)', marginBottom: '4px' }}>{member.name}</h2>
          <div style={{ fontSize: '14px', color: '#a0aec0', fontWeight: 600 }}>{member.role} @ {member.company}</div>
        </div>

        <div style={{ background: '#f8fafc', borderRadius: '24px', padding: '24px', marginBottom: '32px' }}>
          <InfoRow label={t.profile.about} value={member.about || "Эксперт в области технологий и инноваций. Всегда открыт к новым знакомствам и интересным проектам."} isBio />
          <InfoRow label={t.profile.looking_for} value={member.lookingFor || "Поиск партнеров и обмен опытом."} />
          
          <div style={{ height: '1.5px', background: '#edf2f7', margin: '8px 0 20px' }} />
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <InfoRow label={t.profile.country} value={member.country || "Россия"} />
            <InfoRow label={t.profile.city} value={member.city || "Москва"} />
          </div>
          <InfoRow label={t.profile.email} value={member.email || "contacts@conference.ru"} />
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
           {currentStatus === 'accepted' ? (
             <button className="btn-solid" style={{ flex: 1, height: '56px' }} onClick={() => { onOpenChat(member); onClose(); }}>
               Перейти к чату
             </button>
           ) : (
             <button 
               className="btn-solid" 
               style={{ 
                 flex: 1, 
                 height: '56px', 
                 background: currentStatus === 'pending' ? '#edf2f7' : 'var(--primary-solid)',
                 color: currentStatus === 'pending' ? '#a0aec0' : 'white'
               }} 
               disabled={currentStatus === 'pending'}
               onClick={() => onSendRequest(member)}
             >
               {currentStatus === 'pending' ? 'Ожидание...' : 'Написать сообщение'}
             </button>
           )}
        </div>
      </div>
    </div>
  );
};

export default MemberProfileModal;
