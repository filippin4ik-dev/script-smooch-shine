import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Swords } from 'lucide-react';
import PokerDuelGame from '@/components/games/PokerDuelGame';
import { toast } from 'sonner';

const PokerDuel = () => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      // Получаем telegram_id из WebApp
      const tg = (window as any).Telegram?.WebApp;
      const telegramId = tg?.initDataUnsafe?.user?.id;

      if (!telegramId) {
        toast.error('Требуется авторизация через Telegram');
        navigate('/');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, balance')
        .eq('telegram_id', telegramId)
        .single();

      if (error || !profile) {
        toast.error('Профиль не найден');
        navigate('/');
        return;
      }

      setVisitorId(profile.id);
      setBalance(profile.balance);
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Ошибка загрузки профиля');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleBalanceUpdate = () => {
    fetchProfile();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!visitorId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
                <Swords className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg">Poker Duel</h1>
                <p className="text-xs text-muted-foreground">3-Card Poker PvP</p>
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Баланс</div>
            <div className="font-bold text-primary">{balance.toFixed(2)}₽</div>
          </div>
        </div>
      </div>

      {/* Game Content */}
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <PokerDuelGame
          balance={balance}
          visitorId={visitorId}
          onBalanceUpdate={handleBalanceUpdate}
        />
      </div>
    </div>
  );
};

export default PokerDuel;
