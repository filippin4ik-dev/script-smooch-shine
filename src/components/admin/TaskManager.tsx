import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Target } from "lucide-react";

interface TaskManagerProps {
  adminId: string;
}

const taskTypes = [
  { value: "game_wins", label: "Победы в играх" },
  { value: "total_bet", label: "Сумма ставок" },
  { value: "daily_login", label: "Ежедневный вход" },
  { value: "referral", label: "Рефералы" },
  { value: "deposit", label: "Депозиты" },
  { value: "custom", label: "Другое" },
];

const gameOptions = [
  { value: "", label: "Все игры" },
  { value: "slots", label: "Слоты" },
  { value: "dogs-house-slots", label: "Dogs House" },
  { value: "mines", label: "Mines" },
  { value: "crash", label: "Crash" },
  { value: "dice", label: "Dice" },
  { value: "roulette", label: "Рулетка" },
  { value: "blackjack", label: "Блэкджек" },
  { value: "hilo", label: "HiLo" },
  { value: "plinko", label: "Plinko" },
  { value: "towers", label: "Towers" },
  { value: "balloon", label: "Balloon" },
  { value: "cases", label: "Кейсы" },
  { value: "chicken-road", label: "Chicken Road" },
  { value: "penalty", label: "Penalty" },
  { value: "horse-racing", label: "Скачки" },
  { value: "crypto-trading", label: "Crypto Trading" },
];

const rewardTypes = [
  { value: "wins", label: "Победы (турнир)" },
  { value: "buff_x2", label: "Бафф x2" },
  { value: "buff_x3", label: "Бафф x3" },
  { value: "buff_x5", label: "Бафф x5" },
  { value: "buff_x10", label: "Бафф x10" },
  { value: "freebet", label: "Фрибет" },
  { value: "betting_freebet", label: "Беттинг фрибет" },
  { value: "wheel", label: "Колесо удачи" },
  { value: "freespins", label: "Фриспины" },
  { value: "balance", label: "Баланс" },
];

export const TaskManager = ({ adminId }: TaskManagerProps) => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState("game_wins");
  const [targetValue, setTargetValue] = useState("10");
  const [targetGame, setTargetGame] = useState("");
  const [rewardType, setRewardType] = useState("wins");
  const [rewardAmount, setRewardAmount] = useState("100");
  const [buffDuration, setBuffDuration] = useState("24");
  const [isDaily, setIsDaily] = useState(false);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["admin-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const createTask = useMutation({
    mutationFn: async () => {
      const gameValue = targetGame === "all" ? "" : targetGame;
      const { data, error } = await supabase.rpc("admin_create_task", {
        _admin_id: adminId,
        _title: title,
        _description: description || null,
        _task_type: taskType,
        _target_value: parseFloat(targetValue),
        _target_game: gameValue || null,
        _reward_type: rewardType,
        _reward_amount: parseFloat(rewardAmount),
        _buff_duration_hours: parseInt(buffDuration),
        _is_daily: isDaily,
        _sort_order: 0,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast.success("Задание создано");
        queryClient.invalidateQueries({ queryKey: ["admin-tasks"] });
        setTitle("");
        setDescription("");
        setTargetValue("10");
        setRewardAmount("100");
      } else {
        toast.error(data?.message || "Ошибка");
      }
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { data, error } = await supabase.rpc("admin_delete_task", {
        _admin_id: adminId,
        _task_id: taskId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Задание удалено");
      queryClient.invalidateQueries({ queryKey: ["admin-tasks"] });
    },
  });

  const toggleTask = useMutation({
    mutationFn: async ({ taskId, isActive }: { taskId: string; isActive: boolean }) => {
      const { data, error } = await supabase.rpc("admin_toggle_task", {
        _admin_id: adminId,
        _task_id: taskId,
        _is_active: isActive,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tasks"] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5" />
          Управление заданиями
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Форма создания */}
        <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
          <div className="col-span-2">
            <Label>Название</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Выиграй 10 раз" />
          </div>
          <div className="col-span-2">
            <Label>Описание</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Опционально" />
          </div>
          <div>
            <Label>Тип задания</Label>
            <Select value={taskType} onValueChange={setTaskType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {taskTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Цель</Label>
            <Input type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
          </div>
          <div>
            <Label>Игра (для побед)</Label>
            <Select value={targetGame} onValueChange={setTargetGame}>
              <SelectTrigger><SelectValue placeholder="Выберите игру" /></SelectTrigger>
              <SelectContent>
                {gameOptions.map((g) => (
                  <SelectItem key={g.value} value={g.value || "all"}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Тип награды</Label>
            <Select value={rewardType} onValueChange={setRewardType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {rewardTypes.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Количество награды</Label>
            <Input type="number" value={rewardAmount} onChange={(e) => setRewardAmount(e.target.value)} />
          </div>
          <div>
            <Label>Длительность баффа (часы)</Label>
            <Input type="number" value={buffDuration} onChange={(e) => setBuffDuration(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isDaily} onCheckedChange={setIsDaily} />
            <Label>Ежедневное</Label>
          </div>
          <div>
            <Button onClick={() => createTask.mutate()} disabled={!title || createTask.isPending}>
              <Plus className="w-4 h-4 mr-2" />
              Создать
            </Button>
          </div>
        </div>

        {/* Список заданий */}
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-muted-foreground">Загрузка...</p>
          ) : tasks?.length === 0 ? (
            <p className="text-muted-foreground">Нет заданий</p>
          ) : (
              tasks?.map((task: any) => (
              <div key={task.id} className={`p-3 border rounded-lg flex items-center justify-between ${task.is_active ? "" : "opacity-50"}`}>
                <div>
                  <div className="font-medium">{task.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {taskTypes.find((t) => t.value === task.task_type)?.label}
                    {task.target_game && ` (${gameOptions.find((g) => g.value === task.target_game)?.label || task.target_game})`}
                    {" → "}{rewardTypes.find((r) => r.value === task.reward_type)?.label}: {task.reward_amount}
                    {" | Цель: "}{task.target_value}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={task.is_active}
                    onCheckedChange={(checked) => toggleTask.mutate({ taskId: task.id, isActive: checked })}
                  />
                  <Button variant="destructive" size="icon" onClick={() => deleteTask.mutate(task.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
