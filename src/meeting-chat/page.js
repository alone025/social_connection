const express = require('express');
const { validateChatToken, getChatMessages } = require('../services/meetingChat.service');

const router = express.Router();

// GET /meeting-chat/:meetingId?token=TOKEN
router.get('/meeting-chat/:meetingId', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const token = req.query.token;

    if (!token) {
      return res.status(401).send('Token is required');
    }

    const { meeting } = await validateChatToken({ token });

    // Verify meeting ID matches
    if (meeting._id.toString() !== meetingId) {
      return res.status(403).send('Meeting ID mismatch');
    }

    // Load initial messages
    const messages = await getChatMessages({ token, limit: 50 });

    const requesterName = `${meeting.requester.firstName || ''} ${meeting.requester.lastName || ''}`.trim();
    const recipientName = `${meeting.recipient.firstName || ''} ${meeting.recipient.lastName || ''}`.trim();

    const html = `
<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <title>Чат встречи</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #050816;
        color: #e5e7eb;
        display: flex;
        flex-direction: column;
        height: 100vh;
        overflow: hidden;
      }
      header {
        padding: 16px 24px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.3);
        background: rgba(15, 23, 42, 0.95);
      }
      header h1 {
        margin: 0;
        font-size: 18px;
      }
      header .participants {
        font-size: 14px;
        color: #9ca3af;
        margin-top: 4px;
      }
      .messages-container {
        flex: 1;
        overflow-y: auto;
        padding: 16px 24px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .message {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 12px 16px;
        background: rgba(15, 23, 42, 0.6);
        border-radius: 12px;
        border: 1px solid rgba(148, 163, 184, 0.2);
      }
      .message-header {
        display: flex;
        gap: 8px;
        align-items: center;
        font-size: 12px;
        color: #9ca3af;
      }
      .message-sender {
        font-weight: 600;
        color: #60a5fa;
      }
      .message-time {
        color: #6b7280;
      }
      .message-text {
        color: #e5e7eb;
        line-height: 1.5;
      }
      .input-container {
        padding: 16px 24px;
        border-top: 1px solid rgba(148, 163, 184, 0.3);
        background: rgba(15, 23, 42, 0.95);
        display: flex;
        gap: 12px;
      }
      .input-container input {
        flex: 1;
        padding: 12px 16px;
        background: rgba(30, 41, 59, 0.8);
        border: 1px solid rgba(148, 163, 184, 0.3);
        border-radius: 12px;
        color: #e5e7eb;
        font-size: 14px;
        outline: none;
      }
      .input-container input:focus {
        border-color: #60a5fa;
      }
      .input-container button {
        padding: 12px 24px;
        background: #3b82f6;
        border: none;
        border-radius: 12px;
        color: white;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
      }
      .input-container button:hover {
        background: #2563eb;
      }
      .input-container button:disabled {
        background: #475569;
        cursor: not-allowed;
      }
      .status {
        padding: 8px 16px;
        text-align: center;
        font-size: 12px;
        color: #9ca3af;
        background: rgba(15, 23, 42, 0.6);
      }
    </style>
  </head>
  <body>
    <header>
      <h1>💬 Чат встречи</h1>
      <div class="participants">${requesterName} ↔ ${recipientName}</div>
    </header>
    <div class="status" id="status">Подключение...</div>
    <div class="messages-container" id="messages"></div>
    <div class="input-container">
      <input type="text" id="messageInput" placeholder="Введите сообщение..." maxlength="1000" />
      <button id="sendButton">Отправить</button>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
      const token = '${token}';
      const meetingId = '${meetingId}';
      
      // Get telegramId from URL parameter (will be passed when opening chat from bot)
      const urlParams = new URLSearchParams(window.location.search);
      const telegramId = urlParams.get('telegramId');
      
      const socket = io('/meeting-chat', {
        auth: { token },
        transports: ['websocket', 'polling']
      });

      const messagesContainer = document.getElementById('messages');
      const messageInput = document.getElementById('messageInput');
      const sendButton = document.getElementById('sendButton');
      const status = document.getElementById('status');

      let isConnected = false;

      socket.on('connect', () => {
        isConnected = true;
        status.textContent = 'Подключено';
        status.style.color = '#10b981';
        sendButton.disabled = false;
      });

      socket.on('disconnect', () => {
        isConnected = false;
        status.textContent = 'Отключено';
        status.style.color = '#ef4444';
        sendButton.disabled = true;
      });

      socket.on('error', (error) => {
        status.textContent = 'Ошибка: ' + error;
        status.style.color = '#ef4444';
      });

      socket.on('new-message', (data) => {
        addMessage(data);
      });

      function addMessage(data) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        const time = new Date(data.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        messageDiv.innerHTML = \`
          <div class="message-header">
            <span class="message-sender">\${data.sender.firstName} \${data.sender.lastName || ''}</span>
            <span class="message-time">\${time}</span>
          </div>
          <div class="message-text">\${escapeHtml(data.text)}</div>
        \`;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }

      function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }

      function sendMessage() {
        const text = messageInput.value.trim();
        if (!text || !isConnected) return;
        
        if (!telegramId) {
          alert('Ошибка: Telegram ID не найден. Пожалуйста, откройте чат через бота.');
          return;
        }

        sendButton.disabled = true;
        socket.emit('send-message', { text, telegramId }, (response) => {
          sendButton.disabled = false;
          if (response.error) {
            alert('Ошибка: ' + response.error);
          } else {
            messageInput.value = '';
          }
        });
      }

      sendButton.addEventListener('click', sendMessage);
      messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          sendMessage();
        }
      });

      // Load initial messages
      const initialMessages = ${JSON.stringify(messages)};
      initialMessages.forEach(msg => {
        addMessage({
          id: msg._id,
          text: msg.text,
          sender: msg.sender,
          createdAt: msg.createdAt,
        });
      });
    </script>
  </body>
</html>
    `;

    res.send(html);
  } catch (err) {
    console.error('Error in meeting-chat page', err);
    if (err.message === 'INVALID_TOKEN' || err.message === 'TOKEN_EXPIRED') {
      return res.status(401).send('Invalid or expired token');
    }
    res.status(500).send('Internal server error');
  }
});

module.exports = {
  meetingChatPageRouter: router,
};
