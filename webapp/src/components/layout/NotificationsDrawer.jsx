import React from 'react';
import { RU as t } from '../../constants/locales';

const NotificationsDrawer = ({ onClose, onOpenRequest, Icon }) => (
  <>
    <div className="drawer-overlay" onClick={onClose} />
    <div className="drawer" style={{ background: '#f8fafc', padding: '32px 24px' }}>
      <div className="drawer-header" style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--primary-text)', margin: 0 }}>{t.common.notifications || 'Уведомления'}</h2>
        <button className="close-btn" onClick={onClose} style={{ background: 'white', boxShadow: 'var(--card-shadow-sm)' }}>
          <Icon />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>Сегодня</div>
          <div className="card-soft" style={{ background: 'white', padding: '20px', borderRadius: '24px', border: 'none', marginBottom: '8px' }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>💬</div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-text)', lineHeight: 1.4, marginBottom: '4px' }}>Tech Summit SF</div>
                <div style={{ fontSize: '13px', color: '#718096', fontWeight: 500 }}>Начнется через 30 минут. Приготовьтесь!</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ cursor: 'pointer' }} onClick={() => onOpenRequest({ sender: 'Алекс Рид', conference: 'Tech Summit SF' })}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>Вчера</div>
          <div className="card-soft" style={{ background: 'white', padding: '20px', borderRadius: '24px', border: 'none' }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>🤝</div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-text)', lineHeight: 1.4, marginBottom: '4px' }}>Запрос на встречу</div>
                <div style={{ fontSize: '13px', color: '#718096', fontWeight: 500 }}>Алекс Рид хочет обсудить ваш проект.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div style={{ marginTop: 'auto', paddingTop: '24px' }}>
        <button className="btn-outline" style={{ border: 'none', background: 'transparent', color: '#a0aec0', fontSize: '14px', fontWeight: 600 }}>
          Очистить все уведомления
        </button>
      </div>
    </div>
  </>
);

export default NotificationsDrawer;
