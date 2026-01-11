import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const toHex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const hashUrl = async (url: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url));
  return `sha256_${toHex(digest)}`;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const downloadAndCache = async (imageUrl: string): Promise<boolean> => {
  try {
    const key = await hashUrl(imageUrl);

    // Check if already cached
    const { data: existing } = await supabase
      .from("image_cache")
      .select("key")
      .eq("key", key)
      .maybeSingle();

    if (existing) {
      return true; // Already cached
    }

    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "image/*,*/*",
        Referer: "https://cs.money/",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch: ${imageUrl} (${response.status})`);
      return false;
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const imageData = await response.arrayBuffer();
    const dataBase64 = arrayBufferToBase64(imageData);

    const { error } = await supabase.from("image_cache").upsert(
      {
        key,
        source_url: imageUrl,
        content_type: contentType,
        data_base64: dataBase64,
      },
      { onConflict: "key" }
    );

    if (error) {
      console.error(`Cache insert error for ${imageUrl}:`, error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`Error caching ${imageUrl}:`, err);
    return false;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== Starting skin cache warmup ===");

    // Get all skin image URLs
    const { data: skins, error: skinsError } = await supabase
      .from("skins")
      .select("id, image_url")
      .not("image_url", "is", null);

    if (skinsError) throw skinsError;

    // Get all case item image URLs
    const { data: caseItems, error: caseError } = await supabase
      .from("case_items")
      .select("id, image_url")
      .not("image_url", "is", null);

    if (caseError) throw caseError;

    const allUrls = new Set<string>();

    for (const skin of skins || []) {
      if (skin.image_url) allUrls.add(skin.image_url);
    }
    for (const item of caseItems || []) {
      if (item.image_url) allUrls.add(item.image_url);
    }

    console.log(`Found ${allUrls.size} unique image URLs to cache`);

    let success = 0;
    let failed = 0;
    let skipped = 0;
    const urlArray = Array.from(allUrls);

    // Process in batches of 10 to avoid overwhelming
    const batchSize = 10;
    for (let i = 0; i < urlArray.length; i += batchSize) {
      const batch = urlArray.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(downloadAndCache));

      for (const result of results) {
        if (result) success++;
        else failed++;
      }

      console.log(`Progress: ${i + batch.length}/${urlArray.length} (success: ${success}, failed: ${failed})`);

      // Small delay between batches
      if (i + batchSize < urlArray.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    console.log(`=== Cache warmup complete: ${success} cached, ${failed} failed ===`);

    return new Response(
      JSON.stringify({
        success: true,
        total: urlArray.length,
        cached: success,
        failed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Warmup error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
