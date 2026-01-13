const { OnboardingState } = require('../models/onboardingState');
const { UserProfile } = require('../models/userProfile');

/**
 * Get onboarding state for a user (returns null if not found)
 */
async function getOnboardingState(telegramId) {
  return await OnboardingState.findOne({ telegramId });
}

/**
 * Create new onboarding state for a user
 */
async function createOnboardingState(telegramId) {
  const state = new OnboardingState({
    telegramId: String(telegramId),
    step: 1,
    data: {},
  });
  await state.save();
  return state;
}

/**
 * Update onboarding state
 */
async function updateOnboardingState(telegramId, updates) {
  const state = await OnboardingState.findOne({ telegramId });
  
  if (!state) {
    throw new Error('ONBOARDING_STATE_NOT_FOUND');
  }
  
  if (updates.step !== undefined) {
    state.step = updates.step;
  }
  
  if (updates.data !== undefined) {
    state.data = { ...state.data, ...updates.data };
  }
  
  if (updates.completedAt !== undefined) {
    state.completedAt = updates.completedAt;
  }
  
  await state.save();
  return state;
}

/**
 * Clear onboarding state (after completion or cancellation)
 */
async function clearOnboardingState(telegramId) {
  await OnboardingState.deleteOne({ telegramId });
}

/**
 * Get onboarding statistics for analytics
 */
async function getOnboardingStatistics({ conferenceId = null } = {}) {
  // Get all onboarding states
  let allStates = await OnboardingState.find({});
  
  // Get all profiles (optionally filtered by conference)
  const profileQuery = { isActive: true };
  if (conferenceId) {
    profileQuery.conference = conferenceId;
  }
  
  const allProfiles = await UserProfile.find(profileQuery);
  
  // If filtering by conference, only count states for users who have profiles in that conference
  if (conferenceId) {
    const profileTelegramIds = new Set(allProfiles.map(p => p.telegramId));
    allStates = allStates.filter(s => profileTelegramIds.has(s.telegramId));
  }
  
  // Calculate statistics
  const totalStarted = allStates.length;
  const totalCompleted = allProfiles.filter(p => p.onboardingCompleted).length;
  const activeOnboarding = allStates.filter(s => !s.completedAt).length;
  
  // Calculate completion rate (based on profiles, not states)
  // This is more accurate as it counts actual profile completions
  const totalParticipants = allProfiles.length;
  const completionRate = totalParticipants > 0 
    ? (totalCompleted / totalParticipants) * 100 
    : 0;
  
  // Step distribution
  const stepDistribution = {};
  for (let step = 1; step <= 7; step++) {
    stepDistribution[step] = allStates.filter(s => s.step === step && !s.completedAt).length;
  }
  
  // Average time to complete (for completed states)
  const completedStates = allStates.filter(s => s.completedAt);
  let avgCompletionTime = 0;
  if (completedStates.length > 0) {
    const totalTime = completedStates.reduce((sum, s) => {
      const timeDiff = s.completedAt.getTime() - s.startedAt.getTime();
      return sum + timeDiff;
    }, 0);
    avgCompletionTime = totalTime / completedStates.length / 1000 / 60; // Convert to minutes
  }
  
  // Abandonment rate (started but not completed, older than 24 hours)
  const abandoned = allStates.filter(s => !s.completedAt && s.startedAt < new Date(Date.now() - 24 * 60 * 60 * 1000)).length;
  const abandonmentRate = totalStarted > 0 
    ? (abandoned / totalStarted) * 100 
    : 0;
  
  return {
    totalStarted,
    totalCompleted,
    totalParticipants,
    activeOnboarding,
    completionRate: Math.round(completionRate * 10) / 10,
    abandonmentRate: Math.round(abandonmentRate * 10) / 10,
    avgCompletionTimeMinutes: Math.round(avgCompletionTime * 10) / 10,
    stepDistribution,
    conferenceId,
  };
}

/**
 * Format onboarding statistics as text for display
 */
function formatOnboardingStatistics(stats) {
  const lines = [
    '📊 Статистика онбординга',
    stats.conferenceId ? '(для конкретной конференции)' : '(общая по системе)',
    '',
    `Всего участников: ${stats.totalParticipants || stats.totalStarted}`,
    `Начали онбординг: ${stats.totalStarted}`,
    `Завершили: ${stats.totalCompleted}`,
    `Активных сессий: ${stats.activeOnboarding}`,
    `📈 Процент завершения: ${stats.completionRate}%`,
    `⚠️ Процент отказов: ${stats.abandonmentRate}%`,
    `⏱️ Среднее время завершения: ${stats.avgCompletionTimeMinutes} минут`,
    '',
    'Распределение по шагам (активные):',
  ];
  
  for (let step = 1; step <= 7; step++) {
    const count = stats.stepDistribution[step] || 0;
    if (count > 0) {
      lines.push(`  Шаг ${step}: ${count} пользователей`);
    }
  }
  
  if (stats.completionRate >= 80) {
    lines.push('', '✅ Цель достигнута: ≥80% завершения онбординга!');
  } else {
    lines.push('', `📊 Текущий показатель: ${stats.completionRate}% (цель: ≥80%)`);
  }
  
  return lines.join('\n');
}

module.exports = {
  getOnboardingState,
  createOnboardingState,
  updateOnboardingState,
  clearOnboardingState,
  getOnboardingStatistics,
  formatOnboardingStatistics,
};
