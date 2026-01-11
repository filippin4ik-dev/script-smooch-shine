import { cn } from "@/lib/utils";
import { Mail, Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VerifiedBadgeProps {
  className?: string;
  showTooltip?: boolean;
}

export const VerifiedBadge = ({ className, showTooltip = true }: VerifiedBadgeProps) => {
  const badge = (
    <div
      className={cn(
        "inline-flex items-center justify-center w-5 h-5 rounded-full",
        "bg-gradient-to-br from-blue-500 via-cyan-400 to-teal-500",
        "shadow-md shadow-cyan-500/30",
        className
      )}
    >
      <Check className="h-3 w-3 text-white stroke-[3]" />
    </div>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-gradient-to-r from-blue-600 to-cyan-600 border-0">
          <div className="flex items-center gap-1.5 text-white">
            <Mail className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Подтвержденная почта</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
