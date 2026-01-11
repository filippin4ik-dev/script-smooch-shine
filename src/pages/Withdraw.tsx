import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AuthGuard, useAuth } from "@/components/AuthGuard";
import { useProfile } from "@/hooks/useProfile";
import { ArrowLeft, CheckCircle2, XCircle, Loader2, CreditCard, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import casinoLogo from "/casino-logo.png";

export default function Withdraw() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "sbp">("card");
  const [paymentDetails, setPaymentDetails] = useState("");
  const [comment, setComment] = useState("");

  const { data: requests } = useQuery({
    queryKey: ["withdrawal-requests", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const createRequestMutation = useMutation({
    mutationFn: async () => {
      const amountNum = parseFloat(amount);
      if (!user?.id) throw new Error("Не авторизован");
      if (amountNum < 1000) throw new Error("Минимальная сумма вывода 1000₽");
      if (!paymentDetails.trim()) throw new Error("Укажите реквизиты");
      
      // Получаем свежий баланс из БД
      const { data: freshProfile, error: profileError } = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", user.id)
        .single();
      
      if (profileError) throw profileError;
      if (!freshProfile || freshProfile.balance < amountNum) {
        throw new Error("Недостаточно средств");
      }

      const paymentInfo = paymentMethod === "sbp" 
        ? `СБП: ${paymentDetails.trim()}`
        : `Карта: ${paymentDetails.trim()}`;

      const { error } = await supabase.from("withdrawal_requests").insert({
        user_id: user.id,
        amount: amountNum,
        payment_details: paymentInfo,
        comment: comment.trim() || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["withdrawal-requests"] });
      toast.success("Заявка на вывод создана");
      setAmount("");
      setPaymentDetails("");
      setComment("");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-dark p-4">
        <div className="max-w-2xl mx-auto">
          <Button
            onClick={() => navigate("/")}
            variant="ghost"
            className="mb-6 hover:bg-primary/10"
          >
            <ArrowLeft className="mr-2 w-4 h-4" />
            Назад
          </Button>

          <Card className="p-8 bg-card/80 backdrop-blur-xl border-primary/20 shadow-neon-blue mb-6">
            <div className="text-center mb-8">
              <img
                src={casinoLogo}
                alt="Casino"
                className="w-16 h-16 mx-auto mb-4 rounded-xl shadow-gold"
              />
              <h1 className="text-3xl font-black text-primary mb-2">Вывод средств</h1>
              <p className="text-muted-foreground">
                Ваш баланс: <span className="font-bold text-primary">{profile?.balance?.toFixed(2) || 0}₽</span>
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="amount">Сумма вывода (мин. 1000₽)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="1000"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1000"
                  className={
                    parseFloat(amount) > 0 && profile?.balance && parseFloat(amount) > profile.balance
                      ? "border-destructive"
                      : ""
                  }
                />
                {parseFloat(amount) > 0 && profile?.balance && parseFloat(amount) > profile.balance && (
                  <p className="text-sm text-destructive mt-1">
                    ⚠️ Недостаточно средств (доступно: {profile.balance.toFixed(2)}₽)
                  </p>
                )}
              </div>

              <div>
                <Label>Способ вывода *</Label>
                <RadioGroup value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="card" id="card" />
                      <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer">
                        <CreditCard className="w-4 h-4" />
                        Карта
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sbp" id="sbp" />
                      <Label htmlFor="sbp" className="flex items-center gap-2 cursor-pointer">
                        <Smartphone className="w-4 h-4" />
                        СБП
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="details">
                  {paymentMethod === "sbp" ? "Номер телефона" : "Номер карты"} *
                </Label>
                <Input
                  id="details"
                  value={paymentDetails}
                  onChange={(e) => setPaymentDetails(e.target.value)}
                  placeholder={paymentMethod === "sbp" ? "+7 999 123 45 67" : "0000 0000 0000 0000"}
                />
              </div>

              <div>
                <Label htmlFor="comment">Комментарий (необязательно)</Label>
                <Textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Дополнительная информация"
                  rows={3}
                />
              </div>

              <Button
                onClick={() => createRequestMutation.mutate()}
                disabled={createRequestMutation.isPending}
                className="w-full"
              >
                {createRequestMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Создать заявку
              </Button>
            </div>
          </Card>

          {/* User's withdrawal requests */}
          {requests && requests.length > 0 && (
            <Card className="p-6 bg-card/80 backdrop-blur-xl border-primary/20">
              <h2 className="text-xl font-bold mb-4">Мои заявки</h2>
              <div className="space-y-3">
                {requests.map((request) => (
                  <Card key={request.id} className="p-4 bg-gradient-card border-primary/30">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-primary">
                            {request.amount.toFixed(2)}₽
                          </span>
                          {request.status === "approved" && (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          )}
                          {request.status === "rejected" && (
                            <XCircle className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                        <Badge
                          variant={
                            request.status === "approved"
                              ? "default"
                              : request.status === "rejected"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {request.status === "pending"
                            ? "⏳ Ожидает обработки"
                            : request.status === "approved"
                            ? "✅ Успешно"
                            : "❌ Отменен вывод"}
                        </Badge>
                        {request.status === "rejected" && (
                          <p className="text-sm text-muted-foreground">
                            Если есть вопрос, напишите в поддержку
                          </p>
                        )}
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(request.created_at), "dd.MM.yyyy HH:mm")}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
