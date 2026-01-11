# Документация по базе данных для Telegram бота

## Подключение к Supabase

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vgkznlisijhtkarbsqqd.supabase.co';
const supabaseKey = 'ВАШ_ANON_KEY'; // Получите у администратора

const supabase = createClient(supabaseUrl, supabaseKey);
```

## Основные таблицы

### 1. `profiles` - Профили пользователей
Основная таблица с данными пользователей.

**Столбцы:**
- `id` (uuid) - Уникальный идентификатор профиля
- `telegram_id` (bigint) - ID пользователя в Telegram (УНИКАЛЬНЫЙ)
- `username` (text) - Имя пользователя в казино
- `balance` (numeric) - Текущий баланс (по умолчанию 0.00)
- `is_banned` (boolean) - Заблокирован ли пользователь
- `is_muted` (boolean) - В муте ли пользователь
- `total_wins` (integer) - Количество побед
- `total_losses` (integer) - Количество поражений
- `guaranteed_max_win` (boolean) - Гарантированный макс вин в следующей игре
- `created_at` (timestamp) - Дата создания профиля
- `updated_at` (timestamp) - Дата последнего обновления

**Пример запроса:**
```javascript
// Получить профиль по telegram_id
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('telegram_id', telegramUserId)
  .single();
```

---

### 2. `user_moderation` - Модерация пользователей
Таблица с информацией о банах и мутах.

**Столбцы:**
- `id` (uuid) - Уникальный ID записи
- `user_id` (uuid) - ID пользователя из таблицы profiles
- `is_banned` (boolean) - Забанен ли пользователь
- `ban_reason` (text) - Причина бана
- `banned_by` (uuid) - Кто забанил
- `muted_until` (timestamp) - До какого времени мут
- `mute_reason` (text) - Причина мута
- `muted_by` (uuid) - Кто замутил
- `created_at` (timestamp) - Дата создания
- `updated_at` (timestamp) - Дата обновления

**Пример запроса:**
```javascript
// Проверить статус модерации
const { data } = await supabase
  .from('user_moderation')
  .select('is_banned, ban_reason, muted_until')
  .eq('user_id', userId)
  .single();
```

---

### 3. `transactions` - История транзакций
Все финансовые операции пользователей.

**Столбцы:**
- `id` (uuid) - Уникальный ID транзакции
- `user_id` (uuid) - ID пользователя
- `amount` (numeric) - Сумма (+ пополнение, - списание)
- `type` (text) - Тип: 'deposit', 'withdrawal', 'bet', 'win', 'daily_reward', 'promocode'
- `description` (text) - Описание транзакции
- `created_at` (timestamp) - Дата создания

**Пример запроса:**
```javascript
// Получить последние 10 транзакций
const { data } = await supabase
  .from('transactions')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(10);
```

---

### 4. `game_history` - История игр
Записи обо всех сыгранных играх.

**Столбцы:**
- `id` (uuid) - ID игры
- `user_id` (uuid) - ID игрока
- `game_name` (text) - Название игры ('dice', 'crash', 'mines', и т.д.)
- `bet_amount` (numeric) - Сумма ставки
- `win_amount` (numeric) - Сумма выигрыша (0 если проигрыш)
- `multiplier` (numeric) - Множитель выигрыша
- `created_at` (timestamp) - Время игры

**Пример запроса:**
```javascript
// Получить историю игр пользователя
const { data } = await supabase
  .from('game_history')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(20);
```

---

### 5. `chat_messages` - Сообщения чата
Все сообщения в общем чате казино.

**Столбцы:**
- `id` (uuid) - ID сообщения
- `user_id` (uuid) - Автор сообщения
- `message` (text) - Текст сообщения (макс 500 символов)
- `created_at` (timestamp) - Время отправки

**Пример запроса:**
```javascript
// Получить последние 50 сообщений
const { data } = await supabase
  .from('chat_messages')
  .select('*, profiles(username)')
  .order('created_at', { ascending: false })
  .limit(50);
