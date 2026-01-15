import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    text?: string;
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    message?: {
      message_id: number;
      chat: {
        id: number;
      };
    };
    data?: string;
  };
}

// Отправка сообщения
async function sendMessage(chatId: number, text: string, replyMarkup?: any): Promise<boolean> {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!botToken) return false;

  try {
    const body: any = {
      chat_id: chatId,
      text: text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    };

    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    return result.ok;
  } catch (error) {
    console.error("Send message error:", error);
    return false;
  }
}

// Ответ на callback query
async function answerCallbackQuery(callbackQueryId: string, text?: string, showAlert = false): Promise<boolean> {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!botToken) return false;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text,
        show_alert: showAlert,
      }),
    });
    return true;
  } catch {
    return false;
  }
}

// Главное меню
function getMainMenu() {
  return {
    keyboard: [
      [{ text: "💰 Баланс" }, { text: "🎮 Играть" }],
      [{ text: "🔔 Уведомления" }, { text: "📊 Статистика" }],
      [{ text: "🎁 Бонусы" }, { text: "👤 Профиль" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

// Inline кнопки для игры
function getPlayButtons() {
  return {
    inline_keyboard: [
      [{ text: "🎰 Открыть казино", url: "https://t.me/casinocasino123_bot/casino" }],
    ],
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const update: TelegramUpdate = await req.json();

    // Обработка сообщений
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      const userId = update.message.from.id;

      // Получаем профиль пользователя
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, username, balance, demo_balance, freebet_balance, level, xp, total_wins, total_losses")
        .eq("telegram_id", userId)
        .single();

      // Команда /start
      if (text === "/start" || text.startsWith("/start ")) {
        if (!profile) {
          await sendMessage(chatId, 
            `👋 <b>Добро пожаловать!</b>\n\n` +
            `🎰 Чтобы начать играть, откройте наше казино и зарегистрируйтесь.\n\n` +
            `Нажмите кнопку ниже:`,
            getPlayButtons()
          );
        } else {
          await sendMessage(chatId,
            `👋 <b>С возвращением, ${profile.username}!</b>\n\n` +
            `💰 Баланс: <b>${profile.balance.toFixed(2)} ₽</b>\n` +
            `🎫 Фрибет: <b>${(profile.freebet_balance || 0).toFixed(2)} ₽</b>\n` +
            `🏅 Уровень: <b>${profile.level}</b>\n\n` +
            `Выберите действие:`,
            getMainMenu()
          );
        }
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // Команда "Баланс"
      if (text === "💰 Баланс" || text === "/balance") {
        if (!profile) {
          await sendMessage(chatId, "❌ Профиль не найден. Зарегистрируйтесь в казино.", getPlayButtons());
        } else {
          await sendMessage(chatId,
            `💰 <b>Ваш баланс</b>\n\n` +
            `💵 Основной: <b>${profile.balance.toFixed(2)} ₽</b>\n` +
            `🎮 Демо: <b>${profile.demo_balance.toFixed(2)} ₽</b>\n` +
            `🎫 Фрибет: <b>${(profile.freebet_balance || 0).toFixed(2)} ₽</b>`
          );
        }
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // Команда "Играть"
      if (text === "🎮 Играть" || text === "/play") {
        await sendMessage(chatId,
          `🎰 <b>Время играть!</b>\n\n` +
          `Нажмите кнопку, чтобы открыть казино:`,
          getPlayButtons()
        );
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // Команда "Уведомления"
      if (text === "🔔 Уведомления" || text === "/notifications") {
        if (!profile) {
          await sendMessage(chatId, "❌ Профиль не найден.", getPlayButtons());
        } else {
          const { data: notifications } = await supabase
            .from("system_notifications")
            .select("id, message, created_at")
            .eq("user_id", profile.id)
            .eq("is_read", false)
            .order("created_at", { ascending: false })
            .limit(5);

          if (!notifications || notifications.length === 0) {
            await sendMessage(chatId, "🔔 У вас нет непрочитанных уведомлений.");
          } else {
            let msg = `🔔 <b>Непрочитанные уведомления (${notifications.length}):</b>\n\n`;
            notifications.forEach((n, i) => {
              const date = new Date(n.created_at).toLocaleString("ru-RU");
              msg += `${i + 1}. ${n.message}\n<i>${date}</i>\n\n`;
            });
            await sendMessage(chatId, msg);
          }
        }
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // Команда "Статистика"
      if (text === "📊 Статистика" || text === "/stats") {
        if (!profile) {
          await sendMessage(chatId, "❌ Профиль не найден.", getPlayButtons());
        } else {
          const wins = profile.total_wins || 0;
          const losses = profile.total_losses || 0;
          const total = wins + losses;
          const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : 0;

          await sendMessage(chatId,
            `📊 <b>Ваша статистика</b>\n\n` +
            `🏆 Побед: <b>${wins}</b>\n` +
            `😢 Проигрышей: <b>${losses}</b>\n` +
            `📈 Винрейт: <b>${winRate}%</b>\n\n` +
            `🏅 Уровень: <b>${profile.level}</b>\n` +
            `⭐ Опыт: <b>${profile.xp} XP</b>`
          );
        }
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // Команда "Бонусы"
      if (text === "🎁 Бонусы" || text === "/bonus") {
        await sendMessage(chatId,
          `🎁 <b>Доступные бонусы</b>\n\n` +
          `🎡 <b>Ежедневная рулетка</b> - крутите каждые 12 часов\n` +
          `📅 <b>Ежедневная награда</b> - получайте бонус каждый день\n` +
          `🎫 <b>Промокоды</b> - вводите коды для бонусов\n` +
          `🎰 <b>Колесо фортуны</b> - шанс выиграть крупный приз\n\n` +
          `Получите бонусы в казино:`,
          getPlayButtons()
        );
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // Команда "Профиль"
      if (text === "👤 Профиль" || text === "/profile") {
        if (!profile) {
          await sendMessage(chatId, "❌ Профиль не найден.", getPlayButtons());
        } else {
          await sendMessage(chatId,
            `👤 <b>Ваш профиль</b>\n\n` +
            `📛 Имя: <b>${profile.username}</b>\n` +
            `🏅 Уровень: <b>${profile.level}</b>\n` +
            `⭐ Опыт: <b>${profile.xp} XP</b>\n` +
            `💰 Баланс: <b>${profile.balance.toFixed(2)} ₽</b>\n\n` +
            `Настройки профиля доступны в казино:`,
            getPlayButtons()
          );
        }
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // Команда /help
      if (text === "/help") {
        await sendMessage(chatId,
          `📖 <b>Команды бота</b>\n\n` +
          `/start - Начать\n` +
          `/balance - Проверить баланс\n` +
          `/play - Открыть казино\n` +
          `/stats - Статистика\n` +
          `/notifications - Уведомления\n` +
          `/bonus - Бонусы\n` +
          `/profile - Профиль\n` +
          `/help - Справка`
        );
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // Неизвестная команда
      await sendMessage(chatId,
        `🤔 Не понимаю команду.\n\nИспользуйте кнопки меню или /help для справки.`,
        getMainMenu()
      );
    }

    // Обработка callback queries
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      await answerCallbackQuery(callbackQuery.id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Bot error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

Deno.serve(handler);
