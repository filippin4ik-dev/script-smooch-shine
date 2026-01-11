## deposit_bot_usdt_only.py — Только USDT, от 0.5$, курс 82₽, 2025
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import Message, CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup
from aiogram.utils.keyboard import ReplyKeyboardBuilder
from supabase import create_client
import aiohttp
import asyncio

# ====================== НАСТРОЙКИ ======================
BOT_TOKEN = "8589881744:AAFbuTXjvxxdxvz7Ox3EEI2yPo2dUwoLBvo"
CRYPTOBOT_TOKEN = "490241:AAV7Aa0czV7J0ByKU618D3UhOQhTcJ04rNK"

SUPABASE_URL = "https://vgkznlisijhtkarbsqqd.supabase.co"
# ВАЖНО: Используйте service_role ключ, а не anon!
# Скопируйте из Lovable: Widgets → Cloud → Settings → Secrets → SUPABASE_SERVICE_ROLE_KEY
SUPABASE_KEY = "ВСТАВЬТЕ_СЮДА_SERVICE_ROLE_KEY"  # Замените на реальный service_role ключ!

CHANNEL_LINK = "https://t.me/casino666s"
ADMIN_IDS = [6916550341]

USDT_TO_RUB = 82

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher(storage=MemoryStorage())
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ====================== СОСТОЯНИЯ ======================
class Deposit(StatesGroup):
    waiting_amount = State()

# ====================== CryptoBot API ======================
async def create_invoice(user_id: int, amount_usdt: float):
    payload = {
        "token": CRYPTOBOT_TOKEN,
        "asset": "USDT",
        "amount": f"{amount_usdt:.6f}",
        "description": f"Пополнение от {user_id}",
        "payload": str(user_id),
        "paid_btn_name": "openBot",
        "paid_btn_url": f"https://t.me/{(await bot.get_me()).username}"
    }
    async with aiohttp.ClientSession() as s:
        async with s.get("https://api.crypt.bot/api/createInvoice", params=payload) as r:
            data = await r.json()
            if data.get("ok"):
                res = data["result"]
                return {
                    "invoice_id": res["invoice_id"],
                    "pay_url": res["pay_url"],
                    "qr_url": res.get("qr_url") or res["bot_invoice_url"],
                    "amount": amount_usdt
                }
    return None

# ====================== ПРОФИЛЬ ======================
async def get_profile(tg_id):
    r = supabase.table('profiles').select('id,balance').eq('telegram_id', tg_id).execute()
    return r.data[0] if r.data else None

# ====================== МЕНЮ ======================
def main_menu():
    kb = ReplyKeyboardBuilder()
    kb.button(text="Баланс"); kb.button(text="Пополнить")
    kb.button(text="Вывод"); kb.button(text="Связаться с разработчиком")
    kb.button(text="Канал с промокодами")
    kb.adjust(2, 2, 1)
    return kb.as_markup(resize_keyboard=True)

# ====================== /start ======================
@dp.message(Command("start"))
async def start(m: Message):
    p = await get_profile(m.from_user.id)
    if not p:
        await m.answer(
            "Привет! Добро пожаловать в наше казино\n\n"
            "После регистрации в мини-апп появятся баланс, пополнение и вывод\n\n"
            "А пока — ежедневные промокоды:",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton("Канал с промокодами", url=CHANNEL_LINK)
            ]])
        )
        return
    await m.answer(f"Баланс: <b>{p['balance']:.2f} ₽</b>", reply_markup=main_menu(), parse_mode="HTML")

# ====================== ПОПОЛНИТЬ ======================
@dp.message(F.text == "Пополнить")
async def deposit_start(m: Message, state: FSMContext):
    await m.answer("Введите сумму в USDT (минимум 0.5):")
    await state.set_state(Deposit.waiting_amount)

@dp.message(Deposit.waiting_amount)
async def deposit_process(m: Message, state: FSMContext):
    try:
        amount = float(m.text.replace(",", "."))
        if amount < 0.5:
            raise ValueError
    except:
        await m.answer("Ошибка! Минимальная сумма — 0.5 USDT")
        return

    invoice = await create_invoice(m.from_user.id, amount)
    if not invoice:
        await m.answer("Ошибка создания счёта. Попробуй позже.")
        return

    rub = round(amount * USDT_TO_RUB, 2)

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton("Оплатить USDT", url=invoice["pay_url"])],
        [InlineKeyboardButton("Проверить оплату", callback_data=f"check_{invoice['invoice_id']}")]
    ])

    await m.answer_photo(
        invoice["qr_url"],
        caption=f"Счёт на <b>{amount} USDT</b>\n"
                f"≈ <b>{rub} ₽</b> будет зачислено\n\n"
                f"Оплати и нажми кнопку ниже",
        reply_markup=kb,
        parse_mode="HTML"
    )
    await state.clear()

# ====================== ПРОВЕРКА ОПЛАТЫ ======================
@dp.callback_query(F.data.startswith("check_"))
async def check_payment(c: CallbackQuery):
    invoice_id = c.data.split("_")[1]

    async with aiohttp.ClientSession() as s:
        async with s.get("https://api.crypt.bot/api/getInvoices", params={
            "token": CRYPTOBOT_TOKEN,
            "invoice_ids": invoice_id
        }) as r:
            data = await r.json()

            if data.get("ok") and data["result"]["items"]:
                inv = data["result"]["items"][0]
                if inv["status"] == "paid":
                    user_id = int(inv["payload"])
                    amount_usdt = float(inv["amount"])
                    rub = round(amount_usdt * USDT_TO_RUB, 2)

                    # Начисляем в Supabase
                    profile = await get_profile(user_id)
                    if profile:
                        supabase.rpc('update_balance', {
                            'user_id': profile['id'],
                            'amount': rub
                        }).execute()

                    await bot.send_message(user_id, f"Пополнено! +{rub} ₽ на баланс")
                    await c.message.edit_caption(
                        caption=f"ОПЛАЧЕНО!\n+<b>{rub} ₽</b> зачислено на баланс",
                        reply_markup=None,
                        parse_mode="HTML"
                    )
                    await c.answer("Успешно!")
                    return
    await c.answer("Ещё не оплачено", show_alert=True)

# ====================== БАЛАНС ======================
@dp.message(F.text == "Баланс")
async def balance(m: Message):
    p = await get_profile(m.from_user.id)
    if p:
        await m.answer(f"Ваш баланс: <b>{p['balance']:.2f} ₽</b>", parse_mode="HTML")
    else:
        await m.answer("Профиль не найден")

# ====================== ВЫВОД ======================
@dp.message(F.text == "Вывод")
async def withdraw(m: Message):
    await m.answer("Функция вывода в разработке")

# ====================== СВЯЗАТЬСЯ С РАЗРАБОТЧИКОМ ======================
@dp.message(F.text == "Связаться с разработчиком")
async def contact_dev(m: Message):
    await m.answer("Напишите @your_username для связи")

# ====================== КАНАЛ С ПРОМОКОДАМИ ======================
@dp.message(F.text == "Канал с промокодами")
async def promo_channel(m: Message):
    await m.answer(
        "Подпишитесь на наш канал:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton("Открыть канал", url=CHANNEL_LINK)
        ]])
    )

# ====================== ЗАПУСК ======================
async def main():
    print("Бот запущен — только USDT, от 0.5$, курс 82₽")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
