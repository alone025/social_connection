const express = require('express');
const { Conference } = require('../models/conference');
const { generateOrganizerReport } = require('../services/report.service');
const { ensureUserFromTelegram } = require('../services/conference.service');

const router = express.Router();

// GET /organizer-dashboard/:code?key=SECOND_SCREEN_API_KEY&telegramId=...
router.get('/organizer-dashboard/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const providedKey = req.query.key;
    const telegramId = req.query.telegramId;
    const configuredKey = process.env.SECOND_SCREEN_API_KEY;

    if (!configuredKey) {
      return res.status(500).send('Dashboard API key is not configured on server.');
    }

    if (!providedKey || providedKey !== configuredKey) {
      return res.status(401).send('Invalid or missing dashboard key.');
    }

    if (!telegramId) {
      return res.status(400).send('Telegram ID is required.');
    }

    // Get conference
    const conference = await Conference.findOne({ conferenceCode: code });
    if (!conference) {
      return res.status(404).send('Conference not found.');
    }

    // Get user and generate report
    const user = await ensureUserFromTelegram({ id: parseInt(telegramId) });
    const report = await generateOrganizerReport({ telegramUser: { id: parseInt(telegramId) }, conferenceCode: code });

    // Format dates
    const formatDate = (date) => {
      if (!date) return 'Не указано';
      return new Date(date).toLocaleString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    // Calculate percentages for visual bars
    const calculatePercentage = (value, total) => {
      if (total === 0) return 0;
      return Math.min(100, Math.round((value / total) * 100));
    };

    const html = `
<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <title>Отчёт организатора – ${report.conference.title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #1a202c;
        padding: 20px;
        min-height: 100vh;
      }
      .container {
        max-width: 1200px;
        margin: 0 auto;
      }
      header {
        background: white;
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 24px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }
      header h1 {
        font-size: 28px;
        font-weight: 700;
        color: #2d3748;
        margin-bottom: 8px;
      }
      header .conference-info {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        margin-top: 12px;
        font-size: 14px;
        color: #718096;
      }
      header .conference-info span {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        margin-left: 8px;
      }
      .status-active { background: #c6f6d5; color: #22543d; }
      .status-ended { background: #fed7d7; color: #742a2a; }
      .status-stopped { background: #feebc8; color: #7c2d12; }
      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 20px;
        margin-bottom: 24px;
      }
      .metric-card {
        background: white;
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .metric-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 12px rgba(0, 0, 0, 0.15);
      }
      .metric-card h3 {
        font-size: 14px;
        font-weight: 600;
        color: #718096;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 12px;
      }
      .metric-value {
        font-size: 36px;
        font-weight: 700;
        color: #2d3748;
        margin-bottom: 8px;
      }
      .metric-label {
        font-size: 14px;
        color: #a0aec0;
      }
      .section {
        background: white;
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 24px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }
      .section h2 {
        font-size: 20px;
        font-weight: 700;
        color: #2d3748;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 2px solid #e2e8f0;
      }
      .stat-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0;
        border-bottom: 1px solid #e2e8f0;
      }
      .stat-row:last-child {
        border-bottom: none;
      }
      .stat-label {
        font-size: 15px;
        color: #4a5568;
        font-weight: 500;
      }
      .stat-value {
        font-size: 18px;
        font-weight: 700;
        color: #2d3748;
      }
      .progress-bar {
        width: 100%;
        height: 8px;
        background: #e2e8f0;
        border-radius: 4px;
        overflow: hidden;
        margin-top: 8px;
      }
      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        transition: width 0.3s ease;
      }
      .role-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-top: 16px;
      }
      .role-card {
        background: #f7fafc;
        border-radius: 12px;
        padding: 16px;
        text-align: center;
      }
      .role-card .role-value {
        font-size: 32px;
        font-weight: 700;
        color: #667eea;
        margin-bottom: 4px;
      }
      .role-card .role-label {
        font-size: 14px;
        color: #718096;
        font-weight: 500;
      }
      .engagement-indicator {
        display: inline-block;
        padding: 8px 16px;
        border-radius: 20px;
        font-weight: 600;
        font-size: 14px;
        margin-left: 12px;
      }
      .engagement-high { background: #c6f6d5; color: #22543d; }
      .engagement-medium { background: #feebc8; color: #7c2d12; }
      .engagement-low { background: #fed7d7; color: #742a2a; }
      .footer {
        text-align: center;
        color: white;
        margin-top: 24px;
        font-size: 14px;
        opacity: 0.9;
      }
      @media (max-width: 768px) {
        .metrics-grid {
          grid-template-columns: 1fr;
        }
        header h1 {
          font-size: 24px;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <header>
        <h1>📊 Отчёт организатора</h1>
        <div style="font-size: 18px; color: #4a5568; margin-top: 4px;">${report.conference.title}</div>
        <div class="conference-info">
          <span>🔑 Код: <strong>${report.conference.conferenceCode}</strong></span>
          <span>📅 Статус: <strong>${report.conference.status}</strong>
            <span class="status-badge ${
              report.conference.status === 'Активна' ? 'status-active' :
              report.conference.status === 'Завершена' ? 'status-ended' : 'status-stopped'
            }">${report.conference.status}</span>
          </span>
          ${report.conference.startsAt ? `<span>⏰ Начало: ${formatDate(report.conference.startsAt)}</span>` : ''}
          ${report.conference.endsAt ? `<span>🏁 Конец: ${formatDate(report.conference.endsAt)}</span>` : ''}
        </div>
      </header>

      <div class="metrics-grid">
        <div class="metric-card">
          <h3>👥 Участники</h3>
          <div class="metric-value">${report.participants.total}</div>
          <div class="metric-label">Всего зарегистрировано</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${calculatePercentage(report.participants.onboardingCompleted, report.participants.total)}%"></div>
          </div>
          <div class="metric-label" style="margin-top: 8px;">${report.participants.onboardingCompleted} завершили онбординг (${report.participants.onboardingRate}%)</div>
        </div>

        <div class="metric-card">
          <h3>📈 Вовлечённость</h3>
          <div class="metric-value">${report.engagement.engagementRate}%</div>
          <div class="metric-label">${report.engagement.engagedParticipants} из ${report.participants.total} активных участников</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${report.engagement.engagementRate}%"></div>
          </div>
          <span class="engagement-indicator ${
            report.engagement.engagementRate >= 70 ? 'engagement-high' :
            report.engagement.engagementRate >= 40 ? 'engagement-medium' : 'engagement-low'
          }">
            ${report.engagement.engagementRate >= 70 ? 'Высокая' : report.engagement.engagementRate >= 40 ? 'Средняя' : 'Низкая'}
          </span>
        </div>

        <div class="metric-card">
          <h3>❓ Вопросы</h3>
          <div class="metric-value">${report.questions.total}</div>
          <div class="metric-label">${report.questions.approved} одобрено, ${report.questions.pending} на модерации</div>
        </div>

        <div class="metric-card">
          <h3>📊 Опросы</h3>
          <div class="metric-value">${report.polls.total}</div>
          <div class="metric-label">${report.polls.active} активных, ${report.polls.totalVotes} голосов</div>
        </div>

        <div class="metric-card">
          <h3>🤝 Встречи</h3>
          <div class="metric-value">${report.meetings.total}</div>
          <div class="metric-label">${report.meetings.accepted} принято, ${report.meetings.completed} завершено</div>
        </div>
      </div>

      <div class="section">
        <h2>👥 Участники по ролям</h2>
        <div class="role-grid">
          <div class="role-card">
            <div class="role-value">${report.participants.speakers}</div>
            <div class="role-label">🎤 Спикеры</div>
          </div>
          <div class="role-card">
            <div class="role-value">${report.participants.investors}</div>
            <div class="role-label">💰 Инвесторы</div>
          </div>
          <div class="role-card">
            <div class="role-value">${report.participants.organizers}</div>
            <div class="role-label">📋 Организаторы</div>
          </div>
          <div class="role-card">
            <div class="role-value">${report.participants.regular}</div>
            <div class="role-label">👤 Участники</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>❓ Детали по вопросам</h2>
        <div class="stat-row">
          <span class="stat-label">Всего вопросов</span>
          <span class="stat-value">${report.questions.total}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">✅ Одобрено</span>
          <span class="stat-value">${report.questions.approved}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">⏳ На модерации</span>
          <span class="stat-value">${report.questions.pending}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">❌ Отклонено</span>
          <span class="stat-value">${report.questions.rejected}</span>
        </div>
      </div>

      <div class="section">
        <h2>📊 Детали по опросам</h2>
        <div class="stat-row">
          <span class="stat-label">Всего опросов</span>
          <span class="stat-value">${report.polls.total}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">✅ Активных</span>
          <span class="stat-value">${report.polls.active}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">🗳️ Всего голосов</span>
          <span class="stat-value">${report.polls.totalVotes}</span>
        </div>
        ${report.polls.total > 0 ? `
        <div class="stat-row">
          <span class="stat-label">Среднее голосов на опрос</span>
          <span class="stat-value">${Math.round(report.polls.totalVotes / report.polls.total)}</span>
        </div>
        ` : ''}
      </div>

      <div class="section">
        <h2>🤝 Детали по встречам 1:1</h2>
        <div class="stat-row">
          <span class="stat-label">Всего встреч</span>
          <span class="stat-value">${report.meetings.total}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">✅ Принято</span>
          <span class="stat-value">${report.meetings.accepted}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">✅ Завершено</span>
          <span class="stat-value">${report.meetings.completed}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">⏳ Ожидают ответа</span>
          <span class="stat-value">${report.meetings.pending}</span>
        </div>
        ${report.meetings.total > 0 ? `
        <div class="stat-row">
          <span class="stat-label">Процент завершённых</span>
          <span class="stat-value">${Math.round((report.meetings.completed / report.meetings.total) * 100)}%</span>
        </div>
        ` : ''}
      </div>

      <div class="footer">
        <p>Отчёт сгенерирован: ${new Date().toLocaleString('ru-RU')}</p>
      </div>
    </div>
  </body>
</html>
    `;
    res.send(html);
  } catch (err) {
    console.error('Error rendering organizer dashboard:', err);
    if (err.message === 'CONFERENCE_NOT_FOUND') {
      return res.status(404).send('Conference not found.');
    }
    if (err.message === 'ACCESS_DENIED') {
      return res.status(403).send('Access denied. You must be a conference administrator.');
    }
    res.status(500).send('Internal Server Error');
  }
});

module.exports = {
  organizerDashboardPageRouter: router,
};
