import { useState, useRef } from "react";
import { Copy, Pencil, Check, X, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VipUsername, GradientColor } from "@/components/VipUsername";
import { AdminProfileBadge } from "@/components/AdminProfileBadge";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { AnimatedProfileBackground, ProfileBackground } from "@/components/AnimatedProfileBackground";
import { BalanceSwitcher } from "@/components/BalanceSwitcher";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ProfileCardProps {
  profile: any;
  isAdmin: boolean;
  onUpdateUsername: (username: string) => void;
  isUpdating?: boolean;
  onAvatarUpdated?: () => void;
}

export const ProfileCard = ({ profile, isAdmin, onUpdateUsername, isUpdating, onAvatarUpdated }: ProfileCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopyProfileLink = () => {
    if (profile?.public_id) {
      const link = `https://t.me/casinocasino123_bot/casic?startapp=profile_${profile.public_id}`;
      navigator.clipboard.writeText(link);
      toast.success("Ссылка скопирована!");
    }
  };

  const handleSave = () => {
    if (newUsername.trim()) {
      onUpdateUsername(newUsername.trim());
      setIsEditing(false);
      setNewUsername("");
    }
  };

  const handleAvatarClick = () => {
    if (isAdmin && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Выберите изображение");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Максимальный размер 2MB");
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with avatar URL (add cache-busting param)
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      toast.success("Аватарка обновлена!");
      onAvatarUpdated?.();
    } catch (error: any) {
      console.error("Avatar upload error:", error);
      toast.error("Ошибка загрузки: " + error.message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-card to-card/50 border border-border/50">
      {/* Animated background */}
      <AnimatedProfileBackground 
        background={(profile?.profile_background as ProfileBackground) || "none"} 
      />

      <div className="relative z-10 p-6">
        {/* Avatar + VIP badge */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            {/* Avatar with upload for admin */}
            <div 
              className={cn(
                "relative w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold overflow-hidden",
                "bg-gradient-to-br from-primary/30 to-purple-500/30",
                "border-2 border-primary/50",
                "shadow-[0_0_20px_hsl(var(--primary)/0.3)]",
                isAdmin && "cursor-pointer group"
              )}
              onClick={handleAvatarClick}
            >
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                />
              ) : (
                profile?.username?.charAt(0)?.toUpperCase() || "?"
              )}
              
              {/* Upload overlay for admin */}
              {isAdmin && (
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {isUploadingAvatar ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6 text-white" />
                  )}
                </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            
            <div>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Новое имя"
                    className="h-8 w-32 bg-background/50"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSave} disabled={isUpdating}>
                    <Check className="w-4 h-4 text-primary" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsEditing(false)}>
                    <X className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <VipUsername 
                    username={profile?.username || ""} 
                    isAdmin={isAdmin}
                    isVip={profile?.is_vip}
                    gradientColor={(profile?.gradient_color as GradientColor) || "gold"}
                    level={profile?.level}
                    showLevel={true}
                    className="text-xl font-bold"
                  />
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-6 w-6 opacity-50 hover:opacity-100"
                    onClick={() => {
                      setNewUsername(profile?.username || "");
                      setIsEditing(true);
                    }}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                </div>
              )}
              
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">ID: {profile?.public_id}</span>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-5 w-5 opacity-50 hover:opacity-100"
                  onClick={handleCopyProfileLink}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {profile?.email_verified_at && <VerifiedBadge />}
              {profile?.is_vip && (
                <div className="px-3 py-1 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50">
                  <span className="text-xs font-bold text-yellow-400">⭐ VIP</span>
                </div>
              )}
            </div>
            {isAdmin && <AdminProfileBadge variant="compact" />}
          </div>
        </div>

        {/* Balance Switcher */}
        <BalanceSwitcher
          balance={profile?.balance || 0}
          freebetBalance={profile?.freebet_balance || 0}
          demoBalance={profile?.demo_balance || 0}
        />
      </div>
    </div>
  );
};
