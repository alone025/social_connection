const express = require('express');
const { Conference } = require('../models/conference');
const { generateOrganizerReport } = require('../services/report.service');
const { ensureUserFromTelegram } = require('../services/conference.service');

const router = express.Router();

// GET /organizer-admin/:code?key=SECOND_SCREEN_API_KEY&telegramId=...
router.get('/organizer-admin/:code', async (req, res) => {
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

    // Get user
    const user = await ensureUserFromTelegram({ id: parseInt(telegramId) });

    // Escape variables safely for JavaScript
    const apiKey = JSON.stringify(providedKey);
    const telegramIdStr = JSON.stringify(telegramId);
    const confCode = JSON.stringify(code);
    
    // Escape HTML and template literal special characters
    const escapeHtml = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };
    
    // Escape template literal special characters to prevent injection
    const escapeTemplate = (str) => {
      if (!str) return '';
      return String(str).replace(/`/g, '\\`').replace(/\${/g, '\\${');
    };
    
    // Escape values for use in template
    const safeTitle = escapeHtml(conference.title || '');
    const safeCode = escapeHtml(conference.conferenceCode || ''); // Use escapeHtml for display in HTML
    const safeProvidedKey = encodeURIComponent(providedKey);
    const safeTelegramId = encodeURIComponent(telegramId);
    const safeUrlCode = encodeURIComponent(code);

    const html = `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <title>Админ-панель – ${safeTitle}</title>
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
        max-width: 1400px;
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
      .conference-info {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        margin-top: 12px;
        font-size: 14px;
        color: #718096;
      }
      .conference-info span {
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
      .tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 24px;
        flex-wrap: wrap;
      }
      .tab {
        padding: 12px 24px;
        background: white;
        border: none;
        border-radius: 8px 8px 0 0;
        cursor: pointer;
        font-weight: 600;
        color: #718096;
        transition: all 0.2s;
      }
      .tab.active {
        background: white;
        color: #667eea;
        border-bottom: 3px solid #667eea;
      }
      .tab-content {
        display: none;
      }
      .tab-content.active {
        display: block;
      }
      .section {
        background: white;
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 24px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }
      .btn {
        display: inline-block;
        padding: 10px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        text-decoration: none;
      }
      .btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      }
      .btn-secondary { background: #718096; }
      .btn-danger { background: #e53e3e; }
      .btn-success { background: #38a169; }
      .action-buttons {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 24px;
      }
      .table {
        width: 100%;
        border-collapse: collapse;
        background: white;
        border-radius: 8px;
        overflow: hidden;
      }
      .table th, .table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #e2e8f0;
      }
      .table th {
        background: #f7fafc;
        font-weight: 600;
        color: #4a5568;
      }
      .table tr:hover {
        background: #f7fafc;
      }
      .badge {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
      }
      .badge-success { background: #c6f6d5; color: #22543d; }
      .badge-warning { background: #feebc8; color: #7c2d12; }
      .badge-danger { background: #fed7d7; color: #742a2a; }
      .form-group {
        margin-bottom: 16px;
      }
      .form-group label {
        display: block;
        margin-bottom: 6px;
        font-weight: 600;
        color: #4a5568;
      }
      .form-group input, .form-group textarea, .form-group select {
        width: 100%;
        padding: 10px;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        font-size: 14px;
      }
      .modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1000;
        align-items: center;
        justify-content: center;
      }
      .modal.active {
        display: flex;
      }
      .modal-content {
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 600px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
      }
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      }
      .modal-header h2 {
        margin: 0;
      }
      .close-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #718096;
      }
      .filter-row {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        align-items: end;
        margin-bottom: 16px;
      }
      .filter-group {
        flex: 1;
        min-width: 150px;
      }
      .filter-group label {
        display: block;
        margin-bottom: 6px;
        font-weight: 600;
        color: #4a5568;
        font-size: 14px;
      }
      .filter-group input, .filter-group select {
        width: 100%;
        padding: 10px;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        font-size: 14px;
      }
      @media (max-width: 768px) {
        .table {
          font-size: 12px;
        }
        .tabs {
          overflow-x: auto;
        }
      }
    </style>
    <script>
      const API_KEY = ${apiKey};
      const TELEGRAM_ID = ${telegramIdStr};
      const CONFERENCE_CODE = ${confCode};

      function showTab(tabName) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const tabButton = document.querySelector('[data-tab="' + tabName + '"]');
        const tabContent = document.getElementById('tab-' + tabName);
        if (tabButton) tabButton.classList.add('active');
        if (tabContent) tabContent.classList.add('active');

        if (tabName === 'conferences') loadConferences();
        if (tabName === 'participants') loadParticipants();
        if (tabName === 'polls') loadPolls();
        if (tabName === 'questions') loadQuestions();
        if (tabName === 'meetings') loadMeetings();
        if (tabName === 'slides') loadSlides();
        if (tabName === 'tariff') loadTariffInfo();
      }

      async function loadTariffInfo() {
        try {
          // Load current subscription info
          const confData = await apiCall('/organizer-api/' + CONFERENCE_CODE + '/conference');
          const currentInfoDiv = document.getElementById('tariff-current-info');
          
          if (confData.subscription) {
            const sub = confData.subscription;
            const limits = confData.limits || {};
            const endDate = sub.endsAt ? new Date(sub.endsAt).toLocaleDateString('ru-RU') : 'Не ограничено';
            
            currentInfoDiv.innerHTML = 
              '<h3>Текущий тарифный план</h3>' +
              '<div style="margin-top: 12px;">' +
              '<p><strong>План:</strong> ' + escapeHtml(sub.planName || 'Не назначен') + '</p>' +
              '<p><strong>Статус:</strong> <span class="badge ' + (sub.status === 'active' ? 'badge-success' : 'badge-warning') + '">' + (sub.status === 'active' ? 'Активен' : sub.status) + '</span></p>' +
              '<p><strong>Действует до:</strong> ' + endDate + '</p>' +
              '</div>' +
              '<div style="margin-top: 16px; padding: 12px; background: white; border-radius: 8px;">' +
              '<h4 style="margin-top: 0;">Текущие лимиты:</h4>' +
              '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 8px;">' +
              '<div>Участники: ' + (limits.maxParticipantsPerConference === -1 ? '∞' : limits.maxParticipantsPerConference) + '</div>' +
              '<div>Опросы: ' + (limits.maxPollsPerConference === -1 ? '∞' : limits.maxPollsPerConference) + '</div>' +
              '<div>Вопросы: ' + (limits.maxQuestionsPerConference === -1 ? '∞' : limits.maxQuestionsPerConference) + '</div>' +
              '<div>Встречи: ' + (limits.maxMeetingsPerConference === -1 ? '∞' : limits.maxMeetingsPerConference) + '</div>' +
              '</div>' +
              '<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0;">' +
              '<h4 style="margin-top: 0;">Доступные функции:</h4>' +
              '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 8px;">' +
              '<div>' + (limits.pollsEnabled ? '✅' : '❌') + ' Опросы</div>' +
              '<div>' + (limits.secondScreenEnabled ? '✅' : '❌') + ' Second Screen</div>' +
              '<div>' + (limits.organizerDashboardEnabled ? '✅' : '❌') + ' Админ-панель</div>' +
              '<div>' + (limits.exportCsvEnabled ? '✅' : '❌') + ' Экспорт CSV</div>' +
              '<div>' + (limits.exportPdfEnabled ? '✅' : '❌') + ' Экспорт PDF</div>' +
              '</div>' +
              '</div>';
          } else {
            currentInfoDiv.innerHTML = 
              '<h3>Текущий тарифный план</h3>' +
              '<p style="color: #e53e3e;">Тарифный план не назначен. Используется план по умолчанию.</p>';
          }

          // Load available plans
          const plansData = await apiCall('/organizer-api/' + CONFERENCE_CODE + '/tariffs');
          const plansDiv = document.getElementById('tariff-plans-list');
          
          if (plansData.items && plansData.items.length > 0) {
            plansDiv.innerHTML = plansData.items.map(plan => {
              const price = plan.pricePerMonth > 0 ? (plan.pricePerMonth / 100).toFixed(2) + ' ' + (plan.currency || 'USD') + '/мес' : 'Бесплатно';
              const isCurrent = confData.subscription && String(confData.subscription.planId) === String(plan.id);
              
              return '<div style="padding: 20px; background: white; border-radius: 12px; border: 2px solid ' + (isCurrent ? '#667eea' : '#e2e8f0') + ';">' +
                '<div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">' +
                '<div>' +
                '<h4 style="margin: 0;">' + escapeHtml(plan.displayName) + (isCurrent ? ' <span class="badge badge-success">Текущий</span>' : '') + '</h4>' +
                '<p style="margin: 4px 0 0 0; color: #718096; font-size: 14px;">' + escapeHtml(plan.description || '') + '</p>' +
                '</div>' +
                '<div style="text-align: right;">' +
                '<div style="font-size: 24px; font-weight: 700; color: #667eea;">' + price + '</div>' +
                '</div>' +
                '</div>' +
                '<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0;">' +
                '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; font-size: 14px;">' +
                '<div>👥 Участники: ' + (plan.limits.maxParticipantsPerConference === -1 ? '∞' : plan.limits.maxParticipantsPerConference) + '</div>' +
                '<div>📊 Опросы: ' + (plan.limits.maxPollsPerConference === -1 ? '∞' : plan.limits.maxPollsPerConference) + '</div>' +
                '<div>❓ Вопросы: ' + (plan.limits.maxQuestionsPerConference === -1 ? '∞' : plan.limits.maxQuestionsPerConference) + '</div>' +
                '<div>🤝 Встречи: ' + (plan.limits.maxMeetingsPerConference === -1 ? '∞' : plan.limits.maxMeetingsPerConference) + '</div>' +
                '</div>' +
                '<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0;">' +
                '<div style="display: flex; flex-wrap: wrap; gap: 8px; font-size: 13px;">' +
                '<span>' + (plan.limits.pollsEnabled ? '✅ Опросы' : '❌ Опросы') + '</span>' +
                '<span>' + (plan.limits.secondScreenEnabled ? '✅ Second Screen' : '❌ Second Screen') + '</span>' +
                '<span>' + (plan.limits.exportCsvEnabled ? '✅ CSV' : '❌ CSV') + '</span>' +
                '<span>' + (plan.limits.exportPdfEnabled ? '✅ PDF' : '❌ PDF') + '</span>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '<div style="margin-top: 16px;">' +
                (isCurrent ? 
                  '<button class="btn btn-secondary" disabled>Текущий план</button>' :
                  '<button class="btn btn-success" onclick="applyTariffPlan(' + JSON.stringify(plan.id) + ')">Выбрать план</button>'
                ) +
                '</div>' +
                '</div>';
            }).join('');
          } else {
            plansDiv.innerHTML = '<p>Тарифные планы не найдены.</p>';
          }
        } catch (err) {
          alert('Ошибка загрузки информации о тарифе: ' + err.message);
        }
      }

      async function applyTariffPlan(planId) {
        if (!confirm('Вы уверены, что хотите изменить тарифный план для этой конференции?')) {
          return;
        }

        try {
          await apiCall('/organizer-api/' + CONFERENCE_CODE + '/subscription', {
            method: 'PUT',
            body: JSON.stringify({ tariffPlanId: planId }),
          });
          
          alert('Тарифный план успешно изменён!');
          loadTariffInfo();
        } catch (err) {
          const errorMsg = err.message || 'Неизвестная ошибка';
          alert('Ошибка изменения тарифного плана: ' + errorMsg);
        }
      }

      async function apiCall(endpoint, options = {}) {
        // Build URL: if endpoint already includes query params, append to it; otherwise add them
        let url = endpoint;
        const hasQuery = endpoint.includes('?');
        const queryParams = 'key=' + encodeURIComponent(API_KEY) + '&telegramId=' + encodeURIComponent(TELEGRAM_ID);
        if (hasQuery) {
          url = endpoint + '&' + queryParams;
        } else {
          url = endpoint + '?' + queryParams;
        }
        
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'API error');
        }
        return response.json();
      }

      function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
      }

      async function loadConferences() {
        try {
          const data = await apiCall('/organizer-api/user/conferences');
          const tbody = document.getElementById('conferences-tbody');
          if (!tbody) return;
          tbody.innerHTML = data.items.map(c => {
            const status = c.isEnded ? 'Завершена' : c.isActive ? 'Активна' : 'Остановлена';
            const statusBadge = c.isEnded ? 'badge-danger' : c.isActive ? 'badge-success' : 'badge-warning';
            const safeCode = escapeHtml(c.code || '');
            const safeTitle = escapeHtml(c.title || '');
            const safeKey = encodeURIComponent(API_KEY);
            const safeTelegramId = encodeURIComponent(TELEGRAM_ID);
            return '<tr>' +
              '<td>' + safeTitle + '</td>' +
              '<td>' + safeCode + '</td>' +
              '<td><span class="badge ' + statusBadge + '">' + status + '</span></td>' +
              '<td>' +
              '<a href="/second-screen/' + safeCode + '?key=' + safeKey + '&telegramId=' + safeTelegramId + '" class="btn btn-secondary">Открыть</a> ' +
              '<a href="/organizer-dashboard/' + safeCode + '?key=' + safeKey + '&telegramId=' + safeTelegramId + '" class="btn">📊 Отчёт</a>' +
              '</td>' +
              '</tr>';
          }).join('');
        } catch (err) {
          alert('Ошибка загрузки конференций: ' + err.message);
        }
      }

      async function loadSlides() {
        try {
          const data = await apiCall('/organizer-api/' + CONFERENCE_CODE + '/slides');
          const urlInput = document.getElementById('current-slide-url');
          const titleInput = document.getElementById('current-slide-title');
          if (urlInput) urlInput.value = data.url || '';
          if (titleInput) titleInput.value = data.title || '';
        } catch (err) {
          alert('Ошибка загрузки слайда: ' + err.message);
        }
      }

      async function saveSlide(e) {
        e.preventDefault();
        const urlInput = document.getElementById('current-slide-url');
        const titleInput = document.getElementById('current-slide-title');
        if (!urlInput || !titleInput) return;
        
        const url = (urlInput.value || '').trim();
        const title = (titleInput.value || '').trim();

        // If URL is empty, clear the slide instead
        if (!url) {
          if (!confirm('URL пустой. Очистить текущий слайд?')) return;
          try {
            await apiCall('/organizer-api/' + CONFERENCE_CODE + '/slides', {
              method: 'DELETE',
            });
            urlInput.value = '';
            titleInput.value = '';
            alert('Слайд очищен!');
          } catch (err) {
            alert('Ошибка очистки слайда: ' + err.message);
          }
          return;
        }

        // Validate URL format before sending
        try {
          new URL(url);
        } catch (err) {
          alert('Ошибка: URL должен быть валидным HTTP/HTTPS адресом (например: https://example.com/slide.jpg)');
          return;
        }

        try {
          await apiCall('/organizer-api/' + CONFERENCE_CODE + '/slides', {
            method: 'POST',
            body: JSON.stringify({ url, title }),
          });
          alert('Слайд обновлён успешно!');
        } catch (err) {
          alert('Ошибка сохранения слайда: ' + err.message);
        }
      }

      async function clearCurrentSlide() {
        if (!confirm('Очистить текущий слайд?')) return;
        try {
          await apiCall('/organizer-api/' + CONFERENCE_CODE + '/slides', {
            method: 'DELETE',
          });
          const urlInput = document.getElementById('current-slide-url');
          const titleInput = document.getElementById('current-slide-title');
          if (urlInput) urlInput.value = '';
          if (titleInput) titleInput.value = '';
          alert('Слайд очищен!');
        } catch (err) {
          alert('Ошибка: ' + err.message);
        }
      }

      async function createConferenceSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const payload = {
          title: formData.get('title'),
          description: formData.get('description'),
          access: formData.get('access'),
          startsAt: formData.get('startsAt') || undefined,
          endsAt: formData.get('endsAt') || undefined,
        };

        try {
          const data = await apiCall('/organizer-api/user/conferences', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          alert('Конференция создана! Код: ' + data.code);
          hideCreateConferenceModal();
          loadConferences();
        } catch (err) {
          if (err.message.includes('Limit exceeded')) {
            alert('Достигнут лимит на количество конференций. Проверьте ваш тарифный план.');
          } else {
            alert('Ошибка создания конференции: ' + err.message);
          }
        }
      }

      function showCreateConferenceModal() {
        const modal = document.getElementById('create-conference-modal');
        if (modal) modal.classList.add('active');
      }

      function hideCreateConferenceModal() {
        const modal = document.getElementById('create-conference-modal');
        const form = document.getElementById('create-conference-form');
        if (modal) modal.classList.remove('active');
        if (form) form.reset();
      }

      async function loadParticipants() {
        try {
          const roleFilter = document.getElementById('participant-role-filter');
          const activeFilter = document.getElementById('participant-active-filter');
          const onboardingFilter = document.getElementById('participant-onboarding-filter');
          const searchFilter = document.getElementById('participant-search-filter');

          let url = '/organizer-api/' + CONFERENCE_CODE + '/participants';
          const params = [];
          if (roleFilter && roleFilter.value) params.push('role=' + roleFilter.value);
          if (activeFilter && activeFilter.value !== 'all') params.push('isActive=' + activeFilter.value);
          if (onboardingFilter && onboardingFilter.value !== 'all') params.push('onboardingCompleted=' + onboardingFilter.value);
          if (searchFilter && searchFilter.value) params.push('search=' + encodeURIComponent(searchFilter.value));
          if (params.length > 0) url += '?' + params.join('&');

          const data = await apiCall(url);
          const tbody = document.getElementById('participants-tbody');
          if (!tbody) return;
          
          // Clear existing event listeners by replacing innerHTML
          tbody.innerHTML = '';
          
          data.items.forEach(p => {
            const row = document.createElement('tr');
            const roles = p.roles && p.roles.length > 0 ? p.roles.join(', ') : '—';
            const safeName = escapeHtml((p.firstName || '') + ' ' + (p.lastName || ''));
            const safeUsername = escapeHtml(p.username || '—');
            const safeRoles = escapeHtml(roles);
            const safeId = String(p.id || '');
            
            row.innerHTML = 
              '<td>' + safeName + '</td>' +
              '<td>@' + safeUsername + '</td>' +
              '<td>' + safeRoles + '</td>' +
              '<td><span class="badge ' + (p.isActive ? 'badge-success' : 'badge-danger') + '">' + (p.isActive ? 'Активен' : 'Неактивен') + '</span></td>' +
              '<td>' +
              '<button class="btn btn-secondary btn-edit-participant" data-participant-id="' + escapeHtml(safeId) + '">Редактировать</button> ' +
              (p.isActive ? 
                '<button class="btn btn-danger btn-deactivate-participant" data-participant-id="' + escapeHtml(safeId) + '">Деактивировать</button>' :
                '<button class="btn btn-success btn-activate-participant" data-participant-id="' + escapeHtml(safeId) + '">Активировать</button>'
              ) +
              '</td>';
            
            tbody.appendChild(row);
          });
          
          // Attach event listeners
          tbody.querySelectorAll('.btn-edit-participant').forEach(btn => {
            btn.addEventListener('click', function() {
              const participantId = this.getAttribute('data-participant-id');
              editParticipant(participantId);
            });
          });
          
          tbody.querySelectorAll('.btn-deactivate-participant').forEach(btn => {
            btn.addEventListener('click', function() {
              const participantId = this.getAttribute('data-participant-id');
              toggleParticipantStatus(participantId, false);
            });
          });
          
          tbody.querySelectorAll('.btn-activate-participant').forEach(btn => {
            btn.addEventListener('click', function() {
              const participantId = this.getAttribute('data-participant-id');
              toggleParticipantStatus(participantId, true);
            });
          });
        } catch (err) {
          alert('Ошибка загрузки участников: ' + err.message);
        }
      }

      async function loadPolls() {
        try {
          const data = await apiCall('/organizer-api/' + CONFERENCE_CODE + '/polls');
          const tbody = document.getElementById('polls-tbody');
          if (!tbody) return;
          
          // Clear existing event listeners by replacing innerHTML
          tbody.innerHTML = '';
          
          data.items.forEach(p => {
            const row = document.createElement('tr');
            const safeQuestion = escapeHtml(p.question || '');
            const safeId = String(p.id || '');
            
            row.innerHTML = 
              '<td>' + safeQuestion + '</td>' +
              '<td>' + (p.totalVotes || 0) + '</td>' +
              '<td><span class="badge ' + (p.isActive ? 'badge-success' : 'badge-warning') + '">' + (p.isActive ? 'Активен' : 'Неактивен') + '</span></td>' +
              '<td>' +
              '<button class="btn btn-secondary btn-edit-poll" data-poll-id="' + escapeHtml(safeId) + '">Редактировать</button> ' +
              '<button class="btn btn-danger btn-delete-poll" data-poll-id="' + escapeHtml(safeId) + '">Удалить</button>' +
              '</td>';
            
            tbody.appendChild(row);
          });
          
          // Attach event listeners
          tbody.querySelectorAll('.btn-edit-poll').forEach(btn => {
            btn.addEventListener('click', function() {
              const pollId = this.getAttribute('data-poll-id');
              editPoll(pollId);
            });
          });
          
          tbody.querySelectorAll('.btn-delete-poll').forEach(btn => {
            btn.addEventListener('click', function() {
              const pollId = this.getAttribute('data-poll-id');
              deletePoll(pollId);
            });
          });
        } catch (err) {
          alert('Ошибка загрузки опросов: ' + err.message);
        }
      }

      async function loadQuestions() {
        try {
          const data = await apiCall('/organizer-api/' + CONFERENCE_CODE + '/questions');
          const tbody = document.getElementById('questions-tbody');
          if (!tbody) return;
          tbody.innerHTML = data.items.map(q => {
            const statusBadge = q.status === 'approved' ? 'badge-success' : q.status === 'rejected' ? 'badge-danger' : 'badge-warning';
            const statusText = q.status === 'approved' ? 'Одобрено' : q.status === 'rejected' ? 'Отклонено' : 'На модерации';
            const safeText = escapeHtml(q.text ? q.text.substring(0, 50) + (q.text.length > 50 ? '...' : '') : '');
            const safeAuthor = escapeHtml(q.author ? (q.author.firstName || '') + ' ' + (q.author.lastName || '') : '—');
            const safeId = String(q.id || '');
            const answeredBadge = q.isAnswered ? '<span class="badge badge-info" style="margin-left: 8px;">✅ Отвечено</span>' : '';
            return '<tr>' +
              '<td>' + safeText + '</td>' +
              '<td>' + safeAuthor + '</td>' +
              '<td><span class="badge ' + statusBadge + '">' + statusText + '</span>' + answeredBadge + '</td>' +
              '<td>' +
              (q.status !== 'approved' ? '<button class="btn btn-success btn-sm" onclick="moderateQuestion(' + JSON.stringify(safeId) + ', ' + JSON.stringify('approved') + ')">Одобрить</button> ' : '') +
              (q.status !== 'rejected' ? '<button class="btn btn-danger btn-sm" onclick="moderateQuestion(' + JSON.stringify(safeId) + ', ' + JSON.stringify('rejected') + ')">Отклонить</button> ' : '') +
              (q.status === 'approved' && !q.isAnswered ? '<button class="btn btn-info btn-sm" onclick="markQuestionAnswered(' + JSON.stringify(safeId) + ', true)">✅ Отметить как отвечено</button>' : '') +
              (q.isAnswered ? '<button class="btn btn-secondary btn-sm" onclick="markQuestionAnswered(' + JSON.stringify(safeId) + ', false)">↩️ Снять отметку</button>' : '') +
              '</td>' +
              '</tr>';
          }).join('');
        } catch (err) {
          alert('Ошибка загрузки вопросов: ' + err.message);
        }
      }

      async function moderateQuestion(questionId, status) {
        if (!confirm('Вы уверены?')) return;
        try {
          await apiCall('/organizer-api/' + CONFERENCE_CODE + '/questions/' + questionId, {
            method: 'PUT',
            body: JSON.stringify({ status }),
          });
          alert('Статус вопроса обновлён');
          loadQuestions();
        } catch (err) {
          alert('Ошибка: ' + err.message);
        }
      }

      async function markQuestionAnswered(questionId, isAnswered) {
        try {
          await apiCall('/organizer-api/' + CONFERENCE_CODE + '/questions/' + questionId, {
            method: 'PUT',
            body: JSON.stringify({ isAnswered }),
          });
          alert(isAnswered ? 'Вопрос отмечен как отвеченный' : 'Отметка "отвечено" снята');
          loadQuestions();
        } catch (err) {
          alert('Ошибка: ' + err.message);
        }
      }

      async function deletePoll(pollId) {
        if (!confirm('Вы уверены, что хотите удалить этот опрос?')) return;
        try {
          await apiCall('/organizer-api/' + CONFERENCE_CODE + '/polls/' + pollId, {
            method: 'DELETE',
          });
          loadPolls();
        } catch (err) {
          alert('Ошибка: ' + err.message);
        }
      }

      async function loadMeetings() {
        try {
          const statusFilter = document.getElementById('meeting-status-filter')?.value || '';
          let url = '/organizer-api/' + CONFERENCE_CODE + '/meetings';
          if (statusFilter) {
            url += '?status=' + encodeURIComponent(statusFilter);
          }
          
          const data = await apiCall(url);
          const tbody = document.getElementById('meetings-tbody');
          if (!tbody) return;
          
          if (!data.items || data.items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Встреч не найдено</td></tr>';
            return;
          }
          
          tbody.innerHTML = data.items.map(m => {
            const safeId = JSON.stringify(m.id);
            const requesterName = escapeHtml((m.requester?.firstName || '') + ' ' + (m.requester?.lastName || '')).trim() || escapeHtml(m.requester?.telegramId || 'Неизвестно');
            const recipientName = escapeHtml((m.recipient?.firstName || '') + ' ' + (m.recipient?.lastName || '')).trim() || escapeHtml(m.recipient?.telegramId || 'Неизвестно');
            const proposedTime = m.proposedTime ? new Date(m.proposedTime).toLocaleString('ru-RU') : 'Не указано';
            const duration = m.durationMinutes ? m.durationMinutes + ' мин' : '30 мин';
            
            const statusMap = {
              'pending': { text: 'Ожидает', class: 'badge-warning' },
              'accepted': { text: 'Подтверждено', class: 'badge-success' },
              'rejected': { text: 'Отклонено', class: 'badge-danger' },
              'cancelled': { text: 'Отменено', class: 'badge-secondary' },
              'completed': { text: 'Завершено', class: 'badge-info' },
            };
            const statusInfo = statusMap[m.status] || { text: m.status, class: 'badge-secondary' };
            
            return '<tr>' +
              '<td>' + requesterName + '</td>' +
              '<td>' + recipientName + '</td>' +
              '<td>' + proposedTime + '</td>' +
              '<td>' + duration + '</td>' +
              '<td><span class="badge ' + statusInfo.class + '">' + statusInfo.text + '</span></td>' +
              '<td>' +
              (m.status === 'pending' ? 
                '<button class="btn btn-success btn-sm" onclick="updateMeetingStatus(' + safeId + ', ' + JSON.stringify('accepted') + ')">✅ Подтвердить</button> ' +
                '<button class="btn btn-danger btn-sm" onclick="updateMeetingStatus(' + safeId + ', ' + JSON.stringify('rejected') + ')">❌ Отклонить</button>' :
                '<span style="color: #718096; font-size: 13px;">Действия недоступны</span>'
              ) +
              '</td>' +
              '</tr>';
          }).join('');
        } catch (err) {
          alert('Ошибка загрузки встреч: ' + err.message);
        }
      }

      async function updateMeetingStatus(meetingId, status) {
        if (!confirm('Вы уверены, что хотите изменить статус встречи?')) {
          return;
        }
        
        try {
          await apiCall('/organizer-api/' + CONFERENCE_CODE + '/meetings/' + meetingId, {
            method: 'PUT',
            body: JSON.stringify({ status }),
          });
          
          alert('Статус встречи обновлён');
          loadMeetings();
        } catch (err) {
          const errorMsg = err.message || 'Неизвестная ошибка';
          alert('Ошибка обновления статуса встречи: ' + errorMsg);
        }
      }

      function applyMeetingFilters() {
        loadMeetings();
      }

      function exportCSV(type) {
        const url = '/organizer-api/' + CONFERENCE_CODE + '/export/' + type + '?key=' + encodeURIComponent(API_KEY) + '&telegramId=' + encodeURIComponent(TELEGRAM_ID);
        window.location.href = url;
      }

      function showCreatePollModal() {
        currentEditingPollId = null;
        const modal = document.getElementById('create-poll-modal');
        const modalTitle = modal ? modal.querySelector('.modal-header h2') : null;
        const form = document.getElementById('poll-form');
        
        if (form) form.reset();
        if (modalTitle) modalTitle.textContent = 'Создать опрос';
        if (modal) modal.classList.add('active');
      }

      async function createPoll(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const question = (formData.get('question') || '').trim();
        const options = [
          formData.get('option1'),
          formData.get('option2'),
          formData.get('option3'),
          formData.get('option4'),
        ].map(opt => (opt || '').trim()).filter(opt => opt);

        if (!question) {
          alert('Пожалуйста, введите вопрос опроса');
          return;
        }

        if (options.length < 2) {
          alert('Пожалуйста, введите как минимум 2 варианта ответа');
          return;
        }

        try {
          if (currentEditingPollId) {
            // Update existing poll
            await apiCall('/organizer-api/' + CONFERENCE_CODE + '/polls/' + encodeURIComponent(currentEditingPollId), {
              method: 'PUT',
              body: JSON.stringify({ question, options }),
            });
            alert('Опрос успешно обновлён');
            currentEditingPollId = null;
          } else {
            // Create new poll
            await apiCall('/organizer-api/' + CONFERENCE_CODE + '/polls', {
              method: 'POST',
              body: JSON.stringify({ question, options }),
            });
            alert('Опрос успешно создан');
          }
          
          hideCreatePollModal();
          loadPolls();
        } catch (err) {
          const errorMsg = err.message || 'Неизвестная ошибка';
          alert('Ошибка сохранения опроса: ' + errorMsg);
        }
      }

      function hideCreatePollModal() {
        const modal = document.getElementById('create-poll-modal');
        const form = document.getElementById('poll-form');
        const modalTitle = modal ? modal.querySelector('.modal-header h2') : null;
        const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
        
        if (modal) modal.classList.remove('active');
        if (form) {
          form.reset();
          // Reset form submit handler
          form.onsubmit = createPoll;
        }
        if (modalTitle) modalTitle.textContent = 'Создать опрос';
        if (submitBtn) submitBtn.textContent = 'Создать опрос';
        currentEditingPollId = null;
      }

      let currentEditingParticipantId = null;

      async function editParticipant(participantId) {
        if (!participantId) {
          alert('Ошибка: ID участника не указан');
          return;
        }
        
        try {
          // Load participant data
          const data = await apiCall('/organizer-api/' + CONFERENCE_CODE + '/participants');
          const participant = data.items.find(p => String(p.id) === String(participantId));
          
          if (!participant) {
            alert('Участник не найден');
            return;
          }
          
          // Set current editing participant ID
          currentEditingParticipantId = participantId;
          
          // Fill form with participant data
          const form = document.getElementById('participant-form');
          const modal = document.getElementById('edit-participant-modal');
          const modalTitle = modal ? modal.querySelector('.modal-header h2') : null;
          const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
          
          if (modalTitle) modalTitle.textContent = 'Редактировать участника';
          if (submitBtn) submitBtn.textContent = 'Сохранить изменения';
          
          // Set basic fields
          const firstNameInput = form ? form.querySelector('input[name="firstName"]') : null;
          const lastNameInput = form ? form.querySelector('input[name="lastName"]') : null;
          const interestsInput = form ? form.querySelector('textarea[name="interests"]') : null;
          const offeringsInput = form ? form.querySelector('textarea[name="offerings"]') : null;
          const lookingForInput = form ? form.querySelector('textarea[name="lookingFor"]') : null;
          
          if (firstNameInput) firstNameInput.value = participant.firstName || '';
          if (lastNameInput) lastNameInput.value = participant.lastName || '';
          if (interestsInput) interestsInput.value = (participant.interests || []).join(', ');
          if (offeringsInput) offeringsInput.value = (participant.offerings || []).join(', ');
          if (lookingForInput) lookingForInput.value = (participant.lookingFor || []).join(', ');
          
          // Set roles checkboxes
          const roleCheckboxes = form ? form.querySelectorAll('input[type="checkbox"][name="roles"]') : [];
          roleCheckboxes.forEach(checkbox => {
            checkbox.checked = (participant.roles || []).includes(checkbox.value);
          });
          
          // Show modal
          if (modal) modal.classList.add('active');
          
        } catch (err) {
          alert('Ошибка загрузки данных участника: ' + err.message);
        }
      }

      async function saveParticipant(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const firstName = (formData.get('firstName') || '').trim();
        const lastName = (formData.get('lastName') || '').trim();
        const interests = (formData.get('interests') || '').split(',').map(i => i.trim()).filter(i => i);
        const offerings = (formData.get('offerings') || '').split(',').map(o => o.trim()).filter(o => o);
        const lookingFor = (formData.get('lookingFor') || '').split(',').map(l => l.trim()).filter(l => l);
        
        // Get selected roles
        const roleCheckboxes = e.target.querySelectorAll('input[type="checkbox"][name="roles"]:checked');
        const roles = Array.from(roleCheckboxes).map(cb => cb.value);

        try {
          if (!currentEditingParticipantId) {
            alert('Ошибка: ID участника не найден');
            return;
          }

          await apiCall('/organizer-api/' + CONFERENCE_CODE + '/participants/' + encodeURIComponent(currentEditingParticipantId), {
            method: 'PUT',
            body: JSON.stringify({ firstName, lastName, roles, interests, offerings, lookingFor }),
          });
          
          alert('Данные участника успешно обновлены');
          hideEditParticipantModal();
          loadParticipants();
        } catch (err) {
          const errorMsg = err.message || 'Неизвестная ошибка';
          alert('Ошибка сохранения данных участника: ' + errorMsg);
        }
      }

      function hideEditParticipantModal() {
        const modal = document.getElementById('edit-participant-modal');
        const form = document.getElementById('participant-form');
        const modalTitle = modal ? modal.querySelector('.modal-header h2') : null;
        const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
        
        if (modal) modal.classList.remove('active');
        if (form) form.reset();
        if (modalTitle) modalTitle.textContent = 'Редактировать участника';
        if (submitBtn) submitBtn.textContent = 'Сохранить изменения';
        currentEditingParticipantId = null;
      }

      async function toggleParticipantStatus(participantId, isActive) {
        if (!participantId) {
          alert('Ошибка: ID участника не указан');
          return;
        }
        
        const action = isActive ? 'активировать' : 'деактивировать';
        if (!confirm('Вы уверены, что хотите ' + action + ' этого участника?')) {
          return;
        }
        
        try {
          await apiCall('/organizer-api/' + CONFERENCE_CODE + '/participants/' + encodeURIComponent(participantId), {
            method: 'PUT',
            body: JSON.stringify({ isActive }),
          });
          
          alert('Участник успешно ' + (isActive ? 'активирован' : 'деактивирован'));
          loadParticipants();
        } catch (err) {
          const errorMsg = err.message || 'Неизвестная ошибка';
          alert('Ошибка изменения статуса участника: ' + errorMsg);
        }
      }

      let currentEditingPollId = null;

      async function editPoll(pollId) {
        if (!pollId) {
          alert('Ошибка: ID опроса не указан');
          return;
        }
        
        try {
          // Load poll data
          const data = await apiCall('/organizer-api/' + CONFERENCE_CODE + '/polls');
          const poll = data.items.find(p => String(p.id) === String(pollId));
          
          if (!poll) {
            alert('Опрос не найден');
            return;
          }
          
          // Set current editing poll ID
          currentEditingPollId = pollId;
          
          // Fill form with poll data
          const form = document.getElementById('poll-form');
          const modal = document.getElementById('create-poll-modal');
          const modalTitle = modal ? modal.querySelector('.modal-header h2') : null;
          const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
          
          if (modalTitle) modalTitle.textContent = 'Редактировать опрос';
          if (submitBtn) submitBtn.textContent = 'Сохранить изменения';
          
          // Set question
          const questionInput = form.querySelector('input[name="question"]');
          if (questionInput) questionInput.value = poll.question || '';
          
          // Set options
          const optionInputs = [
            form.querySelector('input[name="option1"]'),
            form.querySelector('input[name="option2"]'),
            form.querySelector('input[name="option3"]'),
            form.querySelector('input[name="option4"]'),
          ];
          
          // Clear all options first
          optionInputs.forEach(input => {
            if (input) input.value = '';
          });
          
          // Fill existing options
          if (poll.options && Array.isArray(poll.options)) {
            poll.options.forEach((opt, index) => {
              if (optionInputs[index] && opt && opt.text) {
                optionInputs[index].value = opt.text;
              }
            });
          }
          
          // Show modal
          if (modal) modal.classList.add('active');
          
        } catch (err) {
          alert('Ошибка загрузки данных опроса: ' + err.message);
        }
      }

      async function deletePoll(pollId) {
        if (!pollId) {
          alert('Ошибка: ID опроса не указан');
          return;
        }
        
        if (!confirm('Вы уверены, что хотите удалить этот опрос? Это действие нельзя отменить.')) {
          return;
        }
        
        try {
          await apiCall('/organizer-api/' + CONFERENCE_CODE + '/polls/' + encodeURIComponent(pollId), {
            method: 'DELETE',
          });
          
          alert('Опрос успешно удалён');
          loadPolls();
        } catch (err) {
          const errorMsg = err.message || 'Неизвестная ошибка';
          alert('Ошибка удаления опроса: ' + errorMsg);
        }
      }
    </script>
  </head>
  <body>
    <div class="container">
      <header>
        <h1>🔧 Админ-панель управления</h1>
        <div style="font-size: 18px; color: #4a5568; margin-top: 4px;">${safeTitle}</div>
        <div class="conference-info">
          <span>🔑 Код: <strong>${safeCode}</strong></span>
          <span>📅 Статус: <strong>${conference.isEnded ? 'Завершена' : conference.isActive ? 'Активна' : 'Остановлена'}</strong>
            <span class="status-badge ${
              conference.isEnded ? 'status-ended' :
              conference.isActive ? 'status-active' : 'status-stopped'
            }">${conference.isEnded ? 'Завершена' : conference.isActive ? 'Активна' : 'Остановлена'}</span>
          </span>
        </div>
        <div style="margin-top: 16px;">
          <a href="/organizer-dashboard/${safeUrlCode}?key=${safeProvidedKey}&telegramId=${safeTelegramId}" class="btn">📊 Перейти к отчётам</a>
        </div>
      </header>

      <div class="section">
        <h2>🔧 Управление</h2>
        <div class="tabs">
          <button class="tab active" data-tab="conferences" onclick="showTab('conferences')">🏢 Конференции</button>
          <button class="tab" data-tab="participants" onclick="showTab('participants')">👥 Участники</button>
          <button class="tab" data-tab="polls" onclick="showTab('polls')">📊 Опросы</button>
          <button class="tab" data-tab="questions" onclick="showTab('questions')">❓ Вопросы</button>
          <button class="tab" data-tab="meetings" onclick="showTab('meetings')">🤝 Встречи</button>
          <button class="tab" data-tab="slides" onclick="showTab('slides')">🖼️ Слайды</button>
          <button class="tab" data-tab="tariff" onclick="showTab('tariff')">💳 Тариф</button>
        </div>

        <div id="tab-conferences" class="tab-content active">
          <div class="action-buttons">
            <button class="btn btn-success" onclick="showCreateConferenceModal()">➕ Создать конференцию</button>
            <button class="btn" onclick="loadConferences()">🔄 Обновить список</button>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Код</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody id="conferences-tbody">
              <tr><td colspan="4" style="text-align: center; padding: 20px;">Нажмите "Обновить список" для загрузки данных</td></tr>
            </tbody>
          </table>
        </div>

        <div id="tab-participants" class="tab-content">
          <div class="action-buttons">
            <button class="btn" onclick="loadParticipants()">🔄 Обновить список</button>
            <button class="btn" onclick="exportCSV('participants')">📥 Экспорт в CSV</button>
          </div>
          <div class="filter-row">
            <div class="filter-group">
              <label>Роль:</label>
              <select id="participant-role-filter">
                <option value="">Все роли</option>
                <option value="speaker">Спикер</option>
                <option value="investor">Инвестор</option>
                <option value="organizer">Организатор</option>
                <option value="participant">Участник</option>
              </select>
            </div>
            <div class="filter-group">
              <label>Активность:</label>
              <select id="participant-active-filter">
                <option value="all">Все</option>
                <option value="true">Активные</option>
                <option value="false">Неактивные</option>
              </select>
            </div>
            <div class="filter-group">
              <label>Онбординг:</label>
              <select id="participant-onboarding-filter">
                <option value="all">Все</option>
                <option value="true">Завершён</option>
                <option value="false">Не завершён</option>
              </select>
            </div>
            <div class="filter-group" style="flex: 2;">
              <label>Поиск:</label>
              <input type="text" id="participant-search-filter" placeholder="Имя, username, Telegram ID..." />
            </div>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Username</th>
                <th>Роли</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody id="participants-tbody">
              <tr><td colspan="5" style="text-align: center; padding: 20px;">Нажмите "Обновить список" для загрузки данных</td></tr>
            </tbody>
          </table>
        </div>

        <div id="tab-polls" class="tab-content">
          <div class="action-buttons">
            <button class="btn btn-success" onclick="showCreatePollModal()">➕ Создать опрос</button>
            <button class="btn" onclick="loadPolls()">🔄 Обновить список</button>
            <button class="btn" onclick="exportCSV('polls')">📥 Экспорт в CSV</button>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Вопрос</th>
                <th>Голосов</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody id="polls-tbody">
              <tr><td colspan="4" style="text-align: center; padding: 20px;">Нажмите "Обновить список" для загрузки данных</td></tr>
            </tbody>
          </table>
        </div>

        <div id="tab-questions" class="tab-content">
          <div class="action-buttons">
            <button class="btn" onclick="loadQuestions()">🔄 Обновить список</button>
            <button class="btn" onclick="exportCSV('questions')">📥 Экспорт в CSV</button>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Текст вопроса</th>
                <th>Автор</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody id="questions-tbody">
              <tr><td colspan="4" style="text-align: center; padding: 20px;">Нажмите "Обновить список" для загрузки данных</td></tr>
            </tbody>
          </table>
        </div>

        <div id="tab-meetings" class="tab-content">
          <div class="action-buttons">
            <button class="btn" onclick="loadMeetings()">🔄 Обновить список</button>
            <button class="btn" onclick="exportCSV('meetings')">📥 Экспорт в CSV</button>
          </div>
          <div class="filter-row">
            <div class="filter-group">
              <label>Статус:</label>
              <select id="meeting-status-filter">
                <option value="">Все статусы</option>
                <option value="pending">Ожидает подтверждения</option>
                <option value="accepted">Подтверждено</option>
                <option value="rejected">Отклонено</option>
                <option value="cancelled">Отменено</option>
                <option value="completed">Завершено</option>
              </select>
            </div>
            <div class="filter-group">
              <button class="btn" onclick="applyMeetingFilters()">🔍 Применить фильтры</button>
            </div>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Инициатор</th>
                <th>Участник</th>
                <th>Предложенное время</th>
                <th>Длительность</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody id="meetings-tbody">
              <tr><td colspan="6" style="text-align: center; padding: 20px;">Нажмите "Обновить список" для загрузки данных</td></tr>
            </tbody>
          </table>
        </div>

        <div id="tab-slides" class="tab-content">
          <form id="slide-form" onsubmit="saveSlide(event)">
            <div class="form-group">
              <label>URL слайда:</label>
              <input type="url" id="current-slide-url" placeholder="https://example.com/slide.jpg" />
            </div>
            <div class="form-group">
              <label>Заголовок слайда:</label>
              <input type="text" id="current-slide-title" placeholder="Описание слайда" />
            </div>
            <div class="action-buttons">
              <button type="submit" class="btn btn-success">💾 Сохранить слайд</button>
              <button type="button" class="btn btn-danger" onclick="clearCurrentSlide()">🗑️ Очистить</button>
              <button type="button" class="btn" onclick="loadSlides()">🔄 Загрузить текущий</button>
            </div>
          </form>
          <div style="margin-top: 20px; padding: 16px; background: #f7fafc; border-radius: 8px;">
            <p><strong>💡 Подсказка:</strong> После сохранения слайд автоматически появится на Second Screen для всех участников конференции.</p>
          </div>
        </div>

        <div id="tab-tariff" class="tab-content">
          <div class="action-buttons">
            <button class="btn" onclick="loadTariffInfo()">🔄 Обновить информацию</button>
          </div>
          
          <div id="tariff-current-info" style="padding: 20px; background: #f7fafc; border-radius: 8px; margin-bottom: 24px;">
            <h3>Текущий тарифный план</h3>
            <p>Загрузка...</p>
          </div>

          <div style="margin-bottom: 24px;">
            <h3>Доступные тарифные планы</h3>
            <div id="tariff-plans-list" style="display: grid; gap: 16px; margin-top: 16px;">
              <p>Загрузка...</p>
            </div>
          </div>

          <div style="margin-top: 24px; padding: 16px; background: #feebc8; border-radius: 8px;">
            <p><strong>⚠️ Важно:</strong> При смене тарифного плана лимиты применяются немедленно. Превышение новых лимитов может привести к ограничению функционала.</p>
          </div>
        </div>
      </div>

      <!-- Create Conference Modal -->
      <div id="create-conference-modal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h2>Создать конференцию</h2>
            <button class="close-btn" onclick="hideCreateConferenceModal()">&times;</button>
          </div>
          <form id="create-conference-form" onsubmit="createConferenceSubmit(event)">
            <div class="form-group">
              <label>Название конференции *:</label>
              <input type="text" name="title" required />
            </div>
            <div class="form-group">
              <label>Описание:</label>
              <textarea name="description" rows="3"></textarea>
            </div>
            <div class="form-group">
              <label>Тип доступа:</label>
              <select name="access">
                <option value="public">Публичная</option>
                <option value="private">Приватная</option>
              </select>
            </div>
            <div class="form-group">
              <label>Дата начала:</label>
              <input type="datetime-local" name="startsAt" />
            </div>
            <div class="form-group">
              <label>Дата окончания:</label>
              <input type="datetime-local" name="endsAt" />
            </div>
            <div class="action-buttons">
              <button type="submit" class="btn btn-success">Создать конференцию</button>
              <button type="button" class="btn btn-secondary" onclick="hideCreateConferenceModal()">Отмена</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Create Poll Modal -->
      <div id="create-poll-modal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h2>Создать опрос</h2>
            <button class="close-btn" onclick="hideCreatePollModal()">&times;</button>
          </div>
          <form id="poll-form" onsubmit="createPoll(event)">
            <div class="form-group">
              <label>Вопрос:</label>
              <input type="text" name="question" required />
            </div>
            <div class="form-group">
              <label>Вариант ответа 1:</label>
              <input type="text" name="option1" required />
            </div>
            <div class="form-group">
              <label>Вариант ответа 2:</label>
              <input type="text" name="option2" required />
            </div>
            <div class="form-group">
              <label>Вариант ответа 3 (необязательно):</label>
              <input type="text" name="option3" />
            </div>
            <div class="form-group">
              <label>Вариант ответа 4 (необязательно):</label>
              <input type="text" name="option4" />
            </div>
            <div class="action-buttons">
              <button type="submit" class="btn btn-success">Создать опрос</button>
              <button type="button" class="btn btn-secondary" onclick="hideCreatePollModal()">Отмена</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Edit Participant Modal -->
      <div id="edit-participant-modal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h2>Редактировать участника</h2>
            <button class="close-btn" onclick="hideEditParticipantModal()">&times;</button>
          </div>
          <form id="participant-form" onsubmit="saveParticipant(event)">
            <div class="form-group">
              <label>Имя:</label>
              <input type="text" name="firstName" />
            </div>
            <div class="form-group">
              <label>Фамилия:</label>
              <input type="text" name="lastName" />
            </div>
            <div class="form-group">
              <label>Роли:</label>
              <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px;">
                <label style="display: flex; align-items: center; gap: 6px;">
                  <input type="checkbox" name="roles" value="speaker" />
                  Спикер
                </label>
                <label style="display: flex; align-items: center; gap: 6px;">
                  <input type="checkbox" name="roles" value="investor" />
                  Инвестор
                </label>
                <label style="display: flex; align-items: center; gap: 6px;">
                  <input type="checkbox" name="roles" value="organizer" />
                  Организатор
                </label>
                <label style="display: flex; align-items: center; gap: 6px;">
                  <input type="checkbox" name="roles" value="participant" />
                  Участник
                </label>
              </div>
            </div>
            <div class="form-group">
              <label>Интересы (через запятую):</label>
              <textarea name="interests" rows="3" placeholder="например: AI, blockchain, startup"></textarea>
            </div>
            <div class="form-group">
              <label>Предложения (через запятую):</label>
              <textarea name="offerings" rows="3" placeholder="например: инвестиции, консультации"></textarea>
            </div>
            <div class="form-group">
              <label>Ищет (через запятую):</label>
              <textarea name="lookingFor" rows="3" placeholder="например: партнёры, инвесторы"></textarea>
            </div>
            <div class="action-buttons">
              <button type="submit" class="btn btn-success">Сохранить изменения</button>
              <button type="button" class="btn btn-secondary" onclick="hideEditParticipantModal()">Отмена</button>
            </div>
          </form>
        </div>
      </div>

      <div class="section" style="text-align: center; color: black; opacity: 0.9;">
        <p>Админ-панель управления конференцией</p>
      </div>
    </div>
  </body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Error rendering organizer admin panel:', err);
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
  organizerAdminPageRouter: router,
};
