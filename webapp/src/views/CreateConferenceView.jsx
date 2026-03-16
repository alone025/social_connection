import React, { useState } from 'react';
import { RU as t } from '../constants/locales';

const CreateConferenceView = ({ onBack, onCreate }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    date: '',
    time: '',
    duration: '2h',
    repeat: 'None',
    tags: '',
    maxParticipants: 50,
    coverImage: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      setError('Название обязательно');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Process tags
      const processedData = {
        ...formData,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        startsAt: new Date(`${formData.date}T${formData.time}`),
        day: new Date(formData.date).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
      };
      await onCreate(processedData);
    } catch (err) {
      setError(err.message || 'Ошибка при создании');
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button className="btn-outline" style={{ width: '44px', height: '44px', padding: 0, borderRadius: '14px', border: 'none', background: 'white', boxShadow: 'var(--card-shadow-sm)' }} onClick={onBack}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <h3 style={{ margin: 0 }}>Создать конференцию</h3>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
        {error && <div style={{ color: '#ef4444', fontSize: '14px', textAlign: 'center' }}>{error}</div>}
        
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#a0aec0', textTransform: 'uppercase', marginBottom: '8px' }}>Название</label>
          <input className="form-input" name="name" value={formData.name} onChange={handleChange} placeholder="Tech Summit 2024" required />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#a0aec0', textTransform: 'uppercase', marginBottom: '8px' }}>Описание</label>
          <textarea className="form-input" name="description" value={formData.description} onChange={handleChange} placeholder="О чем это событие..." style={{ height: '100px', resize: 'none' }} />
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#a0aec0', textTransform: 'uppercase', marginBottom: '8px' }}>Дата</label>
            <input className="form-input" type="date" name="date" value={formData.date} onChange={handleChange} required />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#a0aec0', textTransform: 'uppercase', marginBottom: '8px' }}>Время</label>
            <input className="form-input" type="time" name="time" value={formData.time} onChange={handleChange} required />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#a0aec0', textTransform: 'uppercase', marginBottom: '8px' }}>Длительность</label>
            <input className="form-input" name="duration" value={formData.duration} onChange={handleChange} placeholder="2h 30m" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#a0aec0', textTransform: 'uppercase', marginBottom: '8px' }}>Повтор</label>
            <select className="form-input" name="repeat" value={formData.repeat} onChange={handleChange}>
              <option value="None">Нет</option>
              <option value="Daily">Ежедневно</option>
              <option value="Weekly">Еженедельно</option>
            </select>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#a0aec0', textTransform: 'uppercase', marginBottom: '8px' }}>Местоположение</label>
          <input className="form-input" name="location" value={formData.location} onChange={handleChange} placeholder="Online или адрес" />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#a0aec0', textTransform: 'uppercase', marginBottom: '8px' }}>Теги (через запятую)</label>
          <input className="form-input" name="tags" value={formData.tags} onChange={handleChange} placeholder="AI, Web3, Networking" />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#a0aec0', textTransform: 'uppercase', marginBottom: '8px' }}>Макс. участников</label>
          <input className="form-input" type="number" name="maxParticipants" value={formData.maxParticipants} onChange={handleChange} />
        </div>

        <button className="btn-solid" type="submit" disabled={loading}>
          {loading ? 'Создание...' : 'Создать и запустить'}
        </button>
      </form>
    </div>
  );
};

export default CreateConferenceView;