```

---

### 6. `promocodes` - Промокоды
Таблица с активными промокодами.

**Столбцы:**
- `id` (uuid) - ID промокода
- `code` (text) - Сам промокод (УНИКАЛЬНЫЙ)
- `reward_type` (text) - Тип награды: 'money', 'freespins', 'admin'
- `reward_amount` (numeric) - Размер награды
- `is_active` (boolean) - Активен ли промокод
- `max_uses` (integer) - Максимум использований (NULL = без лимита)
- `current_uses` (integer) - Сколько раз уже использован
- `created_at` (timestamp) - Дата создания

---

### 7. `user_roles` - Роли пользователей
Определяет права доступа (admin/user).

**Столбцы:**
- `id` (uuid) - ID записи
- `user_id` (uuid) - ID пользователя
- `role` (text) - Роль: 'admin' или 'user'
- `created_at` (timestamp) - Дата назначения

**Пример запроса:**
```javascript
// Проверить, является ли пользователь админом
const { data } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', userId)
  .eq('role', 'admin')
  .single();

const isAdmin = !!data;
```

---

## RPC функции (Удалённые процедуры)

### 1. `get_or_create_profile_by_telegram`
**Назначение:** Создаёт или возвращает профиль по Telegram ID.

**Параметры:**
- `_telegram_id` (bigint) - ID пользователя в Telegram
- `_username` (text) - Имя пользователя
- `_first_name` (text, необязательно) - Имя
- `_last_name` (text, необязательно) - Фамилия

**Возвращает:** UUID профиля пользователя

**Пример использования:**
```javascript
const { data: userId, error } = await supabase.rpc('get_or_create_profile_by_telegram', {
  _telegram_id: telegramUser.id,
  _username: telegramUser.username || `player${telegramUser.id}`,
  _first_name: telegramUser.first_name,
  _last_name: telegramUser.last_name
});

// userId теперь содержит UUID профиля
```

---

### 2. `update_balance`
**Назначение:** Изменяет баланс пользователя.

**Параметры:**
- `user_id` (uuid) - ID пользователя
- `amount` (numeric) - Сумма изменения (+ или -)

**Возвращает:** void

**Пример использования:**
```javascript
// Пополнить баланс на 100
await supabase.rpc('update_balance', {
  user_id: userId,
  amount: 100
});

// Списать 50
await supabase.rpc('update_balance', {
  user_id: userId,
  amount: -50
});
```

---

### 3. `set_user_ban`
**Назначение:** Блокирует или разблокирует пользователя.

**Параметры:**
- `_user_id` (uuid) - ID пользователя
- `_is_banned` (boolean) - true = забанить, false = разбанить
- `_ban_reason` (text, необязательно) - Причина бана

**Возвращает:** void

**Пример использования:**
```javascript
// Забанить пользователя
await supabase.rpc('set_user_ban', {
  _user_id: userId,
  _is_banned: true,
  _ban_reason: 'Нарушение правил'
});

// Разбанить
await supabase.rpc('set_user_ban', {
  _user_id: userId,
  _is_banned: false
});
```

---

### 4. `set_user_mute`
**Назначение:** Мутит пользователя в чате на определённое время.

**Параметры:**
- `_user_id` (uuid) - ID пользователя
- `_mute_seconds` (integer, необязательно) - Секунд мута (0 или NULL = размут)

**Возвращает:** void

**Пример использования:**
```javascript
// Замутить на 1 час (3600 секунд)
await supabase.rpc('set_user_mute', {
  _user_id: userId,
  _mute_seconds: 3600
});

// Размутить
await supabase.rpc('set_user_mute', {
  _user_id: userId,
  _mute_seconds: 0
});
```

---

### 5. `set_guaranteed_max_win`
**Назначение:** Гарантирует максимальный выигрыш в следующей игре.

**Параметры:**
- `_user_id` (uuid) - ID пользователя
- `_enabled` (boolean) - Включить/выключить

**Возвращает:** void

**Пример использования:**
```javascript
// Включить макс вин
await supabase.rpc('set_guaranteed_max_win', {
  _user_id: userId,
  _enabled: true
});
```

---

### 6. `apply_promocode`
**Назначение:** Активирует промокод для пользователя.

**Параметры:**
- `_user_id` (uuid) - ID пользователя
- `_code` (text) - Промокод

**Возвращает:** TABLE(success boolean, message text)

**Пример использования:**
```javascript
const { data, error } = await supabase.rpc('apply_promocode', {
  _user_id: userId,
  _code: 'BONUS100'
});

