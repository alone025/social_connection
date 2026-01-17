const express = require('express');
const { Conference } = require('../models/conference');

const router = express.Router();

// GET /second-screen/:code?key=SECOND_SCREEN_API_KEY
router.get('/second-screen/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const providedKey = req.query.key;
    const configuredKey = process.env.SECOND_SCREEN_API_KEY;
 
    if (!configuredKey) {
      return res.status(500).send('Second screen API key is not configured on server.');
    }

    if (!providedKey || providedKey !== configuredKey) {
      return res.status(401).send('Invalid or missing second screen key.');
    }

    // Get conference for display, but use conferenceId internally
    const conference = await Conference.findOne({ conferenceCode: code });
    if (!conference) {
      return res.status(404).send('Conference not found.');
    }
    
    // Check if second screen feature is enabled
    const { isFeatureEnabled } = require('../services/limit.service');
    const conferenceId = conference._id;
    const secondScreenEnabled = await isFeatureEnabled('secondScreenEnabled', conferenceId);
    
    if (!secondScreenEnabled) {
      return res.status(403).send('Second Screen feature is not available for this conference. Please upgrade your plan to enable this feature.');
    }

    const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Second Screen – ${conference.title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #050816;
        color: #e5e7eb;
        display: flex;
        flex-direction: column;
        height: 100vh;
      }
      header {
        padding: 16px 24px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.3);
        display: flex;
        justify-content: space-between;
        align-items: baseline;
      }
      header h1 {
        font-size: 20px;
        margin: 0;
      }
      header .meta {
        font-size: 12px;
        color: #9ca3af;
      }
      main {
        flex: 1;
        display: grid;
        grid-template-columns: 3fr 2fr;
        gap: 16px;
        padding: 16px 24px 24px;
        box-sizing: border-box;
      }
      @media (max-width: 900px) {
        main {
          grid-template-columns: 1fr;
        }
      }
      .card {
        background: radial-gradient(circle at top left, rgba(56, 189, 248, 0.15), transparent),
                    radial-gradient(circle at bottom right, rgba(129, 140, 248, 0.2), transparent),
                    rgba(15, 23, 42, 0.95);
        border-radius: 16px;
        padding: 16px 18px;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.65);
        border: 1px solid rgba(148, 163, 184, 0.35);
        backdrop-filter: blur(18px);
      }
      .card h2 {
        margin: 0 0 8px;
        font-size: 16px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .card h2 span.badge {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(59, 130, 246, 0.12);
        border: 1px solid rgba(59, 130, 246, 0.5);
        color: #93c5fd;
      }
      .card .subtitle {
        font-size: 12px;
        color: #9ca3af;
        margin-bottom: 8px;
      }
      .questions-list {
        margin: 0;
        padding: 0;
        list-style: none;
        max-height: calc(100vh - 220px);
        overflow-y: auto;
        scrollbar-width: thin;
      }
      .question-item {
        padding: 10px 12px;
        border-radius: 10px;
        margin-bottom: 8px;
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid rgba(55, 65, 81, 0.8);
        font-size: 14px;
        line-height: 1.4;
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }
      .question-item .text {
        white-space: pre-wrap;
        word-break: break-word;
      }
      .question-item .meta {
        text-align: right;
        font-size: 11px;
        color: #9ca3af;
        min-width: 80px;
      }
      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(34, 197, 94, 0.12);
        border: 1px solid rgba(34, 197, 94, 0.4);
        color: #bbf7d0;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .status-pill span.dot {
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #22c55e;
      }
      .agenda {
        font-size: 13px;
        color: #e5e7eb;
      }
      .agenda p {
        margin: 4px 0;
      }
      .agenda strong {
        color: #a5b4fc;
      }
      .slide-wrapper {
        margin-top: 10px;
        border-radius: 12px;
        border: 1px solid rgba(148, 163, 184, 0.45);
        overflow: hidden;
        background: radial-gradient(circle at top left, rgba(56, 189, 248, 0.16), transparent),
                    radial-gradient(circle at bottom right, rgba(147, 197, 253, 0.2), transparent),
                    rgba(15, 23, 42, 0.96);
      }
      .slide-header {
        padding: 6px 10px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #9ca3af;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(55, 65, 81, 0.85);
      }
      .slide-header span.dot {
        display: inline-block;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #22c55e;
        box-shadow: 0 0 0 5px rgba(34, 197, 94, 0.25);
        margin-right: 6px;
      }
      .slide-body {
        position: relative;
        padding: 8px 10px 10px;
        min-height: 120px;
      }
      .slide-body.empty {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: #6b7280;
      }
      .slide-title {
        font-size: 13px;
        margin-bottom: 6px;
        color: #e5e7eb;
      }
      .slide-frame {
        width: 100%;
        height: 220px;
        border-radius: 10px;
        border: 1px solid rgba(30, 64, 175, 0.7);
        overflow: hidden;
        background: #020617;
      }
      .slide-frame iframe,
      .slide-frame img {
        width: 100%;
        height: 100%;
        border: none;
        display: block;
        object-fit: contain;
        background: #020617;
      }
      footer {
        padding: 6px 16px 10px;
        font-size: 11px;
        color: #6b7280;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      footer span.dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-right: 6px;
      }
      footer .online span.dot {
        background: #22c55e;
        box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.25);
      }
      footer .offline span.dot {
        background: #ef4444;
        box-shadow: 0 0 0 6px rgba(248, 113, 113, 0.18);
      }
    </style>
  </head>
  <body>
    <header>
      <div>
        <h1>${conference.title}</h1>
        <div class="meta">
          Код конференции: <strong>${conference.conferenceCode}</strong>
        </div>
      </div>
      <div class="meta" id="nowLabel"></div>
    </header>
    <main>
      <section class="card">
        <h2>
          Вопросы участников
          <span class="badge">SECOND SCREEN</span>
        </h2>
        <div class="subtitle">
          Показываются только одобренные модераторами вопросы. Обновляется в реальном времени.
        </div>
        <ul id="questionsList" class="questions-list"></ul>
      </section>
      <section class="card">
        <h2>Инфо по конференции</h2>
        <div class="agenda" id="agendaBlock">
          <p><strong>Старт:</strong> ${
            conference.startsAt ? conference.startsAt.toISOString() : '—'
          }</p>
          <p><strong>Окончание:</strong> ${
            conference.endsAt ? conference.endsAt.toISOString() : '—'
          }</p>
          <p id="timeLeft"></p>
          <div class="slide-wrapper" id="slideWrapper">
            <div class="slide-header">
              <div><span class="dot"></span>Текущий слайд</div>
             
            </div>
            <div class="slide-body empty" id="slideBody">
              <span>Сейчас слайд не выбран. Администратор может задать его командой /set_slide.</span>
            </div>
          </div>
        </div>
      </section>
    </main>
    <footer>
      <div id="socketStatus" class="online">
        <span class="dot"></span><span>Подключение к залу...</span>
      </div>
      <div style="font-size: 11px;">Conference Networking Bot · Second Screen</div>
    </footer>

    <script>
      window.SECOND_SCREEN_CONFIG = {
        code: ${JSON.stringify(conference.conferenceCode)},
        apiKey: ${JSON.stringify(configuredKey)},
        socketUrl: window.location.origin
      };
    </script>
    <script src="/socket.io/socket.io.js"></script>
    <script>
      (function () {
        const cfg = window.SECOND_SCREEN_CONFIG;
        const questionsList = document.getElementById('questionsList');
        const socketStatus = document.getElementById('socketStatus');
        const nowLabel = document.getElementById('nowLabel');
        const timeLeftEl = document.getElementById('timeLeft');
        const slideBody = document.getElementById('slideBody');

        function setSocketStatus(online) {
          socketStatus.className = online ? 'online' : 'offline';
          socketStatus.innerHTML = online
            ? '<span class="dot"></span><span>Подключено к залу</span>'
            : '<span class="dot"></span><span>Отключено</span>';
        }

        function renderQuestions(items) {
          questionsList.innerHTML = '';
          items.forEach((q) => {
            const li = document.createElement('li');
            li.className = 'question-item';
            const id = q._id || q.id;
            li.dataset.id = id;
            if (q.createdAt) {
              li.dataset.createdAt = new Date(q.createdAt).getTime();
            }
            li.innerHTML =
              '<div class="text"></div>' +
              '<div class="meta">' +
              '<div class="status-pill"><span class="dot"></span><span>Approved</span></div>' +
              (q.createdAt
                ? '<div>' + new Date(q.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '</div>'
                : '') +
              '</div>';
            li.querySelector('.text').textContent = q.text || '';
            questionsList.appendChild(li);
          });
        }

        function upsertQuestion(q) {
          const id = q._id || q.id;
          if (!id) {
            console.warn('upsertQuestion: missing id', q);
            return;
          }
          
          let existing = questionsList.querySelector('[data-id="' + id + '"]');
          
          // If question is not approved, remove it from the list
          if (q.status !== 'approved') {
            if (existing) {
              existing.remove();
            }
            return;
          }
          
          // If question is approved, add or update it
          if (!existing) {
            existing = document.createElement('li');
            existing.className = 'question-item';
            existing.dataset.id = id;
            // Insert in chronological order (oldest first)
            const allQuestions = Array.from(questionsList.children);
            const createdAt = q.createdAt ? new Date(q.createdAt).getTime() : Date.now();
            let inserted = false;
            for (let i = 0; i < allQuestions.length; i++) {
              const itemCreatedAt = allQuestions[i].dataset.createdAt ? parseInt(allQuestions[i].dataset.createdAt) : 0;
              if (createdAt < itemCreatedAt) {
                questionsList.insertBefore(existing, allQuestions[i]);
                inserted = true;
                break;
              }
            }
            if (!inserted) {
              questionsList.appendChild(existing);
            }
          }
          
          // Store createdAt for sorting
          if (q.createdAt) {
            existing.dataset.createdAt = new Date(q.createdAt).getTime();
          }
          
          // Update question content
          existing.innerHTML =
            '<div class="text"></div>' +
            '<div class="meta">' +
            '<div class="status-pill"><span class="dot"></span><span>Approved</span></div>' +
            (q.createdAt
              ? '<div>' + new Date(q.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '</div>'
              : '') +
            '</div>';
          existing.querySelector('.text').textContent = q.text || '';
        }

        function updateSlideView(slide) {
          const url = slide && slide.url;
          const title = slide && slide.title;

          if (!url) {
            slideBody.className = 'slide-body empty';
            slideBody.innerHTML =
              '<span>Сейчас слайд не выбран. Администратор может задать его.</span>';
            
            return;
          }

          slideBody.className = 'slide-body';
          const safeTitle = title && title.trim() ? title.trim() : 'Слайд конференции';
          slideBody.innerHTML =
            '<div class="slide-title"></div>' +
            '<div class="slide-frame"><div class="inner"></div></div>';
          slideBody.querySelector('.slide-title').textContent = safeTitle;

          const inner = slideBody.querySelector('.slide-frame .inner');
          const lower = url.toLowerCase();
          if (lower.match(/\\.(png|jpg|jpeg|gif|webp)$/)) {
            const img = document.createElement('img');
            img.src = url;
            inner.appendChild(img);
          } else {
            const iframe = document.createElement('iframe');
            iframe.src = url;
            iframe.referrerPolicy = 'no-referrer';
            iframe.loading = 'lazy';
            inner.appendChild(iframe);
          }

        }

        // Conference time data
        const conferenceStart = ${conference.startsAt ? `new Date('${conference.startsAt.toISOString()}')` : 'null'};
        const conferenceEnd = ${conference.endsAt ? `new Date('${conference.endsAt.toISOString()}')` : 'null'};

        function formatTimeRemaining(ms) {
          if (ms <= 0) return '0:00:00';
          const totalSeconds = Math.floor(ms / 1000);
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;
          return hours + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
        }

        function formatElapsedTime(ms) {
          const totalSeconds = Math.floor(ms / 1000);
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;
          if (hours > 0) {
            return hours + 'ч ' + minutes + 'м ' + seconds + 'с';
          } else if (minutes > 0) {
            return minutes + 'м ' + seconds + 'с';
          } else {
            return seconds + 'с';
          }
        }

        function tickClock() {
          const now = new Date();
          
          // Update current time with date
          const dateStr = now.toLocaleDateString('ru-RU', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
          });
          const timeStr = now.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          });
          nowLabel.textContent = dateStr + ' ' + timeStr;

          // Update time left/elapsed
          if (timeLeftEl) {
            let timeText = '';
            
            if (conferenceStart && conferenceEnd) {
              const nowTime = now.getTime();
              const startTime = conferenceStart.getTime();
              const endTime = conferenceEnd.getTime();
              
              if (nowTime < startTime) {
                // Conference hasn't started yet
                const remaining = startTime - nowTime;
                timeText = '<strong>До начала:</strong> ' + formatTimeRemaining(remaining);
              } else if (nowTime >= startTime && nowTime < endTime) {
                // Conference is in progress
                const elapsed = nowTime - startTime;
                const remaining = endTime - nowTime;
                timeText = '<strong>Прошло:</strong> ' + formatElapsedTime(elapsed) + ' · <strong>Осталось:</strong> ' + formatTimeRemaining(remaining);
              } else {
                // Conference has ended
                const elapsed = endTime - startTime;
                timeText = '<strong>Конференция завершена</strong> (длительность: ' + formatElapsedTime(elapsed) + ')';
              }
            } else if (conferenceStart) {
              const nowTime = now.getTime();
              const startTime = conferenceStart.getTime();
              
              if (nowTime < startTime) {
                const remaining = startTime - nowTime;
                timeText = '<strong>До начала:</strong> ' + formatTimeRemaining(remaining);
              } else {
                const elapsed = nowTime - startTime;
                timeText = '<strong>Прошло с начала:</strong> ' + formatElapsedTime(elapsed);
              }
            } else if (conferenceEnd) {
              const nowTime = now.getTime();
              const endTime = conferenceEnd.getTime();
              
              if (nowTime < endTime) {
                const remaining = endTime - nowTime;
                timeText = '<strong>До окончания:</strong> ' + formatTimeRemaining(remaining);
              } else {
                timeText = '<strong>Конференция завершена</strong>';
              }
            } else {
              timeText = '<strong>Время не установлено</strong>';
            }
            
            timeLeftEl.innerHTML = timeText;
          }
        }
        
        setInterval(tickClock, 1000);
        tickClock();

        // Initial fetch of approved questions
        fetch('/conference/' + encodeURIComponent(cfg.code) + '/questions', {
          headers: {
            'X-SECOND-SCREEN-KEY': cfg.apiKey
          }
        })
          .then((r) => r.json())
          .then((data) => {
            if (data && Array.isArray(data.items)) {
              renderQuestions(data.items);
            }
          })
          .catch((err) => {
            console.error('Failed to load questions', err);
          });

        // Initial fetch of slide / stats
        fetch('/conference/' + encodeURIComponent(cfg.code) + '/stats', {
          headers: {
            'X-SECOND-SCREEN-KEY': cfg.apiKey
          }
        })
          .then((r) => r.json())
          .then((data) => {
            if (data && data.conference) {
              updateSlideView({
                url: data.conference.currentSlideUrl,
                title: data.conference.currentSlideTitle,
              });
            }
          })
          .catch((err) => {
            console.error('Failed to load stats', err);
          });

        // Socket.IO connection
        const socket = io(cfg.socketUrl, {
          auth: { secondScreenKey: cfg.apiKey }
        });

        socket.on('connect', () => {
          setSocketStatus(true);
          socket.emit('join-conference', { code: cfg.code });
        });

        socket.on('disconnect', () => setSocketStatus(false));
        socket.on('connect_error', () => setSocketStatus(false));

        socket.on('question-created', (payload) => {
          // New questions are pending by default, so we don't show them until approved
          // The question-updated event will handle approved questions
          if (payload && payload.status === 'approved') {
            upsertQuestion(payload);
          }
        });

        socket.on('question-updated', (payload) => {
          console.log('Question updated via socket:', payload);
          upsertQuestion(payload);
        });

        socket.on('slide-updated', (payload) => {
          console.log('Slide updated via socket:', payload);
          updateSlideView(payload);
        });
      })();
    </script>
  </body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (err) {
    console.error('Error in GET /second-screen/:code', err);
    return res.status(500).send('Internal server error.');
  }
});

module.exports = {
  secondScreenPageRouter: router,
};


