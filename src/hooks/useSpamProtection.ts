import { useState, useCallback } from "react";
import { toast } from "sonner";

export const useSpamProtection = (delayMs: number = 1000) => {
  const [lastAction, setLastAction] = useState<number>(0);

  const canAct = useCallback(() => {
    const now = Date.now();
    if (now - lastAction < delayMs) {
      toast.error("Пожалуйста, подождите немного");
      return false;
    }
    setLastAction(now);
    return true;
  }, [lastAction, delayMs]);

  return { canAct };
};
