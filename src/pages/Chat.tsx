import { AuthGuard, useAuth } from "@/components/AuthGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import { markMessagesAsRead } from "@/hooks/useUnreadMessages";
import { VipUsername, GradientColor } from "@/components/VipUsername";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { X, Reply } from "lucide-react";

const Chat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [mutedUntil, setMutedUntil] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [replyTo, setReplyTo] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Check mute status
  useEffect(() => {
    if (!user?.id) return;

    const checkMuteStatus = async () => {
      const { data } = await supabase
        .from("user_moderation")
        .select("muted_until")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (data?.muted_until) {
        const muteTime = new Date(data.muted_until);
        if (muteTime > new Date()) {
          setMutedUntil(muteTime);
        } else {
          setMutedUntil(null);
        }
      } else {
        setMutedUntil(null);
      }
    };

    checkMuteStatus();

    // Realtime subscription for mute changes
    const channel = supabase
      .channel('mute-status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_moderation',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          checkMuteStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Update countdown timer
  useEffect(() => {
    if (!mutedUntil) {
      setTimeLeft("");
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const diff = mutedUntil.getTime() - now.getTime();

      if (diff <= 0) {
        setMutedUntil(null);
        setTimeLeft("");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [mutedUntil]);

  // Mark messages as read when entering chat
  useEffect(() => {
    if (user?.id) {
      markMessagesAsRead(user.id);
    }
  }, [user?.id]);

  const { data: messages } = useQuery({
    queryKey: ["chat-messages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*, profiles(username, is_vip, level, gradient_color, public_id, email_verified_at, user_roles(role)), reply_to:reply_to_id(id, message, profiles(username))")
        .order("created_at", { ascending: false })
        .limit(100);
      // Reverse to show oldest first but we fetched newest first
      return (data || []).reverse();
    },
    refetchInterval: 2000,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("chat")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Track scroll position
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      setIsAtBottom(scrollHeight - scrollTop - clientHeight < 50);
    }
  };

  // Auto scroll only when at bottom
  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAtBottom]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (messages && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, []);

  const sendMessage = useMutation({
    mutationFn: async (text: string) => {
      if (!user?.id || !text.trim()) return;

      // Check if user can send messages (email verified)
      const { data: canSend } = await supabase.rpc("can_send_chat_message", { _user_id: user.id });
      if (canSend && !canSend.can_send) {
        throw new Error(canSend.reason || "Нельзя отправить сообщение");
      }

      const { error } = await supabase.from("chat_messages").insert({
        user_id: user.id,
        message: text.trim(),
        reply_to_id: replyTo?.id || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setMessage("");
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Ошибка отправки сообщения");
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      sendMessage.mutate(message);
    }
  };

  const handleReply = (msg: any) => {
    setReplyTo(msg);
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get last 7 messages to display (but user can scroll to see more)
  const displayMessages = messages || [];

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
        <header className="border-b border-border/50 bg-card/50 backdrop-blur">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-primary">💬 Общий чат</h1>
            <Button onClick={() => navigate("/")} variant="outline">
              ← Назад
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <Card className="border-border/50 shadow-gold h-[70vh] flex flex-col">
            <CardHeader>
              <CardTitle>Чат всех игроков</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
              <div 
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto space-y-3 pr-2 touch-pan-y"
                style={{ maxHeight: 'calc(70vh - 200px)' }}
              >
                {displayMessages.map((msg: any) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg relative group ${
                      msg.user_id === user?.id
                        ? "bg-primary/20 ml-auto max-w-[80%]"
                        : "bg-muted/30 max-w-[80%]"
                    }`}
                  >
                    {/* Reply preview */}
                    {msg.reply_to && (
                      <div className="mb-2 pl-2 border-l-2 border-primary/50 text-xs text-muted-foreground bg-background/30 rounded p-1">
                        <span className="font-semibold text-primary/80">
                          {msg.reply_to.profiles?.username || "Игрок"}:
                        </span>{" "}
                        <span className="line-clamp-1">{msg.reply_to.message}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 mb-1">
                      <Link 
                        to={`/player/${msg.profiles?.public_id}`}
                        className="font-bold text-sm hover:text-primary transition-colors cursor-pointer"
                      >
                        <VipUsername 
                          username={msg.profiles?.username || "Игрок"}
                          isAdmin={msg.profiles?.user_roles?.some((r: any) => r.role === "admin")}
                          isVip={msg.profiles?.is_vip}
                          gradientColor={msg.profiles?.gradient_color as GradientColor}
                          level={msg.profiles?.level}
                          showLevel={true}
                        />
                      </Link>
                      {msg.profiles?.email_verified_at && (
                        <VerifiedBadge showTooltip={false} className="w-4 h-4" />
                      )}
                      {msg.profiles?.user_roles?.some(
                        (r: any) => r.role === "admin"
                      ) && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                          ADMIN
                        </span>
                      )}
                      {msg.profiles?.is_vip && !msg.profiles?.user_roles?.some((r: any) => r.role === "admin") && (
                        <span className="text-xs bg-gradient-to-r from-yellow-500 to-amber-500 text-white px-2 py-0.5 rounded">
                          VIP
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                    <p className="text-sm break-words">{msg.message}</p>
                    
                    {/* Reply button */}
                    {msg.user_id !== user?.id && (
                      <button
                        onClick={() => handleReply(msg)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-background/50 hover:bg-background"
                      >
                        <Reply className="h-4 w-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {mutedUntil && mutedUntil > new Date() ? (
                <div className="flex items-center justify-center p-4 bg-destructive/10 rounded-lg">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">Вы в муте</p>
                    <p className="text-3xl font-mono font-bold text-destructive animate-pulse">
                      {timeLeft}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Reply indicator */}
                  {replyTo && (
                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg text-sm">
                      <Reply className="h-4 w-4 text-primary" />
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-primary">
                          {replyTo.profiles?.username || "Игрок"}:
                        </span>{" "}
                        <span className="text-muted-foreground line-clamp-1">
                          {replyTo.message}
                        </span>
                      </div>
                      <button
                        onClick={() => setReplyTo(null)}
                        className="p-1 rounded hover:bg-background"
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                  
                  <form onSubmit={handleSend} className="flex gap-2">
                    <Input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={replyTo ? "Написать ответ..." : "Введите сообщение..."}
                      maxLength={500}
                      className="bg-input"
                    />
                    <Button
                      type="submit"
                      disabled={!message.trim() || sendMessage.isPending}
                    >
                      Отправить
                    </Button>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </AuthGuard>
  );
};

export default Chat;