import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AuthGuard } from "@/components/AuthGuard";
import { ArrowLeft } from "lucide-react";
import casinoLogo from "/casino-logo.png";

export default function Deposit() {
  const navigate = useNavigate();

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

          <Card className="p-8 bg-card/80 backdrop-blur-xl border-primary/20 shadow-neon-blue">
            <div className="text-center mb-8">
              <img
                src={casinoLogo}
                alt="Casino"
                className="w-16 h-16 mx-auto mb-4 rounded-xl shadow-gold"
              />
              <h1 className="text-3xl font-black text-primary mb-2">Пополнение баланса</h1>
              <p className="text-muted-foreground">Обратитесь в техподдержку</p>
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-card border border-primary/30 rounded-lg p-6 text-center">
                <div className="text-5xl mb-4">💰</div>
                <h3 className="font-bold text-xl mb-2">Пополнение баланса</h3>
                <p className="text-muted-foreground mb-4">
                  Для пополнения баланса обратитесь в техподдержку
                </p>
                <Button onClick={() => navigate("/support")} className="w-full">
                  Связаться с поддержкой
                </Button>
              </div>

              <div className="bg-gradient-card border border-primary/30 rounded-lg p-4">
                <h3 className="font-medium mb-2">💡 Как пополнить баланс?</h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Создайте тикет в техподдержке</li>
                  <li>• Укажите сумму пополнения</li>
                  <li>• Получите реквизиты для оплаты</li>
                  <li>• Средства зачисляются моментально после оплаты</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
}