if (data && data[0].success) {
  console.log(data[0].message); // "Получено 100₽"
}
```

---

### 7. `claim_daily_reward`
**Назначение:** Выдаёт ежедневную награду (каждые 2 часа).

**Параметры:**
- `_user_id` (uuid) - ID пользователя

**Возвращает:** TABLE(success boolean, reward_amount numeric, message text)

**Пример использования:**
```javascript
const { data, error } = await supabase.rpc('claim_daily_reward', {
  _user_id: userId
});

if (data && data[0].success) {
  console.log(`Получено ${data[0].reward_amount} монет!`);
} else {
  console.log(data[0].message); // "Вы уже получили награду недавно"
}
```

---

### 8. `delete_user_profile`
**Назначение:** Полностью удаляет профиль пользователя и все связанные данные.

**Параметры:**
- `_user_id` (uuid) - ID пользователя

**Возвращает:** void

**Пример использования:**
```javascript
await supabase.rpc('delete_user_profile', {
  _user_id: userId
});
```

---

## Примеры типичных операций для бота

### Авторизация пользователя при старте бота
```javascript
async function authorizeUser(telegramUser) {
  const { data: userId } = await supabase.rpc('get_or_create_profile_by_telegram', {
    _telegram_id: telegramUser.id,
    _username: telegramUser.username || `player${telegramUser.id}`,
    _first_name: telegramUser.first_name,
    _last_name: telegramUser.last_name
  });

  // Получить полный профиль
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  return profile;
}
```

### Проверка статуса бана перед действием
```javascript
async function checkBanStatus(userId) {
  const { data } = await supabase
    .from('user_moderation')
    .select('is_banned, ban_reason')
    .eq('user_id', userId)
    .single();

  if (data?.is_banned) {
    return {
      banned: true,
      reason: data.ban_reason
    };
  }
  return { banned: false };
}
```

### Пополнение баланса через бота
```javascript
async function topUpBalance(userId, amount) {
  // Обновить баланс
  await supabase.rpc('update_balance', {
    user_id: userId,
    amount: amount
  });

  // Создать транзакцию
  await supabase.from('transactions').insert({
    user_id: userId,
    amount: amount,
    type: 'deposit',
    description: 'Пополнение через Telegram бот'
  });
}
```

### Отправка сообщения в чат от имени пользователя
```javascript
async function sendChatMessage(userId, messageText) {
  const { error } = await supabase
    .from('chat_messages')
    .insert({
      user_id: userId,
      message: messageText
    });

  return !error;
}
```

### Получение статистики пользователя
```javascript
async function getUserStats(userId) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('balance, total_wins, total_losses')
    .eq('id', userId)
    .single();

  const { data: recentGames } = await supabase
    .from('game_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  const totalBets = recentGames?.length || 0;
  const totalWinAmount = recentGames?.reduce((sum, game) => sum + (game.win_amount || 0), 0) || 0;

  return {
    balance: profile.balance,
    wins: profile.total_wins,
    losses: profile.total_losses,
    recentBets: totalBets,
    recentWinnings: totalWinAmount
  };
}
```

---

## Real-time подписки (для живых обновлений)

### Подписка на новые сообщения в чате
```javascript
const chatChannel = supabase
  .channel('chat-messages')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'chat_messages'
    },
    (payload) => {
      console.log('Новое сообщение:', payload.new);
      // Отправить уведомление пользователям бота
    }
  )
  .subscribe();
```

### Подписка на изменение баланса
```javascript
const balanceChannel = supabase
  .channel('balance-updates')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'profiles',
      filter: `id=eq.${userId}`
    },
    (payload) => {
      console.log('Баланс изменён:', payload.new.balance);
      // Уведомить пользователя
    }
  )
  .subscribe();
```

---

## Безопасность

⚠️ **ВАЖНО:**
- Никогда не передавайте `SUPABASE_SERVICE_ROLE_KEY` клиентам
- Используйте только `ANON_KEY` для Telegram бота
- RLS (Row Level Security) политики защищают данные автоматически
- Все RPC функции имеют `SECURITY DEFINER` и безопасны для вызова

---

## Контактная информация

По вопросам доступа к API ключам или настройке базы данных обращайтесь к администратору проекта.
