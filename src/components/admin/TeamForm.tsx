import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface TeamFormProps {
  onClose: () => void;
  adminId: string;
}

export const TeamForm = ({ onClose, adminId }: TeamFormProps) => {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    logo_url: "",
    sport: "football",
  });

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast.error("Введите название команды");
      return false;
    }
    if (formData.name.length > 100) {
      toast.error("Название слишком длинное (макс 100 символов)");
      return false;
    }
    if (!formData.logo_url.trim()) {
      toast.error("Введите URL логотипа");
      return false;
    }
    if (formData.logo_url.length > 500) {
      toast.error("URL логотипа слишком длинный");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.rpc("admin_create_team", {
        _admin_id: adminId,
        _name: formData.name.trim(),
        _logo_url: formData.logo_url.trim(),
        _sport: formData.sport,
      });

      if (error) {
        console.error("Team creation error:", error);
        toast.error(`Ошибка: ${error.message}`);
        return;
      }

      if (!data?.success) {
        toast.error(data?.message || "Ошибка создания команды");
        return;
      }

      toast.success("Команда создана!");
      queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
      setFormData({ name: "", logo_url: "", sport: "football" });
      onClose();
    } catch (error: any) {
      console.error("Unexpected error:", error);
      toast.error("Произошла ошибка");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 sm:p-4 bg-muted/20 rounded-lg space-y-3">
      <div className="space-y-2">
        <Label htmlFor="team-name">Название команды *</Label>
        <Input
          id="team-name"
          placeholder="Например: Спартак"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          maxLength={100}
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="team-logo">URL логотипа *</Label>
        <Input
          id="team-logo"
          type="url"
          placeholder="https://example.com/logo.png"
          value={formData.logo_url}
          onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
          maxLength={500}
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="team-sport">Вид спорта *</Label>
        <select
          id="team-sport"
          className="w-full p-2 rounded-lg bg-background border border-border text-sm"
          value={formData.sport}
          onChange={(e) => setFormData({ ...formData, sport: e.target.value })}
          disabled={isLoading}
        >
          <option value="football">⚽ Футбол</option>
          <option value="csgo">🔫 CS:GO</option>
          <option value="dota2">🎮 Dota 2</option>
        </select>
      </div>

      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={isLoading}>
          {isLoading ? "Создание..." : "✓ Создать команду"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
          Отмена
        </Button>
      </div>
    </form>
  );
};
