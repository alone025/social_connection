import React, { useState } from 'react';
import { RU as t } from '../constants/locales';

const ProfileForm = ({ profile, onSave, onCancel }) => {
  const [step, setStep] = useState(1);
  const totalSteps = 6;
  
  const [formData, setFormData] = useState({
    firstName: profile?.firstName || '',
    lastName: profile?.lastName || '',
    about: profile?.about || '',
    lookingFor: profile?.lookingFor || '',
    company: profile?.company || '',
    position: profile?.position || '',
    email: profile?.email || '',
    phone: profile?.phone || '',
    country: profile?.country || '',
    region: profile?.region || '',
    city: profile?.city || '',
    telegram: profile?.telegram || '',
    whatsapp: profile?.whatsapp || '',
    interests: profile?.interests || [],
  });

  const interestOptions = ['AI', 'Web3', 'Blockchain', 'Investing', 'Startups', 'SaaS', 'Marketing', 'Java', 'Python', 'React', 'Design', 'Strategy'];

  const toggleInterest = (interest) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const renderField = (label, key, placeholder, type = "text") => (
    <div className="form-group" style={{ marginBottom: '20px' }}>
      <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: '#a0aec0', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</label>
      {type === "textarea" ? (
        <textarea 
          className="form-input"
          value={formData[key]}
          onChange={(e) => setFormData({...formData, [key]: e.target.value})}
          placeholder={placeholder}
          style={{ height: '80px', resize: 'none', padding: '12px' }}
        />
      ) : (
        <input 
          className="form-input"
          value={formData[key]}
          onChange={(e) => setFormData({...formData, [key]: e.target.value})}
          placeholder={placeholder}
        />
      )}
    </div>
  );

  return (
    <div className="card-soft animate-fade-in" style={{ padding: '32px 24px', position: 'relative' }}>
      <div className="step-indicator" style={{ display: 'flex', gap: '6px', marginBottom: '32px' }}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i + 1 <= step ? 'var(--primary)' : '#edf2f7', transition: '0.4s' }} />
        ))}
      </div>

      {step === 1 && (
        <div className="animate-fade-in">
          <h2 style={{ marginBottom: '24px', fontSize: '20px' }}>Личные данные</h2>
          {renderField("ИМЯ", "firstName", "Ваше имя")}
          {renderField("ФАМИЛИЯ", "lastName", "Ваша фамилия")}
          {renderField(t.profile.about, "about", "Расскажите о себе", "textarea")}
          {renderField(t.profile.looking_for, "lookingFor", "Что вы ищете на мероприятии?")}
        </div>
      )}

      {step === 2 && (
        <div className="animate-fade-in">
          <h2 style={{ marginBottom: '24px', fontSize: '20px' }}>Профессиональный опыт</h2>
          {renderField(t.profile.company, "company", "Название компании")}
          {renderField(t.profile.position, "position", "Ваша должность")}
        </div>
      )}

      {step === 3 && (
        <div className="animate-fade-in">
          <h2 style={{ marginBottom: '24px', fontSize: '20px' }}>Контактные данные</h2>
          {renderField(t.profile.email, "email", "example@mail.ru")}
          {renderField(t.profile.phone, "phone", "+7 (999) 000-00-00")}
        </div>
      )}

      {step === 4 && (
        <div className="animate-fade-in">
          <h2 style={{ marginBottom: '24px', fontSize: '20px' }}>Местоположение</h2>
          {renderField(t.profile.country, "country", "Страна")}
          {renderField(t.profile.region, "region", "Регион/Область")}
          {renderField(t.profile.city, "city", "Город")}
        </div>
      )}

      {step === 5 && (
        <div className="animate-fade-in">
          <h2 style={{ marginBottom: '24px', fontSize: '20px' }}>Мессенджеры</h2>
          {renderField("Telegram", "telegram", "username")}
          {renderField("WhatsApp", "whatsapp", "+79001234567")}
        </div>
      )}

      {step === 6 && (
        <div className="animate-fade-in">
          <h2 style={{ marginBottom: '8px', fontSize: '20px' }}>Ваши интересы</h2>
          <p style={{ color: '#a0aec0', marginBottom: '24px', fontSize: '13px' }}>Выберите темы для нетворкинга.</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '32px' }}>
            {interestOptions.map(opt => (
              <button 
                key={opt} 
                className={`tag-pill ${formData.interests.includes(opt) ? 'active' : ''}`}
                onClick={() => toggleInterest(opt)}
                style={{
                  padding: '8px 16px', borderRadius: '14px', border: 'none',
                  background: formData.interests.includes(opt) ? 'var(--primary)' : 'var(--accent-blue)',
                  color: formData.interests.includes(opt) ? 'white' : 'var(--primary)',
                  fontWeight: 600, fontSize: '12px', cursor: 'pointer', transition: '0.2s'
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
        {step > 1 && (
          <button className="btn-outline" style={{ flex: 1, height: '52px' }} onClick={() => setStep(step - 1)}>
            {t.common.back}
          </button>
        )}
        {step < totalSteps ? (
          <button className="btn-solid" style={{ flex: 2, height: '52px' }} onClick={() => setStep(step + 1)}>
            {t.common.next}
          </button>
        ) : (
          <button className="btn-solid" style={{ flex: 2, height: '52px' }} onClick={() => onSave(formData)}>
            {t.common.save}
          </button>
        )}
      </div>

      <button 
        style={{ width: '100%', border: 'none', background: 'none', color: '#a0aec0', marginTop: '20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }} 
        onClick={onCancel}
      >
        {t.common.cancel}
      </button>
    </div>
  );
};

export default ProfileForm;
