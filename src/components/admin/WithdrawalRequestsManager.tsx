import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, CreditCard, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/components/AuthGuard";

interface WithdrawalRequest {
  id: string;
  user_id: string;
  username: string;
  amount: number;
  payment_method: string;
  payment_details: string;
  comment: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export function WithdrawalRequestsManager() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: requests, isLoading } = useQuery({
    queryKey: ["withdrawal-requests-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_withdrawal_requests_v3", {
        _admin_id: user?.id
      });

      if (error) {
        console.error("Withdrawal requests error:", error);
        throw error;
      }
      return (data || []) as WithdrawalRequest[];
    },
    enabled: !!user?.id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase.rpc("admin_update_withdrawal_status", {
        _admin_id: user?.id,
        _request_id: id,
        _new_status: status,
      });

      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.message);
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["withdrawal-requests-admin"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(
        variables.status === "approved" 
          ? "Заявка одобрена, средства списаны" 
          : "Заявка отклонена"
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Ошибка при обновлении статуса");
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requests?.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Нет заявок</p>
      ) : (
        <div className="space-y-3">
          {requests?.map((request) => (
            <Card key={request.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {request.username}
                    </span>
                    <Badge
                      variant={
                        request.status === "approved"
                          ? "default"
                          : request.status === "rejected"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {request.status === "pending"
                        ? "Ожидает"
                        : request.status === "approved"
                        ? "Одобрено"
                        : "Отклонено"}
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold text-primary">
                    {request.amount.toFixed(2)}₽
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      {request.payment_method === 'sbp' ? (
                        <Smartphone className="w-4 h-4 text-primary" />
                      ) : (
                        <CreditCard className="w-4 h-4 text-primary" />
                      )}
                      <span className="text-muted-foreground">Реквизиты: </span>
                      <span className="font-medium">{request.payment_details}</span>
                    </div>
                    {request.comment && (
                      <div>
                        <span className="text-muted-foreground">Комментарий: </span>
                        <span>{request.comment}</span>
                      </div>
                    )}
                    <div className="text-muted-foreground">
                      {format(new Date(request.created_at), "dd.MM.yyyy HH:mm")}
                    </div>
                  </div>
                </div>

                {request.status === "pending" && (
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        updateStatusMutation.mutate({
                          id: request.id,
                          status: "approved",
                        })
                      }
                      disabled={updateStatusMutation.isPending}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Одобрить
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        updateStatusMutation.mutate({
                          id: request.id,
                          status: "rejected",
                        })
                      }
                      disabled={updateStatusMutation.isPending}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Отклонить
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}