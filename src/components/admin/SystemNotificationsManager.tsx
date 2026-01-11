import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTelegramAuth } from "@/hooks/useTelegramAuth";

interface Profile {
  id: string;
  username: string;
}

const MESSAGE_TEMPLATES = [
  { label: "Пополнение бонуса", text: "🎁 Вам начислен бонус! Проверьте раздел Подарки." },
  { label: "Технические работы", text: "⚠️ Проводятся технические работы. Приносим извинения за неудобства." },
  { label: "Новая игра", text: "🎮 Добавлена новая игра! Попробуйте прямо сейчас." },
  { label: "Акция", text: "🔥 Специальная акция! Не упустите возможность получить бонус." },
  { label: "Обновление", text: "✨ Сайт обновлен! Ознакомьтесь с новыми функциями." },
];

export const SystemNotificationsManager = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [message, setMessage] = useState("");
  const [targetType, setTargetType] = useState<"all" | "specific">("all");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const { toast } = useToast();
  const { user } = useTelegramAuth();

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username')
      .order('username');

    if (error) {
      console.error('Error fetching profiles:', error);
      return;
    }

    setProfiles(data || []);
  };

  const sendNotification = async () => {
    if (!message.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите текст уведомления",
        variant: "destructive",
      });
      return;
    }

    if (targetType === "specific" && !selectedUserId) {
      toast({
        title: "Ошибка",
        description: "Выберите пользователя",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Ошибка",
        description: "Не удалось определить администратора",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase.rpc('send_system_notification', {
      _admin_user_id: user.id,
      _message: message.trim(),
      _target_user_id: targetType === "all" ? null : selectedUserId,
    });

    if (error) {
      console.error('Error sending notification:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось отправить уведомление",
        variant: "destructive",
      });
      return;
    }

    if (data && !data.success) {
      toast({
        title: "Ошибка",
        description: data.message || "Не удалось отправить уведомление",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Успешно",
      description: targetType === "all" 
        ? "Уведомление отправлено всем пользователям"
        : "Уведомление отправлено пользователю",
    });

    setMessage("");
    setTargetType("all");
    setSelectedUserId("");
    setSelectedTemplate("");
  };

  const handleTemplateSelect = (templateText: string) => {
    setSelectedTemplate(templateText);
    setMessage(templateText);
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div>
          <Label>Шаблоны сообщений</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {MESSAGE_TEMPLATES.map((template) => (
              <Button
                key={template.label}
                variant="outline"
                size="sm"
                onClick={() => handleTemplateSelect(template.text)}
                className={selectedTemplate === template.text ? "border-primary" : ""}
              >
                {template.label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label>Кому отправить</Label>
          <RadioGroup value={targetType} onValueChange={(v) => setTargetType(v as "all" | "specific")}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="all" />
              <Label htmlFor="all">Всем пользователям</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="specific" id="specific" />
              <Label htmlFor="specific">Конкретному пользователю</Label>
            </div>
          </RadioGroup>
        </div>

        {targetType === "specific" && (
          <div>
            <Label>Пользователь</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите пользователя" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <Label>Текст уведомления</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Введите текст уведомления..."
            rows={4}
          />
        </div>

        <Button onClick={sendNotification} className="w-full">
          Отправить уведомление
        </Button>
      </div>
    </Card>
  );
};
