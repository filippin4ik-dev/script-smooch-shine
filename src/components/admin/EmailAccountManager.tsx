import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Plus, Trash2, Loader2, Server } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EmailAccount {
  id: string;
  email: string;
  smtp_host: string;
  is_active: boolean;
  use_count: number;
  last_used_at: string | null;
}

interface EmailAccountManagerProps {
  userId: string;
}

const SMTP_PRESETS = [
  { name: "Gmail", host: "smtp.gmail.com", port: 587 },
  { name: "Yandex", host: "smtp.yandex.ru", port: 587 },
  { name: "Mail.ru", host: "smtp.mail.ru", port: 587 },
  { name: "Outlook", host: "smtp.office365.com", port: 587 },
  { name: "Custom", host: "", port: 587 },
];

export const EmailAccountManager = ({ userId }: EmailAccountManagerProps) => {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [selectedPreset, setSelectedPreset] = useState("Gmail");
  const [email, setEmail] = useState("");
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [displayName, setDisplayName] = useState("Lucky Casino");

  useEffect(() => {
    loadAccounts();
  }, [userId]);

  const loadAccounts = async () => {
    try {
      const { data, error } = await supabase.rpc("admin_get_email_accounts", {
        _admin_id: userId,
      });

      if (error) throw error;
      
      if (data?.success) {
        setAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error("Error loading accounts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    const presetData = SMTP_PRESETS.find((p) => p.name === preset);
    if (presetData) {
      setSmtpHost(presetData.host);
      setSmtpPort(presetData.port);
    }
  };

  const handleAddAccount = async () => {
    if (!email || !smtpHost || !smtpUser || !smtpPassword) {
      toast.error("Заполните все поля");
      return;
    }

    setIsAdding(true);
    try {
      const { data, error } = await supabase.rpc("admin_add_email_account", {
        _admin_id: userId,
        _email: email,
        _smtp_host: smtpHost,
        _smtp_port: smtpPort,
        _smtp_user: smtpUser,
        _smtp_password: smtpPassword,
        _display_name: displayName,
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Email аккаунт добавлен");
        setDialogOpen(false);
        resetForm();
        loadAccounts();
      } else {
        toast.error(data?.error || "Ошибка");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    try {
      const { data, error } = await supabase.rpc("admin_delete_email_account", {
        _admin_id: userId,
        _email_id: accountId,
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Аккаунт удалён");
        loadAccounts();
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const resetForm = () => {
    setEmail("");
    setSmtpUser("");
    setSmtpPassword("");
    setSelectedPreset("Gmail");
    setSmtpHost("smtp.gmail.com");
    setSmtpPort(587);
    setDisplayName("Lucky Casino");
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email аккаунты для отправки
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Добавить
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Добавить Email аккаунт</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Провайдер</Label>
                <Select value={selectedPreset} onValueChange={handlePresetChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SMTP_PRESETS.map((preset) => (
                      <SelectItem key={preset.name} value={preset.name}>
                        {preset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>

              {selectedPreset === "Custom" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>SMTP Host</Label>
                    <Input
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="smtp.example.com"
                    />
                  </div>
                  <div>
                    <Label>Port</Label>
                    <Input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(parseInt(e.target.value))}
                    />
                  </div>
                </div>
              )}

              <div>
                <Label>SMTP Логин</Label>
                <Input
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="Обычно совпадает с email"
                />
              </div>

              <div>
                <Label>SMTP Пароль / App Password</Label>
                <Input
                  type="password"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder="Пароль приложения"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Для Gmail используйте пароль приложения
                </p>
              </div>

              <div>
                <Label>Имя отправителя</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Lucky Casino"
                />
              </div>

              <Button
                onClick={handleAddAccount}
                disabled={isAdding}
                className="w-full"
              >
                {isAdding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Добавить"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Server className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Нет email аккаунтов</p>
            <p className="text-sm">Добавьте аккаунты для отправки кодов верификации</p>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div>
                  <div className="font-medium">{account.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {account.smtp_host} • Отправлено: {account.use_count}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteAccount(account.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
