import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ProfileHeaderProps {
  onSettingsClick?: () => void;
}

export const ProfileHeader = ({ onSettingsClick }: ProfileHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate("/")}
          className="hover:bg-primary/10"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        
        <h1 className="text-lg font-bold">Профиль</h1>
        
        {onSettingsClick ? (
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onSettingsClick}
            className="hover:bg-primary/10"
          >
            <Settings className="w-5 h-5" />
          </Button>
        ) : (
          <div className="w-10" />
        )}
      </div>
    </header>
  );
};
