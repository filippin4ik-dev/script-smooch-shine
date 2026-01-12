import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface EmailRequiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EmailRequiredDialog = ({ open, onOpenChange }: EmailRequiredDialogProps) => {
  const navigate = useNavigate();

  const handleGoToProfile = () => {
    onOpenChange(false);
    navigate("/profile");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
            <Mail className="w-8 h-8 text-amber-500" />
          </div>
          <DialogTitle className="text-center text-xl">
            Требуется привязка почты
          </DialogTitle>
          <DialogDescription className="text-center">
            Для размещения ставок необходимо подтвердить email адрес. Это помогает защитить ваш аккаунт.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border/50">
            <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0" />
            <span className="text-sm text-muted-foreground">
              Подтверждённый email гарантирует безопасность ваших средств
            </span>
          </div>

          <Button 
            onClick={handleGoToProfile} 
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
          >
            <Mail className="w-4 h-4 mr-2" />
            Привязать почту
          </Button>
          
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Позже
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
