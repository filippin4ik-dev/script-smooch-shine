import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AuthGuard } from "@/components/AuthGuard";
import { ArrowLeft, Plus, MessageSquare } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import casinoLogo from "/casino-logo.png";
import { useTelegramAuth } from "@/hooks/useTelegramAuth";

export default function Support() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [replyMessage, setReplyMessage] = useState("");

  const { user } = useTelegramAuth();
  const userId = user?.id;

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["support-tickets", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: messages } = useQuery({
    queryKey: ["support-messages", selectedTicket?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*, profiles(username)")
        .eq("ticket_id", selectedTicket.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedTicket?.id,
  });

  // Realtime subscription for tickets
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('support-tickets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_tickets',
          filter: `user_id=eq.${userId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!selectedTicket?.id) return;

    const channel = supabase
      .channel('support-messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${selectedTicket.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["support-messages", selectedTicket.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTicket?.id, queryClient]);

  const createTicket = useMutation({
    mutationFn: async () => {
      if (!userId) {
        throw new Error("Пользователь не авторизован");
      }

      const { data: ticket, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({
          user_id: userId,
          subject,
          status: "open",
        })
        .select()
        .single();

      if (ticketError) {
        console.error("Ticket creation error:", ticketError);
        throw ticketError;
      }

      const { error: messageError } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: ticket.id,
          user_id: userId,
          message,
          is_admin: false,
        });

      if (messageError) throw messageError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      toast.success("Тикет создан");
      setSubject("");
      setMessage("");
      setIsCreateOpen(false);
    },
    onError: () => {
      toast.error("Ошибка создания тикета");
    },
  });

  const sendReply = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: selectedTicket.id,
          user_id: userId,
          message: replyMessage,
          is_admin: false,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-messages"] });
      setReplyMessage("");
      toast.success("Сообщение отправлено");
    },
    onError: () => {
      toast.error("Ошибка отправки");
    },
  });

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-dark p-4">
        <div className="max-w-4xl mx-auto">
          <Button
            onClick={() => navigate("/")}
            variant="ghost"
            className="mb-6 hover:bg-primary/10"
          >
            <ArrowLeft className="mr-2 w-4 h-4" />
            Назад
          </Button>

          <Card className="p-8 bg-card/80 backdrop-blur-xl border-primary/20 shadow-neon-blue">
            <div className="text-center mb-8">
              <img
                src={casinoLogo}
                alt="Casino"
                className="w-16 h-16 mx-auto mb-4 rounded-xl shadow-gold"
              />
              <h1 className="text-3xl font-black text-primary mb-2">Техподдержка</h1>
              <p className="text-muted-foreground">Создайте тикет, и мы вам поможем</p>
            </div>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="w-full mb-6">
                  <Plus className="mr-2 w-4 h-4" />
                  Создать тикет
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Новый тикет</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Тема</label>
                    <Input
                      placeholder="Опишите проблему кратко"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Сообщение</label>
                    <Textarea
                      placeholder="Опишите проблему подробно"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={6}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => createTicket.mutate()}
                    disabled={!subject.trim() || !message.trim() || createTicket.isPending}
                  >
                    Отправить
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {isLoading ? (
              <div className="text-center py-8">Загрузка...</div>
            ) : tickets && tickets.length > 0 ? (
              <div className="space-y-4">
                {tickets.map((ticket) => (
                  <Dialog key={ticket.id}>
                    <DialogTrigger asChild>
                      <button
                        className="w-full bg-gradient-card border border-primary/30 rounded-lg p-4 hover:border-primary/50 transition-all text-left"
                        onClick={() => setSelectedTicket(ticket)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-primary" />
                            <h3 className="font-bold">{ticket.subject}</h3>
                          </div>
                          <Badge variant={ticket.status === "open" ? "default" : "secondary"}>
                            {ticket.status === "open" ? "Открыт" : ticket.status === "closed" ? "Закрыт" : "В работе"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(ticket.created_at).toLocaleString("ru-RU")}
                        </p>
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle>{ticket.subject}</DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-4">
                          {messages?.map((msg: any) => (
                            <div
                              key={msg.id}
                              className={`p-3 rounded-lg ${
                                msg.is_admin
                                  ? "bg-primary/10 ml-8"
                                  : "bg-muted mr-8"
                              }`}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-medium text-sm">
                                  {msg.is_admin ? "Поддержка" : msg.profiles?.username || "Вы"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(msg.created_at).toLocaleString("ru-RU")}
                                </span>
                              </div>
                              <p className="text-sm">{msg.message}</p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      {ticket.status === "open" && (
                        <div className="flex gap-2 mt-4">
                          <Textarea
                            placeholder="Ваш ответ..."
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                            rows={3}
                          />
                          <Button
                            onClick={() => sendReply.mutate()}
                            disabled={!replyMessage.trim() || sendReply.isPending}
                          >
                            Отправить
                          </Button>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                У вас пока нет тикетов
              </div>
            )}
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
}
