import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const ALLOWED_TABLES = [
  "skins",
  "transactions", 
  "game_history",
  "game_sessions",
  "crash_rounds",
  "crash_bets",
  "chat_messages",
  "achievements",
  "case_items",
  "case_types",
  "profiles",
  "user_roles",
  "user_moderation",
  "withdrawal_requests",
];

interface ImportResult {
  success: boolean;
  table: string;
  total: number;
  inserted: number;
  errors?: string[];
}

export function BulkDataImport() {
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [clearTable, setClearTable] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const parseCSV = useCallback((text: string): Record<string, unknown>[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    const data: Record<string, unknown>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const row: Record<string, unknown> = {};
        headers.forEach((header, index) => {
          let value: unknown = values[index];
          
          // Parse numeric values
          if (value !== null && value !== "" && !isNaN(Number(value))) {
            value = Number(value);
          }
          // Parse boolean values
          else if (value === "true") value = true;
          else if (value === "false") value = false;
          // Keep null/empty as null
          else if (value === "" || value === "null" || value === "NULL") value = null;
          
          row[header] = value;
        });
        data.push(row);
      }
    }

    return data;
  }, []);

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".csv")) {
        toast.error("Пожалуйста, выберите CSV файл");
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file || !selectedTable) {
      toast.error("Выберите таблицу и файл");
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setResult(null);

    try {
      const text = await file.text();
      const data = parseCSV(text);

      if (data.length === 0) {
        toast.error("Файл пуст или имеет неверный формат");
        setIsLoading(false);
        return;
      }

      toast.info(`Загружаем ${data.length} записей...`);

      // Get session for auth
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      // Send to edge function in batches
      const batchSize = 500;
      let totalInserted = 0;
      const errors: string[] = [];

      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const isFirstBatch = i === 0;

        const response = await supabase.functions.invoke("bulk-import", {
          body: {
            table: selectedTable,
            data: batch,
            clear_table: isFirstBatch && clearTable,
          },
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (response.error) {
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${response.error.message}`);
        } else if (response.data) {
          totalInserted += response.data.inserted || 0;
          if (response.data.errors) {
            errors.push(...response.data.errors);
          }
        }

        setProgress(Math.round(((i + batchSize) / data.length) * 100));
      }

      const importResult: ImportResult = {
        success: errors.length === 0,
        table: selectedTable,
        total: data.length,
        inserted: totalInserted,
        errors: errors.length > 0 ? errors : undefined,
      };

      setResult(importResult);

      if (importResult.success) {
        toast.success(`Успешно загружено ${totalInserted} записей в ${selectedTable}`);
      } else {
        toast.warning(`Загружено ${totalInserted} из ${data.length} записей с ошибками`);
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Ошибка импорта данных");
    } finally {
      setIsLoading(false);
      setProgress(100);
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          Массовый импорт данных
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Таблица</Label>
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите таблицу" />
              </SelectTrigger>
              <SelectContent>
                {ALLOWED_TABLES.map((table) => (
                  <SelectItem key={table} value={table}>
                    {table}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>CSV файл</Label>
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="cursor-pointer"
            />
          </div>
        </div>

        {file && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </div>
        )}

        <div className="flex items-center gap-2">
          <Switch
            id="clear-table"
            checked={clearTable}
            onCheckedChange={setClearTable}
          />
          <Label htmlFor="clear-table" className="cursor-pointer">
            Очистить таблицу перед импортом
          </Label>
        </div>

        {isLoading && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">
              Загрузка... {progress}%
            </p>
          </div>
        )}

        {result && (
          <div className={`p-4 rounded-lg ${result.success ? "bg-green-500/10" : "bg-yellow-500/10"}`}>
            <div className="flex items-center gap-2 mb-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-yellow-500" />
              )}
              <span className="font-medium">
                {result.success ? "Импорт завершен" : "Импорт завершен с ошибками"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Загружено: {result.inserted} из {result.total} записей
            </p>
            {result.errors && result.errors.length > 0 && (
              <div className="mt-2 max-h-32 overflow-y-auto">
                {result.errors.slice(0, 5).map((error, i) => (
                  <p key={i} className="text-xs text-destructive">
                    {error}
                  </p>
                ))}
                {result.errors.length > 5 && (
                  <p className="text-xs text-muted-foreground">
                    ...и ещё {result.errors.length - 5} ошибок
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <Button
          onClick={handleImport}
          disabled={!file || !selectedTable || isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Загрузка...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Импортировать данные
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

