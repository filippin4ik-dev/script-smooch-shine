import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign } from "lucide-react";

interface BettingFreebetManagerProps {
  userId: string;
}

export const BettingFreebetManager = ({ userId }: BettingFreebetManagerProps) => {
  const [bettingFreebetBalance, setBettingFreebetBalance] = useState(0);

  useEffect(() => {
    loadBettingFreebetData();
    
    // Realtime подписка на изменения профиля
    const channel = supabase
      .channel('betting-freebet-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`
        },
        (payload) => {
          const newData = payload.new as any;
          setBettingFreebetBalance(newData.betting_freebet_balance || 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const loadBettingFreebetData = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("betting_freebet_balance")
        .eq("id", userId)
        .single();

      if (error) throw error;

      setBettingFreebetBalance(data.betting_freebet_balance || 0);
    } catch (error) {
      console.error("Error loading betting freebet data:", error);
    }
  };

  if (bettingFreebetBalance === 0) {
    return null;
  }

  return (
    <Card className="border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.2)] bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-400">
          <DollarSign className="w-5 h-5" />
          Фрибет для ставок
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Доступный баланс:</span>
          <span className="font-bold text-xl text-green-400">{bettingFreebetBalance.toFixed(2)}₽</span>
        </div>
        
        <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20 text-xs text-muted-foreground">
          <p className="font-semibold mb-1 text-foreground">Как работает фрибет для ставок?</p>
          <p>
            При ставке фрибета выигрыш рассчитывается с коэффициентом 2. Например: ставка 200₽ на коэф. 1.5 = выигрыш 100₽ (200 × 1.5 ÷ 2 - 200).
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
