import React, { useState, useEffect, useCallback } from 'react';
import ProfileForm from './components/ProfileForm';
import PaymentModal from './components/PaymentModal';
import MemberProfileModal from './components/MemberProfileModal';

// Layout Components
import Header from './components/layout/Header';
import MainNavigationBar from './components/layout/MainNavigationBar';
import ConferenceNavigationBar from './components/layout/ConferenceNavigationBar';
import NotificationsDrawer from './components/layout/NotificationsDrawer';
import DebugConsole from './components/DebugConsole';

// Main Views
import HomeView from './views/HomeView';
import MessagingView from './views/MessagingView';
import PublicConferencesView from './views/PublicConferencesView';
import ProfileView from './views/ProfileView';
import NetworkingView from './views/NetworkingView';
import CreateConferenceView from './views/CreateConferenceView';

// Conference Views
import ConferenceHomeView from './views/ConferenceHomeView';
import ConferenceMembersView from './views/ConferenceMembersView';
import ConferenceAskView from './views/ConferenceAskView';
import ConferencePollsView from './views/ConferencePollsView';
import ConferenceQuestionsListView from './views/ConferenceQuestionsListView';
import ConferenceChatListView from './views/ConferenceChatListView';
import ConferenceChatDetailView from './views/ConferenceChatDetailView';

import { api } from './services/api';
import { RU as t } from './constants/locales';
import './App.css';

