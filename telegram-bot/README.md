# Telegram Bot для Casino - Инструкция по запуску

## 📋 Описание

Это Python Telegram бот для приема пополнений через USDT с использованием CryptoBot API и интеграцией с вашей базой данных Lovable Cloud.

## ⚠️ КРИТИЧЕСКИ ВАЖНО: Service Role Key

**Бот НЕ БУДЕТ РАБОТАТЬ без правильного ключа!**

Вы получите ошибку:
```
APIError: {'message': 'Invalid API key', 'code': 401}
```

### Как получить правильный ключ:

1. Откройте Lovable редактор вашего проекта
2. Перейдите: **Widgets → Cloud → Settings → Secrets**
3. Найдите секрет **`SUPABASE_SERVICE_ROLE_KEY`**
4. Нажмите на него и скопируйте значение (длинная строка начинающаяся с `eyJ...`)
5. Откройте файл `deposit_bot_usdt_only.py`
6. Найдите строку с `SUPABASE_KEY = "ВСТАВЬТЕ_СЮДА_SERVICE_ROLE_KEY"`
7. Замените на: `SUPABASE_KEY = "скопированный_ключ"`

**НЕ ИСПОЛЬЗУЙТЕ** `anon` ключ из `.env` файла — он не даст доступ к функциям обновления баланса!

## 🚀 Как запустить бот

### 1. Установите Python 3.10+

Убедитесь, что у вас установлен Python версии 3.10 или выше.

### 2. Установите зависимости

```bash
pip install aiogram aiohttp supabase
```

### 3. Настройте бота

**ОБЯЗАТЕЛЬНО** замените `SUPABASE_KEY` на service_role ключ (см. раздел выше)!

Остальные настройки уже прописаны:
- BOT_TOKEN - токен вашего Telegram бота
- CRYPTOBOT_TOKEN - токен CryptoBot API
- SUPABASE_URL - URL базы данных

### 4. Запустите бота

```bash
python deposit_bot_usdt_only.py
```

## 📦 Где запускать

Бот **не может** работать в Lovable. Вам нужно запустить его на:

1. **VPS сервере** (рекомендуется для продакшена):
   - DigitalOcean, Hetzner, AWS, и т.д.
   - Ubuntu/Debian Linux
   - Работает 24/7

2. **Локальном компьютере** (для тестирования):
   - Windows, macOS, Linux
   - Работает только пока включен компьютер

3. **Бесплатных хостингах** (для начала):
   - PythonAnywhere
   - Heroku
   - Railway

## 🔧 Настройка VPS (пример для Ubuntu)

```bash
# 1. Обновите систему
sudo apt update && sudo apt upgrade -y

# 2. Установите Python и pip
sudo apt install python3 python3-pip -y

# 3. Создайте папку для бота
mkdir telegram-bot
cd telegram-bot

# 4. Загрузите файл бота (через FTP или напрямую создайте)
nano deposit_bot_usdt_only.py
# Скопируйте код из файла

# 5. Установите зависимости
pip3 install aiogram aiohttp supabase

# 6. Запустите бота
python3 deposit_bot_usdt_only.py
```

## 🔄 Запуск бота в фоне (screen)

```bash
# Установите screen
sudo apt install screen -y

# Создайте новую сессию
screen -S telegram-bot

# Запустите бота
python3 deposit_bot_usdt_only.py

# Отключитесь от сессии (бот продолжит работать)
# Нажмите: Ctrl + A, затем D

# Вернуться к боту позже
screen -r telegram-bot
```

## 🔄 Автозапуск бота (systemd)

Создайте файл `/etc/systemd/system/telegram-bot.service`:

```ini
[Unit]
Description=Casino Telegram Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/telegram-bot
ExecStart=/usr/bin/python3 /root/telegram-bot/deposit_bot_usdt_only.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Затем:
```bash
sudo systemctl daemon-reload
sudo systemctl enable telegram-bot
sudo systemctl start telegram-bot
sudo systemctl status telegram-bot
```

## 🔐 Безопасность

⚠️ **ВАЖНО**: В коде уже прописаны ваши токены. Если вы публикуете код где-то публично:

1. Используйте переменные окружения:
```python
import os
BOT_TOKEN = os.getenv("BOT_TOKEN")
CRYPTOBOT_TOKEN = os.getenv("CRYPTOBOT_TOKEN")
```

2. Создайте `.env` файл:
```
BOT_TOKEN=ваш_токен
CRYPTOBOT_TOKEN=ваш_токен
```

3. Используйте python-dotenv:
```bash
pip install python-dotenv
```

## 📊 Функционал бота

- ✅ Пополнение через USDT (минимум 0.5 USDT)
- ✅ Курс 82₽ за 1 USDT
- ✅ Автоматическое начисление баланса
- ✅ QR-код для оплаты
- ✅ Проверка статуса платежа
- ✅ Просмотр баланса
- ✅ Интеграция с базой данных Lovable Cloud

## 🆘 Помощь

Если возникают ошибки:

1. Проверьте, что все зависимости установлены
2. Проверьте, что токены корректны
3. Проверьте логи бота в консоли
4. Убедитесь, что у вас есть доступ к интернету

## 📝 Примечания

- Бот работает с Long Polling (постоянное подключение)
- Для продакшена рекомендуется использовать Webhooks
- CryptoBot поддерживает только USDT в этой версии
- Все данные сохраняются в вашу базу данных Lovable Cloud
