import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  telegram_id?: number;
  user_id?: string;
  public_id?: number;
  message: string;
  send_to_all?: boolean;
  /**
   * Сохранять уведомление в таблицу system_notifications.
   * По умолчанию true.
   */
  save_to_db?: boolean;
  notification_type?: NotificationType;
  data?: Record<string, any>;
}

type NotificationType = 
  | 'balance_update'      // Пополнение/списание баланса
  | 'bet_win'             // Выигрыш ставки
  | 'bet_loss'            // Проигрыш ставки
  | 'game_win'            // Выигрыш в игре
  | 'game_loss'           // Проигрыш в игре
  | 'bonus'               // Бонус (промокод, награда)
  | 'level_up'            // Повышение уровня
  | 'achievement'         // Достижение
  | 'withdrawal_approved' // Вывод одобрен
  | 'withdrawal_rejected' // Вывод отклонен
  | 'giveaway_win'        // Выигрыш в розыгрыше
  | 'freebet'             // Фрибет получен
  | 'free_spins'          // Фриспины получены
  | 'system'              // Системное уведомление
  | 'admin'               // От администрации
  | 'match_result'        // Результат матча
  | 'custom';             // Кастомное

// Красивые шаблоны сообщений
function formatNotification(type: NotificationType, message: string, data?: Record<string, any>): string {
  const templates: Record<NotificationType, () => string> = {
    balance_update: () => {
      const amount = data?.amount || 0;
      const isPositive = amount >= 0;
      return `💰 <b>Баланс обновлён</b>\n\n${isPositive ? '➕' : '➖'} <b>${isPositive ? '+' : ''}${amount} ₽</b>\n\n${message}`;
    },
    bet_win: () => {
      const amount = data?.amount || 0;
      const odds = data?.odds || 0;
      const team = data?.team || '';
      return `🎉 <b>СТАВКА ВЫИГРАЛА!</b>\n\n🏆 ${team}\n📊 Коэф: <b>${odds}</b>\n💵 Выигрыш: <b>+${amount} ₽</b>\n\n${message}`;
    },
    bet_loss: () => {
      const amount = data?.amount || 0;
      const team = data?.team || '';
      return `😔 <b>Ставка проиграла</b>\n\n❌ ${team}\n💸 Сумма: <b>-${amount} ₽</b>\n\n${message}`;
    },
    game_win: () => {
      const amount = data?.amount || 0;
      const game = data?.game || 'Игра';
      const multiplier = data?.multiplier || 1;
      return `🎰 <b>ПОБЕДА в ${game}!</b>\n\n💎 Множитель: <b>x${multiplier}</b>\n💰 Выигрыш: <b>+${amount} ₽</b>\n\n${message}`;
    },
    game_loss: () => {
      const amount = data?.amount || 0;
      const game = data?.game || 'Игра';
      return `😢 <b>Проигрыш в ${game}</b>\n\n💸 Сумма: <b>-${amount} ₽</b>\n\n${message}`;
    },
    bonus: () => {
      const amount = data?.amount || 0;
      const bonusType = data?.bonus_type || 'бонус';
      return `🎁 <b>БОНУС ПОЛУЧЕН!</b>\n\n✨ ${bonusType}\n💰 Сумма: <b>+${amount} ₽</b>\n\n${message}`;
    },
    level_up: () => {
      const level = data?.level || 1;
      const reward = data?.reward || 0;
      return `⬆️ <b>НОВЫЙ УРОВЕНЬ!</b>\n\n🏅 Уровень: <b>${level}</b>\n🎁 Награда: <b>+${reward} ₽</b>\n\n${message}`;
    },
    achievement: () => {
      const title = data?.title || 'Достижение';
      const reward = data?.reward || 0;
      return `🏆 <b>ДОСТИЖЕНИЕ РАЗБЛОКИРОВАНО!</b>\n\n🎖️ <b>${title}</b>\n🎁 Награда: <b>+${reward} ₽</b>\n\n${message}`;
    },
    withdrawal_approved: () => {
      const amount = data?.amount || 0;
      const method = data?.method || '';
      return `✅ <b>ВЫВОД ОДОБРЕН!</b>\n\n💳 Способ: ${method}\n💰 Сумма: <b>${amount} ₽</b>\n\n${message}`;
    },
    withdrawal_rejected: () => {
      const amount = data?.amount || 0;
      const reason = data?.reason || 'Причина не указана';
      return `❌ <b>Вывод отклонён</b>\n\n💰 Сумма: <b>${amount} ₽</b>\n📝 Причина: ${reason}\n\n${message}`;
    },
    giveaway_win: () => {
      const prize = data?.prize || 'Приз';
      const amount = data?.amount || 0;
      return `🎊 <b>ПОЗДРАВЛЯЕМ!</b>\n\n🥳 Вы выиграли в розыгрыше!\n🎁 Приз: <b>${prize}</b>\n💰 Сумма: <b>+${amount} ₽</b>\n\n${message}`;
    },
    freebet: () => {
      const amount = data?.amount || 0;
      const type = data?.freebet_type || 'games';
      const typeLabel = type === 'betting' ? 'ставки' : 'игры';
      return `🎫 <b>ФРИБЕТ ПОЛУЧЕН!</b>\n\n💎 Сумма: <b>${amount} ₽</b>\n🎯 Для: ${typeLabel}\n\n${message}`;
    },
    free_spins: () => {
      const spins = data?.spins || 0;
      const game = data?.game || 'слоты';
      return `🎰 <b>ФРИСПИНЫ ПОЛУЧЕНЫ!</b>\n\n🔄 Количество: <b>${spins} вращений</b>\n🎮 Игра: ${game}\n\n${message}`;
    },
    system: () => {
      return `⚙️ <b>Системное уведомление</b>\n\n${message}`;
    },
    admin: () => {
      return `👑 <b>Сообщение от администрации</b>\n\n${message}`;
    },
    match_result: () => {
      const team1 = data?.team1 || 'Команда 1';
      const team2 = data?.team2 || 'Команда 2';
      const score1 = data?.score1 ?? '-';
      const score2 = data?.score2 ?? '-';
      const winner = data?.winner || '';
      return `⚽ <b>МАТЧ ЗАВЕРШЁН</b>\n\n${team1} <b>${score1}</b> : <b>${score2}</b> ${team2}\n\n🏆 Победитель: <b>${winner}</b>\n\n${message}`;
    },
    custom: () => message,
  };

  return templates[type]?.() || message;
}

