import { supabase } from "@/integrations/supabase/client";

type NotificationType = 
  | 'balance_update'
  | 'bet_win'
  | 'bet_loss'
  | 'game_win'
  | 'game_loss'
  | 'bonus'
  | 'level_up'
  | 'achievement'
  | 'withdrawal_approved'
  | 'withdrawal_rejected'
  | 'giveaway_win'
  | 'freebet'
  | 'free_spins'
  | 'system'
  | 'admin'
  | 'match_result'
  | 'custom';

interface NotificationData {
  amount?: number;
  odds?: number;
  team?: string;
  team1?: string;
  team2?: string;
  score1?: number;
  score2?: number;
  winner?: string;
  game?: string;
  multiplier?: number;
  bonus_type?: string;
  level?: number;
  reward?: number;
  title?: string;
  method?: string;
  reason?: string;
  prize?: string;
  freebet_type?: 'games' | 'betting';
  spins?: number;
}

interface SendNotificationParams {
  userId?: string;
  telegramId?: number;
  publicId?: number;
  message: string;
  notificationType?: NotificationType;
  data?: NotificationData;
  sendToAll?: boolean;
  /**
   * Сохранять уведомление в БД (system_notifications).
   * По умолчанию true. Используйте false, если вы уже сохранили уведомление отдельно.
   */
  saveToDb?: boolean;
}

/**
 * Отправляет уведомление пользователю в Telegram и (опционально) сохраняет в БД
 */
export async function sendTelegramNotification({
  userId,
  telegramId,
  publicId,
  message,
  notificationType = 'custom',
  data,
  sendToAll = false,
  saveToDb = true,
}: SendNotificationParams): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await supabase.functions.invoke('telegram-notifications', {
      body: {
        user_id: userId,
        telegram_id: telegramId,
        public_id: publicId,
        message,
        notification_type: notificationType,
        data,
        send_to_all: sendToAll,
        save_to_db: saveToDb,
      },
    });

    if (response.error) {
      console.error('Notification error:', response.error);
      return { success: false, error: response.error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Failed to send notification:', error);
    return { success: false, error: error.message };
  }
}

// Удобные хелперы для разных типов уведомлений

export async function notifyBalanceUpdate(userId: string, amount: number, description: string) {
  return sendTelegramNotification({
    userId,
    message: description,
    notificationType: 'balance_update',
    data: { amount },
  });
}

export async function notifyBetWin(userId: string, amount: number, odds: number, team: string, description = '') {
  return sendTelegramNotification({
    userId,
    message: description || 'Поздравляем с выигрышем!',
    notificationType: 'bet_win',
    data: { amount, odds, team },
  });
}

export async function notifyBetLoss(userId: string, amount: number, team: string, description = '') {
  return sendTelegramNotification({
    userId,
    message: description || 'Удачи в следующий раз!',
    notificationType: 'bet_loss',
    data: { amount, team },
  });
}

export async function notifyGameWin(userId: string, amount: number, game: string, multiplier: number, description = '') {
  return sendTelegramNotification({
    userId,
    message: description || 'Отлично сыграно!',
    notificationType: 'game_win',
    data: { amount, game, multiplier },
  });
}

export async function notifyGameLoss(userId: string, amount: number, game: string, description = '') {
  return sendTelegramNotification({
    userId,
    message: description || 'Попробуйте ещё раз!',
    notificationType: 'game_loss',
    data: { amount, game },
  });
}

export async function notifyBonus(userId: string, amount: number, bonusType: string, description = '') {
  return sendTelegramNotification({
    userId,
    message: description || 'Бонус зачислен!',
    notificationType: 'bonus',
    data: { amount, bonus_type: bonusType },
  });
}

export async function notifyLevelUp(userId: string, level: number, reward: number, description = '') {
  return sendTelegramNotification({
    userId,
    message: description || 'Продолжайте в том же духе!',
    notificationType: 'level_up',
    data: { level, reward },
  });
}

export async function notifyAchievement(userId: string, title: string, reward: number, description = '') {
  return sendTelegramNotification({
    userId,
    message: description || 'Новое достижение разблокировано!',
    notificationType: 'achievement',
    data: { title, reward },
  });
}

export async function notifyWithdrawalApproved(userId: string, amount: number, method: string, description = '') {
  return sendTelegramNotification({
    userId,
    message: description || 'Средства отправлены!',
    notificationType: 'withdrawal_approved',
    data: { amount, method },
  });
}

export async function notifyWithdrawalRejected(userId: string, amount: number, reason: string, description = '') {
  return sendTelegramNotification({
    userId,
    message: description || 'Свяжитесь с поддержкой для уточнения деталей.',
    notificationType: 'withdrawal_rejected',
    data: { amount, reason },
  });
}

export async function notifyGiveawayWin(userId: string, prize: string, amount: number, description = '') {
  return sendTelegramNotification({
    userId,
    message: description || 'Вы выиграли в розыгрыше!',
    notificationType: 'giveaway_win',
    data: { prize, amount },
  });
}

export async function notifyFreebet(userId: string, amount: number, freebetType: 'games' | 'betting', description = '') {
  return sendTelegramNotification({
    userId,
    message: description || 'Используйте фрибет в игре!',
    notificationType: 'freebet',
    data: { amount, freebet_type: freebetType },
  });
}

export async function notifyFreeSpins(userId: string, spins: number, game: string, description = '') {
  return sendTelegramNotification({
    userId,
    message: description || 'Используйте фриспины!',
    notificationType: 'free_spins',
    data: { spins, game },
  });
}

export async function notifyMatchResult(
  userId: string, 
  team1: string, 
  team2: string, 
  score1: number, 
  score2: number, 
  winner: string,
  description = ''
) {
  return sendTelegramNotification({
    userId,
    message: description || 'Проверьте результаты ваших ставок!',
    notificationType: 'match_result',
    data: { team1, team2, score1, score2, winner },
  });
}

export async function notifySystem(userId: string, message: string) {
  return sendTelegramNotification({
    userId,
    message,
    notificationType: 'system',
  });
}

export async function notifyAdmin(userId: string, message: string) {
  return sendTelegramNotification({
    userId,
    message,
    notificationType: 'admin',
  });
}

export async function notifyAll(message: string, notificationType: NotificationType = 'admin') {
  return sendTelegramNotification({
    message,
    notificationType,
    sendToAll: true,
  });
}
