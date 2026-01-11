import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Smartphone } from "lucide-react";

interface SessionKickedDialogProps {
  open: boolean;
  onReconnect: () => void;
}

export const SessionKickedDialog = ({ open, onReconnect }: SessionKickedDialogProps) => {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-foreground">
            <Smartphone className="h-5 w-5 text-destructive" />
            Сессия завершена
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            Вы вошли в аккаунт с другого устройства. В целях безопасности, 
            одновременно может быть активна только одна сессия.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction 
            onClick={onReconnect}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Войти снова
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
