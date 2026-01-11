import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Check, Loader2, Clock } from "lucide-react";

interface EmailVerificationProps {
  userId: string;
  currentEmail?: string | null;
  emailVerifiedAt?: string | null;
  onVerified?: (email: string) => void;
}

export const EmailVerification = ({
  userId,
  currentEmail,
  emailVerifiedAt,
  onVerified,
}: EmailVerificationProps) => {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"input" | "verify">("input");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleSendCode = async () => {
    if (!email || cooldown > 0) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-verification-code", {
        body: { userId, email },
      });

      if (error) throw error;

      if (data.error) {
        if (data.wait_seconds) {
          setCooldown(data.wait_seconds);
        }
        toast.error(data.error);
        return;
      }

      toast.success("Код отправлен на " + email);
      setStep("verify");
      setCooldown(30);
    } catch (error: any) {
      console.error("Error sending code:", error);
      toast.error("Ошибка отправки кода");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      toast.error("Введите 6-значный код");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("verify_email_code", {
        _user_id: userId,
        _code: code,
      });

      if (error) throw error;

      if (!data.success) {
        toast.error(data.error);
        return;
      }

      toast.success("Email подтверждён!");
      onVerified?.(data.email);
      setStep("input");
      setCode("");
    } catch (error: any) {
      console.error("Error verifying code:", error);
      toast.error("Ошибка проверки кода");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (cooldown > 0) return;
    await handleSendCode();
  };

  // Если email уже подтверждён
  if (emailVerifiedAt && currentEmail) {
    return (
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-500" />
            <span className="text-muted-foreground">{currentEmail}</span>
            <span className="text-xs text-green-500">(подтверждён)</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Подтверждение Email
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === "input" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Привяжите email для восстановления аккаунта
            </p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
              <Button
                onClick={handleSendCode}
                disabled={isLoading || !email || cooldown > 0}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : cooldown > 0 ? (
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {cooldown}с
                  </span>
                ) : (
                  "Отправить"
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Введите код, отправленный на <span className="font-medium text-foreground">{email}</span>
            </p>
            <div className="flex flex-col items-center gap-4">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={setCode}
                disabled={isLoading}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
              
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setStep("input");
                    setCode("");
                  }}
                  disabled={isLoading}
                >
                  Назад
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleVerifyCode}
                  disabled={isLoading || code.length !== 6}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Подтвердить"
                  )}
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleResendCode}
                disabled={cooldown > 0 || isLoading}
                className="text-muted-foreground"
              >
                {cooldown > 0 ? (
                  <span className="flex items-center gap-1">
                    Повторить через <Clock className="h-3 w-3 ml-1" /> {cooldown}с
                  </span>
                ) : (
                  "Отправить код повторно"
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
