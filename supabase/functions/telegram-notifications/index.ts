import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  telegram_id?: number;
  user_id?: string;
  public_id?: number;
  message: string;
  send_to_all?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // GET - получить непрочитанные уведомления
    if (req.method === "GET") {
      const url = new URL(req.url);
      const telegramId = url.searchParams.get("telegram_id");
      const userId = url.searchParams.get("user_id");
      const publicId = url.searchParams.get("public_id");

      let profileId: string | null = null;

      // Поиск по telegram_id
      if (telegramId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("telegram_id", parseInt(telegramId))
          .single();
        profileId = profile?.id || null;
      }
      // Поиск по user_id (UUID)
      else if (userId) {
        profileId = userId;
      }
      // Поиск по public_id (8-значный код)
      else if (publicId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("public_id", parseInt(publicId))
          .single();
        profileId = profile?.id || null;
      }

      if (!profileId) {
        return new Response(
          JSON.stringify({ notifications: [], message: "User not found or no identifier provided" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: notifications, error: notifError } = await supabase
        .from("system_notifications")
        .select("id, message, created_at")
        .eq("user_id", profileId)
        .eq("is_read", false)
        .order("created_at", { ascending: false });

      if (notifError) {
        console.error("Error fetching notifications:", notifError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch notifications" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ notifications: notifications || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST - отправить уведомление
    if (req.method === "POST") {
      const body: NotificationRequest = await req.json();

      if (!body.message) {
        return new Response(
          JSON.stringify({ error: "message is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Отправка всем пользователям
      if (body.send_to_all) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, telegram_id, public_id");

        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
          return new Response(
            JSON.stringify({ error: "Failed to fetch profiles" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const notifications = profiles?.map((p) => ({
          user_id: p.id,
          message: body.message,
          is_read: false,
        })) || [];

        if (notifications.length > 0) {
          const { error: insertError } = await supabase
            .from("system_notifications")
            .insert(notifications);

          if (insertError) {
            console.error("Error inserting notifications:", insertError);
            return new Response(
              JSON.stringify({ error: "Failed to create notifications" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        const telegramIds = profiles?.filter(p => p.telegram_id).map(p => ({
          telegram_id: p.telegram_id,
          public_id: p.public_id
        })) || [];

        return new Response(
          JSON.stringify({ 
            success: true, 
            count: notifications.length,
            users: telegramIds,
            message: body.message
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Отправка конкретному пользователю
      let userId = body.user_id;
      let telegramId = body.telegram_id;

      // Поиск по public_id
      if (body.public_id && !userId) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, telegram_id")
          .eq("public_id", body.public_id)
          .single();

        if (profileError || !profile) {
          return new Response(
            JSON.stringify({ error: "User not found by public_id" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        userId = profile.id;
        telegramId = profile.telegram_id;
      }

      // Поиск по telegram_id
      if (telegramId && !userId) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("telegram_id", telegramId)
          .single();

        if (profileError || !profile) {
          return new Response(
            JSON.stringify({ error: "User not found by telegram_id" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        userId = profile.id;
      }

      // Если передан user_id, найти telegram_id
      if (userId && !telegramId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("telegram_id, public_id")
          .eq("id", userId)
          .single();

        if (profile) {
          telegramId = profile.telegram_id;
        }
      }

      if (!userId) {
        return new Response(
          JSON.stringify({ error: "user_id, telegram_id, or public_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Создать уведомление в БД
      const { error: insertError } = await supabase
        .from("system_notifications")
        .insert({
          user_id: userId,
          message: body.message,
          is_read: false,
        });

      if (insertError) {
        console.error("Error inserting notification:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to create notification" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          telegram_id: telegramId,
          user_id: userId,
          message: body.message
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PATCH - пометить уведомления как прочитанные
    if (req.method === "PATCH") {
      const url = new URL(req.url);
      const telegramId = url.searchParams.get("telegram_id");
      const userId = url.searchParams.get("user_id");
      const publicId = url.searchParams.get("public_id");
      const notificationId = url.searchParams.get("notification_id");

      let profileId: string | null = null;

      if (telegramId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("telegram_id", parseInt(telegramId))
          .single();
        profileId = profile?.id || null;
      } else if (userId) {
        profileId = userId;
      } else if (publicId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("public_id", parseInt(publicId))
          .single();
        profileId = profile?.id || null;
      }

      if (!profileId) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let query = supabase
        .from("system_notifications")
        .update({ is_read: true })
        .eq("user_id", profileId);

      if (notificationId) {
        query = query.eq("id", notificationId);
      }

      const { error: updateError } = await query;

      if (updateError) {
        console.error("Error updating notifications:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update notifications" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

Deno.serve(handler);