// Отправка сообщения в Telegram
async function sendTelegramMessage(telegramId: number, text: string): Promise<boolean> {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  
  if (!botToken) {
    console.error("TELEGRAM_BOT_TOKEN not configured");
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text: text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const result = await response.json();
    
    if (!result.ok) {
      console.error("Telegram API error:", result);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
    return false;
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // GET - получить непрочитанные уведомления
    if (req.method === "GET") {
      const url = new URL(req.url);
      const telegramId = url.searchParams.get("telegram_id");
      const userId = url.searchParams.get("user_id");
      const publicId = url.searchParams.get("public_id");

      let profileId: string | null = null;

      if (telegramId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("telegram_id", parseInt(telegramId))
          .single();
        profileId = profile?.id || null;
      } else if (userId) {
        profileId = userId;
      } else if (publicId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("public_id", parseInt(publicId))
          .single();
        profileId = profile?.id || null;
      }

      if (!profileId) {
        return new Response(
          JSON.stringify({ notifications: [], message: "User not found or no identifier provided" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: notifications, error: notifError } = await supabase
        .from("system_notifications")
        .select("id, message, created_at")
        .eq("user_id", profileId)
        .eq("is_read", false)
        .order("created_at", { ascending: false });

      if (notifError) {
        console.error("Error fetching notifications:", notifError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch notifications" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ notifications: notifications || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST - отправить уведомление
    if (req.method === "POST") {
      const body: NotificationRequest = await req.json();

      if (!body.message) {
        return new Response(
          JSON.stringify({ error: "message is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const notificationType = body.notification_type || 'custom';
      const formattedMessage = formatNotification(notificationType, body.message, body.data);
      const saveToDb = body.save_to_db ?? true;

      // Отправка всем пользователям
      if (body.send_to_all) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, telegram_id, public_id");

        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
          return new Response(
            JSON.stringify({ error: "Failed to fetch profiles" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Сохраняем в БД (опционально)
        if (saveToDb) {
          const notifications = profiles?.map((p) => ({
            user_id: p.id,
            message: body.message,
            is_read: false,
          })) || [];

          if (notifications.length > 0) {
            await supabase.from("system_notifications").insert(notifications);
          }
        }

        // Отправляем в Telegram всем
        let sentCount = 0;
        let failedCount = 0;

        for (const profile of profiles || []) {
          if (profile.telegram_id) {
            const sent = await sendTelegramMessage(profile.telegram_id, formattedMessage);
            if (sent) sentCount++;
            else failedCount++;

            // Небольшая задержка чтобы не превысить лимиты Telegram API
            await new Promise((r) => setTimeout(r, 50));
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            total: profiles?.length || 0,
            telegram_sent: sentCount,
            telegram_failed: failedCount,
            message: body.message,
            saved_to_db: saveToDb,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Отправка конкретному пользователю
      let userId = body.user_id;
      let telegramId = body.telegram_id;

      // Поиск по public_id
      if (body.public_id && !userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, telegram_id")
          .eq("public_id", body.public_id)
          .single();

        if (!profile) {
          return new Response(
            JSON.stringify({ error: "User not found by public_id" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        userId = profile.id;
        telegramId = profile.telegram_id;
      }

      // Поиск по telegram_id
      if (telegramId && !userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("telegram_id", telegramId)
          .single();

        if (!profile) {
          return new Response(
            JSON.stringify({ error: "User not found by telegram_id" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        userId = profile.id;
      }

      // Если передан user_id, найти telegram_id
      if (userId && !telegramId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("telegram_id")
          .eq("id", userId)
          .single();

        if (profile) {
          telegramId = profile.telegram_id;
        }
      }

      if (!userId) {
        return new Response(
          JSON.stringify({ error: "user_id, telegram_id, or public_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Сохраняем в БД (опционально)
      if (saveToDb) {
        await supabase.from("system_notifications").insert({
          user_id: userId,
          message: body.message,
          is_read: false,
        });
      }

      // Отправляем в Telegram
      let telegramSent = false;
      if (telegramId) {
        telegramSent = await sendTelegramMessage(telegramId, formattedMessage);
      }

      return new Response(
        JSON.stringify({
          success: true,
          telegram_id: telegramId,
          user_id: userId,
          telegram_sent: telegramSent,
          message: body.message,
          saved_to_db: saveToDb,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PATCH - пометить уведомления как прочитанные
    if (req.method === "PATCH") {
      const url = new URL(req.url);
      const telegramId = url.searchParams.get("telegram_id");
      const userId = url.searchParams.get("user_id");
      const publicId = url.searchParams.get("public_id");
      const notificationId = url.searchParams.get("notification_id");

      let profileId: string | null = null;

      if (telegramId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("telegram_id", parseInt(telegramId))
          .single();
        profileId = profile?.id || null;
      } else if (userId) {
        profileId = userId;
      } else if (publicId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("public_id", parseInt(publicId))
          .single();
        profileId = profile?.id || null;
      }

      if (!profileId) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let query = supabase
        .from("system_notifications")
        .update({ is_read: true })
        .eq("user_id", profileId);

      if (notificationId) {
        query = query.eq("id", notificationId);
      }

      const { error: updateError } = await query;

      if (updateError) {
        console.error("Error updating notifications:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update notifications" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

Deno.serve(handler);
