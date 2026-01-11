import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendCodeRequest {
  userId: string;
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, email }: SendCodeRequest = await req.json();

    if (!userId || !email) {
      return new Response(
        JSON.stringify({ error: "userId и email обязательны" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Инициализируем Supabase с service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Запрашиваем код верификации через RPC
    const { data: result, error: rpcError } = await supabase.rpc("request_email_verification", {
      _user_id: userId,
      _email: email,
    });

    if (rpcError) {
      console.error("RPC error:", rpcError);
      return new Response(
        JSON.stringify({ error: rpcError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!result.success) {
      return new Response(
        JSON.stringify({ 
          error: result.error,
          wait_seconds: result.wait_seconds 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const code = result.code;

    // Получаем активный email аккаунт из базы
    const { data: emailAccount, error: emailError } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("is_active", true)
      .order("use_count", { ascending: true })
      .limit(1)
      .single();

    if (emailError || !emailAccount) {
      console.error("No active email account found:", emailError);
      return new Response(
        JSON.stringify({ error: "Нет доступных email аккаунтов для отправки" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Using email account:", emailAccount.email);
    console.log("SMTP config:", emailAccount.smtp_host, emailAccount.smtp_port);

    try {
      const client = new SMTPClient({
        connection: {
          hostname: emailAccount.smtp_host,
          port: emailAccount.smtp_port,
          tls: true,
          auth: {
            username: emailAccount.smtp_user,
            password: emailAccount.smtp_password,
          },
        },
      });

      const fromName = emailAccount.display_name || "Lucky Casino";

      // Use plain ASCII text to avoid quoted-printable encoding issues
      await client.send({
        from: `${fromName} <${emailAccount.email}>`,
        to: email,
        subject: `Your code: ${code}`,
        content: `Your Lucky Casino verification code: ${code}\n\nValid for 5 minutes.\n\nIf you didn't request this, ignore this email.`,
      });

      await client.close();

      // Обновляем статистику использования
      await supabase.rpc("mark_email_used", { _email_id: emailAccount.id });

      console.log("Email sent successfully to:", email);

      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Код отправлен на " + email 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } catch (sendError: any) {
      console.error("SMTP error:", sendError);
      return new Response(
        JSON.stringify({ error: "Ошибка отправки email: " + sendError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  } catch (error: any) {
    console.error("Error sending verification code:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

Deno.serve(handler);
