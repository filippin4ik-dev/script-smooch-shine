import { useState, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Crosshair, Target, Zap, Swords, Scissors, Hand, Package } from "lucide-react";

interface SkinImageProps {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  fallbackIcon?: ReactNode;
  category?: string;
  skinName?: string;
  weaponName?: string;
}

const getCategoryIcon = (category?: string) => {
  const iconClass = "w-1/2 h-1/2 text-muted-foreground/50";
  switch (category) {
    case 'Пистолеты':
    case 'pistols':
      return <Crosshair className={iconClass} />;
    case 'Винтовки':
    case 'rifles':
      return <Target className={iconClass} />;
    case 'Снайперские':
    case 'snipers':
      return <Zap className={iconClass} />;
    case 'Пистолеты-пулемёты':
    case 'smgs':
      return <Swords className={iconClass} />;
    case 'Ножи':
    case 'knives':
      return <Scissors className={iconClass} />;
    case 'Перчатки':
    case 'gloves':
      return <Hand className={iconClass} />;
    default:
      return <Package className={iconClass} />;
  }
};

export const SkinImage = ({ 
  src, 
  alt = "", 
  className = "",
  fallbackIcon,
  category
}: SkinImageProps) => {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const imgSrc = (() => {
    if (!src) return src;
    try {
      const u = new URL(src);
      const host = u.hostname.replace(/^www\./, "");
      if (host === "csgodatabase.com") {
        const base = import.meta.env.VITE_SUPABASE_URL;
        return `${base}/functions/v1/image-proxy?url=${encodeURIComponent(src)}`;
      }
    } catch {
      // ignore
    }
    return src;
  })();

  // Reset states when src changes
  useEffect(() => {
    setError(false);
    setLoaded(false);
  }, [src]);

  if (!src || error) {
    return (
      <div className={cn("flex items-center justify-center bg-background/30", className)}>
        {fallbackIcon || getCategoryIcon(category)}
      </div>
    );
  }

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/30">
          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}
      <img
        src={imgSrc}
        alt={alt}
        className={cn(
          "max-w-full max-h-full object-contain transition-opacity",
          loaded ? "opacity-100" : "opacity-0"
        )}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
};
