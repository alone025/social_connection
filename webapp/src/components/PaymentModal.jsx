import React from 'react';

const PaymentModal = ({ isOpen, onClose, onPay, price = 249 }) => {
  if (!isOpen) return null;

  return (
    <div className="payment-overlay animate-fade-in">
      <div className="payment-card card-soft" style={{ background: '#ffffff', borderRadius: '32px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: 'none' }}>
        <div className="payment-header">
          <div className="payment-icon">💎</div>
          <button className="close-btn" onClick={onClose} style={{ fontSize: '28px', color: '#a0aec0' }}>×</button>
        </div>
        
        <h2 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--primary-text)', marginBottom: '12px' }}>Полный доступ</h2>
        <p style={{ color: '#a0aec0', fontSize: '15px', fontWeight: 500 }}>Конференция завершена, но нетворкинг продолжается! Откройте все возможности Social Connections:</p>
        
        <ul className="benefits-list" style={{ margin: '32px 0' }}>
          <li style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-text)' }}>🔓 <span>Открытие всех контактов</span></li>
          <li style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-text)' }}>✉️ <span>Продолжение переписки в чате</span></li>
          <li style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-text)' }}>📊 <span>Экспорт контактов в CSV/Excel</span></li>
          <li style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-text)' }}>🔍 <span>Полный список всех участников</span></li>
        </ul>

        <div className="price-tag" style={{ background: '#f8fafc', color: 'var(--primary-text)', borderRadius: '20px', padding: '24px', marginBottom: '24px' }}>
          <span className="amount" style={{ fontSize: '32px', fontWeight: 800 }}>{price} ₽</span>
          <span className="label" style={{ fontSize: '12px', fontWeight: 700, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: '4px', display: 'block' }}>единоразово за конференцию</span>
        </div>

        <button className="btn-solid" style={{ padding: '18px' }} onClick={onPay}>
          Оплатить и продолжить
        </button>
        
        <p className="footer-note">Безопасная оплата через Telegram</p>
      </div>

      <style>{`
        .payment-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 2000;
        }
        .payment-card {
          width: 100%;
          max-width: 350px;
          padding: 24px;
          text-align: center;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .payment-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }
        .payment-icon {
          font-size: 48px;
          margin: 0 auto;
        }
        .close-btn {
          background: none;
          border: none;
          color: var(--tg-theme-text-color);
          font-size: 24px;
          opacity: 0.5;
          cursor: pointer;
        }
        .benefits-list {
          list-style: none;
          padding: 0;
          margin: 24px 0;
          text-align: left;
        }
        .benefits-list li {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          font-size: 14px;
        }
        .price-tag {
          background: var(--primary-gradient);
          padding: 16px;
          border-radius: 16px;
          margin-bottom: 20px;
          color: white;
        }
        .price-tag .amount {
          display: block;
          font-size: 24px;
          font-weight: 700;
        }
        .price-tag .label {
          font-size: 12px;
          opacity: 0.8;
        }
        .pay-btn {
          width: 100%;
          padding: 16px;
          font-size: 16px;
          font-weight: 600;
        }
        .footer-note {
          font-size: 10px;
          opacity: 0.5;
          margin-top: 12px;
        }
      `}</style>
    </div>
  );
};

export default PaymentModal;