const App = () => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [conferences, setConferences] = useState([]);
  const [activeTab, setActiveTab] = useState('conferences');
  const [loading, setLoading] = useState(true);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [accessPhase, setAccessPhase] = useState('free');
  const [activeConference, setActiveConference] = useState(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isChatRequestOpen, setIsChatRequestOpen] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [isInChat, setIsInChat] = useState(false);
  const [selectedConfChat, setSelectedConfChat] = useState(null);
  const [initialDirectChat, setInitialDirectChat] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [requestStatuses, setRequestStatuses] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // ── Conference-scoped state ─────────────────────────────────────────────
  const [participants, setParticipants] = useState([]);
  const [polls, setPolls] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [chatList, setChatList] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [globalUsers, setGlobalUsers] = useState([]);

  // ── SVG Icons ─────────────────────────────────────────────────────────────
  const Icons = {
    Home: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    Message: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    Networking: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    Conference: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><path d="M9 22v-4h6v4M8 4v.01M16 4v.01M8 8v.01M16 8v.01M8 12v.01M16 12v.01M8 16v.01M16 16v.01"/></svg>,
    Profile: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    Notification: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>,
    Close: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
    Plus: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  };

  // ── Auth & Fetchers ────────────────────────────────────────────────────────
  const authenticate = useCallback(async (initData) => {
    try {
      const data = await api.authenticate(initData);
      if (data.user) {
        setUser(data.user);
        setProfile(data.profile);
        setConferences(data.conferences || []);
        if (data.conferences?.[0]) setAccessPhase(data.conferences[0].accessPhase);
      }
    } catch (err) {
      console.error('Auth error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConferences = useCallback(async () => {
    try {
      const data = await api.getConferences();
      setConferences(data.conferences || []);
    } catch (err) {
      console.error('Fetch conferences error:', err);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error('Fetch notifications error:', err);
    }
  }, []);

  const fetchGlobalUsers = useCallback(async (query = '') => {
    try {
      const data = await api.searchUsers(query);
      setGlobalUsers(data.users || []);
    } catch (err) {
      console.error('Fetch global users error:', err);
    }
  }, []);

  const loadConferenceData = useCallback(async (code) => {
    if (!code) return;
    try {
      const [partData, pollData, qData, chatData] = await Promise.allSettled([
        api.getParticipants(code),
        api.getPolls(code),
        api.getQuestions(code),
        api.getChatList(code),
      ]);
      if (partData.status === 'fulfilled') setParticipants(partData.value.participants || []);
      if (pollData.status === 'fulfilled') setPolls(pollData.value.polls || []);
      if (qData.status === 'fulfilled') setQuestions(qData.value.questions || []);
      if (chatData.status === 'fulfilled') setChatList(chatData.value.chats || []);
    } catch (err) {
      console.error('Load conference data error:', err);
    }
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleUpdateProfile = async (data) => {
    try {
      const result = await api.updateProfile({ ...data, onboardingCompleted: true });
      setProfile(result.profile || { ...data, onboardingCompleted: true });
    } catch (err) {
      console.error('Profile update error:', err);
      setProfile({ ...data, onboardingCompleted: true });
    }
  };

  const handleCreateConference = async (data) => {
    try {
      const result = await api.createConference(data);
      if (result.success) {
        await fetchConferences();
        setActiveTab('conferences');
      }
    } catch (err) {
      console.error('Create conference error:', err);
      throw err;
    }
  };

  const handleVote = async (pollId, optionId) => {
    try {
      const result = await api.votePoll(pollId, optionId);
      setPolls(prev => prev.map(p =>
        p.id === pollId ? { ...p, options: result.options, totalVotes: result.totalVotes } : p
      ));
    } catch (err) {
      console.error('Vote error:', err);
    }
  };

  const handleAskQuestion = async (text) => {
    if (!activeConference?.code) return;
    try {
      await api.askQuestion(activeConference.code, text);
      const data = await api.getQuestions(activeConference.code);
      setQuestions(data.questions || []);
    } catch (err) {
      console.error('Ask question error:', err);
    }
  };

  const handleUpvoteQuestion = async (questionId) => {
    try {
      await api.upvoteQuestion(questionId);
      if (activeConference?.code) {
        const data = await api.getQuestions(activeConference.code);
        setQuestions(data.questions || []);
      }
    } catch (err) {
      console.error('Upvote error:', err);
    }
  };

  const handleSelectChat = async (chat) => {
    setSelectedConfChat(chat);
    if (chat?.other?.id && activeConference?.code) {
      try {
        const data = await api.getChatMessages(chat.other.id, activeConference.code);
        setChatMessages(data.messages || []);
      } catch (err) {
        console.error('Fetch messages error:', err);
      }
    }
  };

  const handleSendMessage = async (userId, text) => {
    const targetUserId = userId || selectedConfChat?.other?.id;
    if (!targetUserId || !activeConference?.code) return;
    try {
      await api.sendMessage(targetUserId, activeConference.code, text);
      const data = await api.getChatMessages(targetUserId, activeConference.code);
      setChatMessages(data.messages || []);
    } catch (err) {
      console.error('Send message error:', err);
    }
  };

  const handleSendChatRequest = async (member) => {
    if (!activeConference?.code) return;
    setRequestStatuses(prev => ({ ...prev, [member.id]: 'pending' }));
    try {
      await api.sendChatRequest(member.userId || member.telegramId || member.id, activeConference.code);
      setRequestStatuses(prev => ({ ...prev, [member.id]: 'pending' }));
    } catch (err) {
      if (err.message?.includes('already exists')) {
        console.info('Request already sent');
      } else {
        console.error('Send request error:', err);
      }
    }
  };

  const handleAcceptChatRequest = async (requestId) => {
    try {
      await api.acceptChatRequest(requestId);
      fetchNotifications();
      setIsChatRequestOpen(false);
    } catch (err) {
      console.error('Accept error:', err);
    }
  };

  const handleRejectChatRequest = async (requestId) => {
    try {
      await api.rejectChatRequest(requestId);
      setIsChatRequestOpen(false);
    } catch (err) {
      console.error('Reject error:', err);
    }
  };

  // ── Conference Navigation ─────────────────────────────────────────────────
  const joinConference = async (conf) => {
    if (typeof conf === 'string') {
      try {
        const data = await api.joinConference(conf);
        conf = data.conference;
      } catch (err) {
        console.error('Join error:', err);
        conf = { id: Date.now(), name: `Conference ${conf}`, code: conf };
      }
    }
    setActiveConference(conf);
    setAccessPhase(conf.accessPhase || 'free');
    setActiveTab('conf_home');
    loadConferenceData(conf.code);
  };

  const leaveConference = () => {
    setActiveConference(null);
    setActiveTab('conferences');
    setParticipants([]);
    setPolls([]);
    setQuestions([]);
    setChatList([]);
  };

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      if (tg.colorScheme === 'dark') document.body.classList.add('dark');
      api.init();
      const initData = tg.initData;
      if (initData) {
        authenticate(initData);
      } else {
        setUser({ id: '12345', firstName: 'Dablo', lastName: 'User' });
        setProfile({
          firstName: 'Dablo', lastName: 'User', username: 'dablo_dev',
          interests: ['AI', 'React'], bio: 'Frontend Developer.',
          telegram: 'dablo_dev', whatsapp: '+79001234567',
          about: 'Разрабатываю крутые интерфейсы', lookingFor: 'Интересные проекты',
          company: 'Freelance', position: 'Senior Developer',
          country: 'Россия', region: 'Московская область',
          city: 'Москва', email: 'mail@mail.ru', phone: '+7 (999) 000-00-00',
          onboardingCompleted: true,
        });
        fetchConferences();
        setLoading(false);
      }
    }
  }, [authenticate, fetchConferences]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user, fetchNotifications]);

  useEffect(() => {
    if (activeTab === 'networking' && !activeConference) {
      fetchGlobalUsers();
    }
  }, [activeTab, activeConference, fetchGlobalUsers]);

  const handleInitiatePayment = async () => {
    try {
      const data = await api.initiatePayment(activeConference?.code);
      if (data.paymentUrl) {
        window.open(data.paymentUrl, '_blank');
      }
    } catch (err) {
      console.error('Payment error:', err);
    }
    setIsPaymentOpen(false);
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="loader">{t.common.loading}</div>
      </div>
    );
  }

  return (
    <>
      <div className="animate-fade-in" style={{ paddingBottom: 'var(--nav-height)' }}>
        <Header
          user={user}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenNotifications={() => { setIsNotificationsOpen(true); fetchNotifications(); }}
          unreadCount={unreadCount}
        />

        <div className="container">
          {/* ── Main Navigation Views ── */}
          {['home', 'networking', 'messaging', 'conferences', 'profile', 'create_conference'].includes(activeTab) && (
            <>
              {activeTab === 'home' && (
                <HomeView
                  user={user}
                  accessPhase={accessPhase}
                  conferences={conferences}
                  polls={polls}
                  onJoin={() => setActiveTab('conferences')}
                  onPolls={() => setActiveTab('conferences')}
                />
              )}
              {activeTab === 'networking' && (
                <NetworkingView
                  onBack={() => setActiveTab('home')}
                  accessPhase={accessPhase}
                  onOpenPayment={() => setIsPaymentOpen(true)}
                  onViewProfile={(m) => { setSelectedMember(m); setIsMemberModalOpen(true); }}
                  participants={activeConference ? participants : globalUsers}
                  onSearch={(q) => activeConference ? null : fetchGlobalUsers(q)}
                />
              )}
              {activeTab === 'messaging' && (
                <MessagingView
                  onBack={() => setActiveTab('home')}
                  currentConference={activeConference}
                  onChatStateChange={(state) => { setIsInChat(state); if (!state) setInitialDirectChat(null); }}
                  initialSelectedChat={initialDirectChat}
                  onViewProfile={(m) => { setSelectedMember(m); setIsMemberModalOpen(true); }}
                  chats={chatList}
                  messages={chatMessages}
                  onSelectChat={handleSelectChat}
                  onSendMessage={handleSendMessage}
                />
              )}
              {activeTab === 'conferences' && (
                <PublicConferencesView
                  onBack={() => setActiveTab('home')}
                  onJoinConference={joinConference}
                  onCreateNew={() => setActiveTab('create_conference')}
                  conferences={conferences}
                />
              )}
              {activeTab === 'create_conference' && (
                <CreateConferenceView
                  onBack={() => setActiveTab('conferences')}
                  onCreate={handleCreateConference}
                />
              )}
              {activeTab === 'profile' && profile?.onboardingCompleted && (
                <ProfileView
                  profile={profile}
                  onEdit={() => setProfile({ ...profile, onboardingCompleted: false })}
                />
              )}
              {activeTab === 'profile' && !profile?.onboardingCompleted && !profile?.isIncomplete && (
                <ProfileForm
                  profile={profile}
                  onSave={handleUpdateProfile}
                  onCancel={() => setActiveTab('home')}
                />
              )}
            </>
          )}

          {/* ── QR Scanner ── */}
          {isScannerOpen && (
            <div className="animate-fade-in" style={{ position: 'fixed', minHeight: '100vh', inset: 0, background: '#111111', zIndex: 3000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', padding: '0' }}>
              <div style={{ position: 'absolute', top: '24px', right: '24px' }}>
                <button className="btn-outline" style={{ background: 'white', border: 'none', width: '44px', height: '44px', borderRadius: '14px' }} onClick={() => setIsScannerOpen(false)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" style={{minWidth:"24px"}} fill="none" stroke="black" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <div style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '220px', height: '220px', border: '2px solid white', borderRadius: '40px', position: 'relative', marginBottom: '32px' }}>
                  <div style={{ position: 'absolute', inset: '10px', border: '2px dashed rgba(255,255,255,0.3)', borderRadius: '32px' }} />
                  <div className="scanner-line" style={{ position: 'absolute', top: '20%', left: '10%', right: '10%', height: '2px', background: 'var(--accent-blue)', boxShadow: '0 0 15px var(--accent-blue)', animation: 'scan 2s infinite ease-in-out' }} />
                </div>

                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>QR Сканер</h2>
                  <p style={{ color: '#a0aec0', fontSize: '14px' }}>Отсканируйте код для мгновенного входа</p>
                </div>

                <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '32px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', textAlign: 'center' }}>или введите код вручную</div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      className="form-input"
                      placeholder="Код конференции"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.1)', color: 'white', flex: 1, height: '54px' }}
                    />
                    <button
                      className="btn-solid"
                      style={{ background: 'white', color: 'black', width: 'auto', padding: '0 24px', height: '54px' }}
                      onClick={() => {
                        if (manualCode.trim()) {
                          joinConference(manualCode.trim().toUpperCase());
                          setIsScannerOpen(false);
                          setManualCode('');
                        }
                      }}
                    >
                      Вход
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Conference Context Views ── */}
          {activeConference && ['conf_home', 'conf_members', 'conf_ask', 'conf_polls', 'conf_questions', 'conf_chats', 'conf_chat_detail'].includes(activeTab) && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <button className="btn-outline" style={{ width: '36px', height: '36px', padding: 0, borderRadius: '14px', border: 'none', background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} onClick={leaveConference}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                </button>
                <div style={{ background: '#111111', padding: '10px 18px', borderRadius: '16px', fontSize: '12px', fontWeight: 800, color: 'white', letterSpacing: '0.4px' }}>
                  {(activeConference?.name || activeConference?.title || 'КОНФЕРЕНЦИЯ').toUpperCase()}
                </div>
              </div>

              {activeTab === 'conf_home' && (
                <ConferenceHomeView
                  conference={activeConference}
                  members={participants}
                  polls={polls}
                  questions={questions}
                  onSeeAllQuestions={() => setActiveTab('conf_questions')}
                  onSeeAllPolls={() => setActiveTab('conf_polls')}
                  onViewProfile={(m) => { setSelectedMember(m); setIsMemberModalOpen(true); }}
                />
              )}
              {activeTab === 'conf_members' && (
                <ConferenceMembersView
                  members={participants}
                  requestStatus={requestStatuses}
                  onOpenChat={(member) => {
                    setSelectedConfChat({ other: { id: member.userId, name: member.displayName, avatarUrl: member.avatarUrl } });
                    setActiveTab('conf_chat_detail');
                  }}
                  onViewProfile={(member) => { setSelectedMember(member); setIsMemberModalOpen(true); }}
                  onSendRequest={handleSendChatRequest}
                />
              )}
              {activeTab === 'conf_ask' && (
                <ConferenceAskView
                  questions={questions.filter(q => q.isMyQuestion)}
                  onSeeAll={() => setActiveTab('conf_questions')}
                  onSubmitQuestion={handleAskQuestion}
                />
              )}
              {activeTab === 'conf_polls' && (
                <ConferencePollsView polls={polls} onVote={handleVote} />
              )}
              {activeTab === 'conf_questions' && (
                <ConferenceQuestionsListView
                  questions={questions}
                  onBack={() => setActiveTab('conf_ask')}
                  onUpvote={handleUpvoteQuestion}
                />
              )}
              {activeTab === 'conf_chats' && (
                <ConferenceChatListView
                  chats={chatList}
                  onSelectChat={(chat) => {
                    handleSelectChat(chat);
                    setActiveTab('conf_chat_detail');
                  }}
                  onViewProfile={(m) => { setSelectedMember(m); setIsMemberModalOpen(true); }}
                />
              )}
              {activeTab === 'conf_chat_detail' && (
                <ConferenceChatDetailView
                  chat={selectedConfChat}
                  messages={chatMessages}
                  onBack={() => setActiveTab('conf_chats')}
                  onSendMessage={handleSendMessage}
                />
              )}
            </>
          )}

          {/* ── Incomplete profile confirmation ── */}
          {activeTab === 'profile' && profile?.isIncomplete && (
            <div className="card-soft animate-fade-in" style={{ textAlign: 'center', padding: '40px 24px', borderRadius: '32px' }}>
              <div style={{ width: '90px', height: '90px', borderRadius: '45px', background: '#111111', margin: '0 auto 28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', color: 'white', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                {profile?.firstName?.[0] || 'U'}
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '12px' }}>{t.onboarding.confirm_title}</h2>
              <p style={{ marginBottom: '32px', color: '#a0aec0', fontWeight: 500 }}>{t.onboarding.confirm_desc}</p>

              <div className="card-soft" style={{ textAlign: 'left', marginBottom: '32px', background: '#f8fafc', padding: '20px', border: 'none' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#a0aec0', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Имя Фамилия</div>
                <div style={{ fontWeight: 700, color: 'var(--primary-text)', fontSize: '17px' }}>{profile.firstName} {profile.lastName}</div>
                {profile.username && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#a0aec0', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Username</div>
                    <div style={{ fontWeight: 700, color: 'var(--primary-text)', fontSize: '17px' }}>@{profile.username}</div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button className="btn-solid" onClick={() => handleUpdateProfile({ ...profile, isIncomplete: false, onboardingCompleted: true })}>
                  {t.onboarding.accept_btn}
                </button>
                <button className="btn-outline" onClick={() => setProfile({ ...profile, isIncomplete: false })}>
                  {t.onboarding.edit_btn}
                </button>
              </div>
            </div>
          )}
        </div>

        <PaymentModal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          onPay={handleInitiatePayment}
        />

        {isNotificationsOpen && (
          <NotificationsDrawer
            onClose={() => setIsNotificationsOpen(false)}
            notifications={notifications}
            onOpenRequest={(req) => {
              setPendingRequest(req);
              setIsChatRequestOpen(true);
              setIsNotificationsOpen(false);
              api.markNotificationRead(req.notificationId).catch(() => {});
            }}
            onMarkAllRead={() => {
              api.markAllNotificationsRead().then(fetchNotifications);
            }}
            Icon={() => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>}
          />
        )}

        <MemberProfileModal
          isOpen={isMemberModalOpen}
          member={selectedMember}
          requestStatus={requestStatuses}
          onClose={() => setIsMemberModalOpen(false)}
          onSendRequest={handleSendChatRequest}
          onOpenChat={(m) => {
            setIsMemberModalOpen(false);
            if (activeConference) {
              setSelectedConfChat({ other: { id: m.userId || m.telegramId, name: m.displayName || m.name, avatarUrl: m.avatarUrl } });
              setActiveTab('conf_chat_detail');
            } else {
              setInitialDirectChat(m);
              setActiveTab('messaging');
            }
          }}
        />

        {isChatRequestOpen && pendingRequest && (
          <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div className="card-soft" style={{ width: '100%', maxWidth: '340px', padding: '32px', textAlign: 'center', position: 'relative' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '40px', background: 'var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', margin: '0 auto 24px', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }}>
                👤
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px' }}>Новый запрос</h2>
              <p style={{ color: '#718096', fontSize: '14px', marginBottom: '28px', lineHeight: 1.5 }}>
                <b>{pendingRequest.from?.name || pendingRequest.sender}</b> хочет начать с вами чат в конференции <b>{pendingRequest.conference?.name || pendingRequest.conference}</b>.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button className="btn-solid" onClick={() => handleAcceptChatRequest(pendingRequest.id)}>
                  Принять
                </button>
                <button className="btn-outline" style={{ border: 'none' }} onClick={() => handleRejectChatRequest(pendingRequest.id)}>
                  Отклонить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {
        !isNotificationsOpen && !isScannerOpen && !isInChat && !isMemberModalOpen && !isPaymentOpen && !isChatRequestOpen && (
          <>
            {(!activeConference) ? (
              <MainNavigationBar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onOpenScanner={() => setIsScannerOpen(true)}
              />
            ) : (
              <ConferenceNavigationBar activeTab={activeTab} setActiveTab={setActiveTab} />
            )}
          </>
        )
      }
      <DebugConsole />
    </>
  );
};

export default App;
