import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import confetti from "canvas-confetti";

const STORAGE_KEY = "balanceMode";

export type BalanceMode = "main" | "freebet" | "demo";

const fireConfetti = () => {
  const duration = 4000;
  const end = Date.now() + duration;

  const frame = () => {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.6 },
      colors: ['#10b981', '#34d399', '#6ee7b7', '#ffd700', '#22c55e'],
    });
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.6 },
      colors: ['#10b981', '#34d399', '#6ee7b7', '#ffd700', '#22c55e'],
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };
  frame();
};

export const useBalanceMode = () => {
  const [mode, setModeState] = useState<BalanceMode>(() => {
    if (typeof window === "undefined") return "main";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "freebet" || stored === "demo") return stored;
    return "main";
  });

  // Для отслеживания конвертации фрибета
  const prevFreebetBalanceRef = useRef<number | null>(null);

  const setMode = useCallback((value: BalanceMode) => {
    setModeState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, value);
    }
  }, []);

  // Real-time подписка на изменения профиля для автопереключения при freebet_balance = 0
  useEffect(() => {
    const userId = window.localStorage.getItem("current_user_id");
    if (!userId) return;

    // Начальная проверка
    const checkBalances = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("freebet_balance, demo_balance, wager_requirement")
        .eq("id", userId)
        .maybeSingle();

      if (data) {
        prevFreebetBalanceRef.current = data.freebet_balance || 0;

        // Если текущий режим невалиден — откатываем на main
        if (mode === "freebet" && (data.freebet_balance === 0 || data.freebet_balance === null)) {
          setMode("main");
        }
        if (mode === "demo" && (data.demo_balance === 0 || data.demo_balance === null)) {
          setMode("main");
        }
      }
    };

    checkBalances();

    // Real-time подписка
    const channel = supabase
      .channel('balance-mode-check')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`
        },
        (payload) => {
          const oldFreebet = prevFreebetBalanceRef.current;
          const newFreebet = payload.new?.freebet_balance || 0;
          const newDemo = payload.new?.demo_balance || 0;
          const newWagerRequirement = payload.new?.wager_requirement || 0;

          // Конвертация фрибета
          if (oldFreebet && oldFreebet > 0 && newFreebet === 0 && newWagerRequirement === 0) {
            fireConfetti();
            toast.success(
              `🎉 Фрибет отыгран! ${oldFreebet.toFixed(2)}₽ переведено на основной баланс!`,
              {
                duration: 6000,
                style: {
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white',
                  border: 'none',
                },
              }
            );
          }

          prevFreebetBalanceRef.current = newFreebet;

          // Автопереключение если текущий баланс исчерпан
          if (mode === "freebet" && (newFreebet === 0 || newFreebet === null)) {
            setMode("main");
          }
          if (mode === "demo" && (newDemo === 0 || newDemo === null)) {
            setMode("main");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mode, setMode]);

  // Helpers for legacy compatibility
  const useFreebet = mode === "freebet";
  const useDemo = mode === "demo";

  const setUseFreebet = useCallback((val: boolean) => setMode(val ? "freebet" : "main"), [setMode]);

  return { mode, setMode, useFreebet, useDemo, setUseFreebet };
};
