import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const BanImage = ({ userId }: { userId?: string }) => {
  const [imageUrl, setImageUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [banReason, setBanReason] = useState<string>("");

  useEffect(() => {
    if (userId) {
      fetchBanReason();
    }
    generateBanImage();
  }, [userId]);

  const fetchBanReason = async () => {
    if (!userId) return;
    
    const { data } = await supabase
      .from("user_moderation")
      .select("ban_reason")
      .eq("user_id", userId)
      .single();
    
    if (data?.ban_reason) {
      setBanReason(data.ban_reason);
    }
  };

  const generateBanImage = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-ban-image');
      
      if (error) {
        console.error('Error generating ban image:', error);
        setImageUrl("");
        setLoading(false);
        return;
      }

      if (data?.imageUrl) {
        setImageUrl(data.imageUrl);
      }
      setLoading(false);
    } catch (err) {
      console.error('Error:', err);
      setImageUrl("");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] bg-red-600 flex items-center justify-center">
        <div className="animate-spin rounded-full h-20 w-20 border-4 border-white border-t-transparent"></div>
      </div>
    );
  }

  if (imageUrl) {
    return (
      <div className="fixed inset-0 z-[9999]">
        <img 
          src={imageUrl} 
          alt="Вы забанены" 
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Fallback - простой красный экран с текстом
  return (
    <div className="fixed inset-0 z-[9999] bg-red-600 flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-2xl">
        <div className="text-white space-y-3">
          <h1 className="text-4xl md:text-6xl font-black drop-shadow-2xl">
            ВЫ ЗАБАНЕНЫ
          </h1>
          <div className="h-1 w-full bg-white/30 rounded-full"></div>
          {banReason && (
            <div className="bg-white/10 backdrop-blur p-4 rounded-lg">
              <p className="text-lg md:text-xl font-semibold mb-1">Причина:</p>
              <p className="text-base md:text-lg">{banReason}</p>
            </div>
          )}
          <p className="text-xl md:text-2xl font-bold">
            Напишите администратору
          </p>
        </div>
      </div>
    </div>
  );
};
