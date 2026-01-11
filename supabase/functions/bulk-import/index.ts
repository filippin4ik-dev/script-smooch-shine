import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Проверяем секретный ключ для импорта (временно для первоначальной загрузки)
    const importKey = req.headers.get("X-Import-Key");
    const validKey = Deno.env.get("BULK_IMPORT_KEY") || "initial-load-2026";
    
    if (importKey !== validKey) {
      // Если нет ключа - проверяем авторизацию админа
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Проверяем, что пользователь - админ
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      if (!roleData) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { table, data, clear_table } = await req.json();

    // Белый список разрешенных таблиц для импорта
    const allowedTables = [
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
      "user_sessions",
      "user_rate_limits",
      "crash_config",
      "dice_config",
      "hilo_config",
      "chicken_road_config",
      "email_accounts",
      "game_settings",
      "mines_config",
      "towers_config",
    ];

    if (!allowedTables.includes(table)) {
      return new Response(JSON.stringify({ error: `Table '${table}' is not allowed for import` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(data) || data.length === 0) {
      return new Response(JSON.stringify({ error: "Data must be a non-empty array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Очищаем таблицу если запрошено
    if (clear_table) {
      const { error: deleteError } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (deleteError) {
        console.error("Delete error:", deleteError);
      }
    }

    // Вставляем данные батчами по 100 записей
    const batchSize = 100;
    let inserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      const { error: insertError, data: insertedData } = await supabase
        .from(table)
        .upsert(batch, { onConflict: "id", ignoreDuplicates: false })
        .select();

      if (insertError) {
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${insertError.message}`);
      } else {
        inserted += insertedData?.length || batch.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        table,
        total: data.length,
        inserted,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
