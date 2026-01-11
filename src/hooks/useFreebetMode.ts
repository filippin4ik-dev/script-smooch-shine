// Legacy re-export for backward compatibility
// Games should continue to use useFreebetMode which now wraps useBalanceMode
import { useBalanceMode } from "./useBalanceMode";

export const useFreebetMode = () => {
  const { mode, setMode, useFreebet, setUseFreebet, useDemo } = useBalanceMode();
  return { 
    useFreebet, 
    setUseFreebet, 
    useDemo,
    mode, 
    setMode 
  };
};
