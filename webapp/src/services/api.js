/**
 * TWA Backend API Client
 * Base URL: http://localhost:4000/api (or your deployed URL)
 * 
 * Set VITE_API_URL in your .env to override the base URL in production.
 */

const BASE_URL = 'https://social-connection-prja.onrender.com/api';

class ApiClient {
  constructor() {
    this.telegramId = '';
    this.initData = '';
  }

  /** Call once after Telegram.WebApp is ready */
  init() {
    const tg = window.Telegram?.WebApp;
    this.initData = tg?.initData || '';
    this.telegramId = String(tg?.initDataUnsafe?.user?.id || '');
  }

  async _request(method, path, body) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': this.initData,
      'X-Telegram-Id': this.telegramId, // Dev bypass
    };

    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  authenticate(initData) {
    return this._request('POST', '/auth', { initData });
  }

  // ── Conferences ────────────────────────────────────────────────────────────
  getConferences() {
    return this._request('GET', '/conferences');
  }

  joinConference(conferenceCode) {
    return this._request('POST', '/conferences/join', { conferenceCode });
  }

  // ── Participants ───────────────────────────────────────────────────────────
  getParticipants(conferenceCode) {
    return this._request('GET', `/participants?conferenceCode=${conferenceCode}`);
  }

  // ── Profile ────────────────────────────────────────────────────────────────
  getProfile() {
    return this._request('GET', '/profile');
  }

  updateProfile(profileData) {
    return this._request('POST', '/profile', profileData);
  }

  // ── Polls ─────────────────────────────────────────────────────────────────
  getPolls(conferenceCode) {
    return this._request('GET', `/polls?conferenceCode=${conferenceCode}`);
  }

  votePoll(pollId, optionId) {
    return this._request('POST', `/polls/${pollId}/vote`, { optionId });
  }

  // ── Questions ─────────────────────────────────────────────────────────────
  getQuestions(conferenceCode) {
    return this._request('GET', `/questions?conferenceCode=${conferenceCode}`);
  }

  askQuestion(conferenceCode, text) {
    return this._request('POST', '/questions', { conferenceCode, text });
  }

  upvoteQuestion(questionId) {
    return this._request('POST', `/questions/${questionId}/upvote`);
  }

  // ── Chat ──────────────────────────────────────────────────────────────────
  getChatList(conferenceCode) {
    const qs = conferenceCode ? `?conferenceCode=${conferenceCode}` : '';
    return this._request('GET', `/chat/list${qs}`);
  }

  getChatMessages(withTelegramId, conferenceCode) {
    return this._request('GET', `/chat/messages?withTelegramId=${withTelegramId}&conferenceCode=${conferenceCode}`);
  }

  sendMessage(toTelegramId, conferenceCode, text) {
    return this._request('POST', '/chat/message', { toTelegramId, conferenceCode, text });
  }

  // ── Chat Requests ─────────────────────────────────────────────────────────
  getChatRequests() {
    return this._request('GET', '/chat-requests');
  }

  sendChatRequest(toTelegramId, conferenceCode, message) {
    return this._request('POST', '/chat-requests/send', { toTelegramId, conferenceCode, message });
  }

  acceptChatRequest(requestId) {
    return this._request('POST', `/chat-requests/${requestId}/accept`);
  }

  rejectChatRequest(requestId) {
    return this._request('POST', `/chat-requests/${requestId}/reject`);
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  getNotifications() {
    return this._request('GET', '/notifications');
  }

  markNotificationRead(notificationId) {
    return this._request('POST', `/notifications/${notificationId}/read`);
  }

  markAllNotificationsRead() {
    return this._request('POST', '/notifications/read-all');
  }

  // ── Payment ───────────────────────────────────────────────────────────────
  initiatePayment(conferenceCode) {
    return this._request('POST', '/payment/initiate', { conferenceCode });
  }

  getPaymentStatus() {
    return this._request('GET', '/payment/status');
  }
}

export const api = new ApiClient();
