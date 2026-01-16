// Application configuration constants
export const APP_CONFIG = {
  // Telegram bot configuration
  BOT_USERNAME: "casinocasino123_bot",
  APP_NAME: "casic",
  
  // Get the full Telegram link with startapp parameter
  getTelegramLink: (startParam: string = "") => {
    const base = `https://t.me/${APP_CONFIG.BOT_USERNAME}/${APP_CONFIG.APP_NAME}`;
    return startParam ? `${base}?startapp=${startParam}` : base;
  },
  
  // Get promo link
  getPromoLink: (code: string) => APP_CONFIG.getTelegramLink(`PROMO_${code}`),
  
  // Get referral link  
  getReferralLink: (code: string) => APP_CONFIG.getTelegramLink(code),
  
  // Get profile link
  getProfileLink: (publicId: number) => APP_CONFIG.getTelegramLink(`profile_${publicId}`),
  
  // Get poker duel link
  getPokerDuelLink: () => APP_CONFIG.getTelegramLink('poker_duel'),
};
