import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare } from "lucide-react";
import { useTelegramAuth } from "@/hooks/useTelegramAuth";

export function SupportTicketsAdmin() {
  const queryClient = useQueryClient();
  const { user } = useTelegramAuth();
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [replyMessage, setReplyMessage] = useState("");

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["admin-support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select(`
          *,
          profiles!support_tickets_user_id_fkey(username)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching tickets:", error);
        throw error;
      }
      console.log("Fetched tickets:", data);
      return data;
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["admin-support-messages", selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket?.id) return [];
      
      const { data, error } = await supabase
        .from("support_messages")
        .select(`
          *,
          profiles!support_messages_user_id_fkey(username)
        `)
        .eq("ticket_id", selectedTicket.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
        throw error;
      }
      return data;
    },
    enabled: !!selectedTicket?.id,
  });

  // Realtime subscription for tickets
  useEffect(() => {
    const channel = supabase
      .channel('admin-support-tickets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_tickets'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!selectedTicket?.id) return;

    const channel = supabase
      .channel('admin-support-messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${selectedTicket.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-support-messages", selectedTicket.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTicket?.id, queryClient]);

  const updateStatus = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", ticketId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      toast.success("Статус обновлен");
    },
    onError: () => {
      toast.error("Ошибка обновления статуса");
    },
  });

  const sendReply = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error("Не авторизован");
      }

      const { error } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: selectedTicket.id,
          user_id: user.id,
          message: replyMessage,
          is_admin: true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-support-messages"] });
      setReplyMessage("");
      toast.success("Ответ отправлен");
    },
    onError: () => {
      toast.error("Ошибка отправки");
    },
  });

  const deleteTicket = useMutation({
    mutationFn: async (ticketId: string) => {
      // Delete messages first
      const { error: messagesError } = await supabase
        .from("support_messages")
        .delete()
        .eq("ticket_id", ticketId);

      if (messagesError) throw messagesError;

      // Delete ticket
      const { error: ticketError } = await supabase
        .from("support_tickets")
        .delete()
        .eq("id", ticketId);

      if (ticketError) throw ticketError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      setSelectedTicket(null);
      toast.success("Тикет удален");
    },
    onError: () => {
      toast.error("Ошибка удаления тикета");
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  const openTickets = tickets?.filter(t => t.status === "open") || [];
  const inProgressTickets = tickets?.filter(t => t.status === "in_progress") || [];
  const closedTickets = tickets?.filter(t => t.status === "closed") || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="text-2xl font-bold text-green-500">{openTickets.length}</div>
          <div className="text-sm text-muted-foreground">Открытых тикетов</div>
        </div>
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="text-2xl font-bold text-yellow-500">{inProgressTickets.length}</div>
          <div className="text-sm text-muted-foreground">В работе</div>
        </div>
        <div className="p-4 bg-muted/20 border border-border rounded-lg">
          <div className="text-2xl font-bold">{closedTickets.length}</div>
          <div className="text-sm text-muted-foreground">Закрытых</div>
        </div>
      </div>

      {tickets && tickets.length > 0 ? (
        <div className="space-y-3">
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
                      <div>
                        <h3 className="font-bold">{ticket.subject}</h3>
                        <p className="text-sm text-muted-foreground">
                          От: {ticket.profiles?.username || "Неизвестно"}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        ticket.status === "open"
                          ? "default"
                          : ticket.status === "in_progress"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {ticket.status === "open"
                        ? "Открыт"
                        : ticket.status === "in_progress"
                        ? "В работе"
                        : "Закрыт"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {new Date(ticket.created_at).toLocaleString("ru-RU")}
                  </p>
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between">
                    <span>{ticket.subject}</span>
                    <div className="flex items-center gap-2">
                      <Select
                        value={ticket.status}
                        onValueChange={(value) =>
                          updateStatus.mutate({ ticketId: ticket.id, status: value })
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Открыт</SelectItem>
                          <SelectItem value="in_progress">В работе</SelectItem>
                          <SelectItem value="closed">Закрыт</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (confirm("Удалить тикет?")) {
                            deleteTicket.mutate(ticket.id);
                          }
                        }}
                      >
                        🗑️
                      </Button>
                    </div>
                  </DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {messages?.map((msg: any) => (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-lg ${
                          msg.is_admin ? "bg-primary/10 ml-8" : "bg-muted mr-8"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-sm">
                            {msg.is_admin ? "🛡️ Поддержка" : msg.profiles?.username || "Пользователь"}
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
                {ticket.status !== "closed" && (
                  <div className="flex gap-2 mt-4">
                    <Textarea
                      placeholder="Ваш ответ..."
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      rows={3}
                      className="flex-1"
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
        <div className="text-center py-8 text-muted-foreground">Тикетов пока нет</div>
      )}
    </div>
  );
}
