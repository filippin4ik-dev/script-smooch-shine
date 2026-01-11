import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UsernameDialogProps {
  telegramId: number;
  initialReferralCode?: string;
  onProfileCreated: (profileId: string, username: string) => void;
}

export const UsernameDialog = ({ telegramId, initialReferralCode = "", onProfileCreated }: UsernameDialogProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [username, setUsername] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Проверяем, это промокод или реферальный код
  const isPromocode = initialReferralCode.startsWith("PROMO_");
  const promocodeValue = isPromocode ? initialReferralCode.replace("PROMO_", "") : "";
  const [referralCode, setReferralCode] = useState(isPromocode ? "" : initialReferralCode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      toast.error("Введите никнейм");
      return;
    }

    if (username.length < 3) {
      toast.error("Никнейм должен быть минимум 3 символа");
      return;
    }

    if (username.length > 20) {
      toast.error("Никнейм должен быть максимум 20 символов");
      return;
    }

    // Проверка на допустимые символы (буквы, цифры, подчеркивание)
    if (!/^[a-zA-Zа-яА-ЯёЁ0-9_]+$/.test(username)) {
      toast.error("Никнейм может содержать только буквы, цифры и _");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.rpc("create_profile_with_username", {
        _telegram_id: telegramId,
        _username: username.trim(),
        _first_name: null,
        _last_name: null,
      });

      if (error) throw error;

      const result = data[0];
      if (result.success) {
        toast.success("Профиль успешно создан!");
        
        // Применяем реферальный код если он был введен
        if (referralCode.trim()) {
          const { data: refData, error: refError } = await supabase.rpc("apply_referral_code", {
            _user_id: result.profile_id,
            _referral_code: referralCode.trim().toUpperCase(),
          });

          if (!refError && refData[0]?.success) {
            toast.success(refData[0].message);
          }
        }
        
        // Применяем промокод если пришел через ссылку
        if (promocodeValue) {
          const { data: promoData, error: promoError } = await supabase.rpc("apply_promocode", {
            _user_id: result.profile_id,
            _code: promocodeValue,
          });

          if (!promoError && promoData[0]?.success) {
            toast.success(promoData[0].message);
          }
        }
        
        onProfileCreated(result.profile_id, username.trim());
        setIsOpen(false);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Ошибка при создании профиля");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {
      // Не даем закрыть диалог, пока не создан профиль
      toast.info("Пожалуйста, создайте никнейм для продолжения");
    }}>
      <DialogContent 
        className="sm:max-w-md" 
        onPointerDownOutside={(e) => e.preventDefault()} 
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">👋 Добро пожаловать!</DialogTitle>
          <DialogDescription className="text-center pt-2">
            Придумайте себе уникальный никнейм для создания аккаунта
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ваш никнейм"
              className="bg-input text-center text-lg"
              maxLength={20}
              autoFocus
            />
            <p className="text-xs text-muted-foreground text-center mt-2">
              3-20 символов, буквы, цифры и _
            </p>
          </div>
          
          <div>
            <Input
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              placeholder="Реферальный код (необязательно)"
              className="bg-input text-center text-lg uppercase"
              maxLength={8}
            />
            <p className="text-xs text-muted-foreground text-center mt-2">
              Есть код друга? Введите его и получите бонус
            </p>
          </div>
          
          <Button
            type="submit"
            disabled={isSubmitting || !username.trim()}
            className="w-full bg-gradient-primary hover:opacity-90 font-bold text-lg py-6"
          >
            {isSubmitting ? "Создание профиля..." : "✓ Создать аккаунт"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};