import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Target, Gift, Sparkles, Trophy } from "lucide-react";
import { useEffect } from "react";

interface TasksListProps {
  userId: string;
}

const rewardTypeLabels: Record<string, string> = {
  wins: "Победы",
  buff_x2: "Бафф x2",
  buff_x3: "Бафф x3",
  buff_x5: "Бафф x5",
  buff_x10: "Бафф x10",
  freebet: "Фрибет",
  betting_freebet: "Беттинг фрибет",
  wheel: "Колесо удачи",
  freespins: "Фриспины",
  balance: "Баланс",
};

const rewardTypeColors: Record<string, string> = {
  wins: "text-yellow-400",
  buff_x2: "text-blue-400",
  buff_x3: "text-amber-400",
  buff_x5: "text-purple-400",
  buff_x10: "text-red-400",
  freebet: "text-green-400",
  betting_freebet: "text-emerald-400",
  wheel: "text-pink-400",
  freespins: "text-cyan-400",
  balance: "text-yellow-500",
};

export const TasksList = ({ userId }: TasksListProps) => {
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["user-tasks", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_tasks", {
        _user_id: userId,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Realtime subscription for task progress updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('task-progress-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_task_progress',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["user-tasks", userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const claimReward = useMutation({
    mutationFn: async (taskId: string) => {
      const { data, error } = await supabase.rpc("claim_task_reward", {
        _user_id: userId,
        _task_id: taskId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast.success(data.message);
        queryClient.invalidateQueries({ queryKey: ["user-tasks"] });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
      } else {
        toast.error(data?.message || "Ошибка");
      }
    },
    onError: () => {
      toast.error("Ошибка получения награды");
    },
  });

  if (isLoading) {
    return (
      <Card className="border-primary/20">
        <CardContent className="p-6 text-center text-muted-foreground">
          Загрузка заданий...
        </CardContent>
      </Card>
    );
  }

  if (!tasks || tasks.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Задания
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {tasks.map((task: any) => {
          const progressPercent = Math.min(
            (task.progress / task.target_value) * 100,
            100
          );

          return (
            <div
              key={task.id}
              className={`p-4 rounded-lg border transition-all duration-300 ${
                task.is_completed
                  ? "bg-green-500/10 border-green-500/30"
                  : task.can_claim
                  ? "bg-gradient-to-r from-yellow-500/20 via-amber-400/20 to-yellow-500/20 border-yellow-400 shadow-lg shadow-yellow-500/20 animate-pulse"
                  : "bg-card/50 border-border/50"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {task.is_daily && (
                      <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">
                        Ежедневно
                      </span>
                    )}
                    <h4 className="font-semibold">{task.title}</h4>
                  </div>
                  {task.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Gift className="w-4 h-4" />
                    <span className={rewardTypeColors[task.reward_type]}>
                      {rewardTypeLabels[task.reward_type] || task.reward_type}:{" "}
                      {task.reward_type.startsWith("buff_")
                        ? `${task.buff_duration_hours}ч`
                        : `+${task.reward_amount}`}
                    </span>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  {task.is_completed ? (
                    <div className="flex items-center gap-1 text-green-400">
                      <Trophy className="w-4 h-4" />
                      <span className="text-sm font-medium">Получено</span>
                    </div>
                  ) : task.can_claim ? (
                    <Button
                      size="sm"
                      onClick={() => claimReward.mutate(task.id)}
                      disabled={claimReward.isPending}
                      className="bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 hover:from-yellow-500 hover:via-amber-600 hover:to-yellow-500 text-black font-bold shadow-lg shadow-yellow-500/30 animate-bounce"
                    >
                      <Sparkles className="w-4 h-4 mr-1" />
                      Забрать награду!
                    </Button>
                  ) : (
                    <div className="text-sm text-muted-foreground font-medium">
                      {task.progress} / {task.target_value}
                    </div>
                  )}
                </div>
              </div>
              {!task.is_completed && (
                <div className="mt-3">
                  <Progress value={progressPercent} className="h-2" />
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
