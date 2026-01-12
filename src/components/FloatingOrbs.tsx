import { cn } from "@/lib/utils";

export const FloatingOrbs = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Large ambient orbs */}
      <div 
        className={cn(
          "absolute w-96 h-96 rounded-full",
          "bg-gradient-to-br from-primary/20 to-transparent",
          "blur-3xl animate-orb-float",
          "-top-48 -left-48"
        )}
        style={{ animationDelay: "0s" }}
      />
      
      <div 
        className={cn(
          "absolute w-80 h-80 rounded-full",
          "bg-gradient-to-br from-secondary/15 to-transparent",
          "blur-3xl animate-orb-float",
          "top-1/3 -right-40"
        )}
        style={{ animationDelay: "-3s" }}
      />
      
      <div 
        className={cn(
          "absolute w-72 h-72 rounded-full",
          "bg-gradient-to-br from-accent/10 to-transparent",
          "blur-3xl animate-orb-float",
          "bottom-20 left-1/4"
        )}
        style={{ animationDelay: "-5s" }}
      />
      
      {/* Smaller accent orbs */}
      <div 
        className={cn(
          "absolute w-40 h-40 rounded-full",
          "bg-gradient-to-br from-primary/30 to-secondary/20",
          "blur-2xl animate-float-slow",
          "top-20 right-1/3"
        )}
        style={{ animationDelay: "-2s" }}
      />
      
      <div 
        className={cn(
          "absolute w-32 h-32 rounded-full",
          "bg-gradient-to-br from-accent/25 to-transparent",
          "blur-2xl animate-float-slow",
          "bottom-1/3 right-20"
        )}
        style={{ animationDelay: "-4s" }}
      />
    </div>
  );
};
