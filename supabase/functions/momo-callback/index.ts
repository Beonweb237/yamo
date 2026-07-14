// Edge Function: momo-callback
// Webhook MTN MoMo — reçoit les notifications de statut de paiement
// À enregistrer comme URL de callback dans le portail MoMo, en incluant le
// secret dans l'URL : .../momo-callback?secret=<MOMO_CALLBACK_SECRET>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, corsResponse } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Secret partagé obligatoire : sans lui, n'importe qui pourrait marquer une
// commande comme payée. À définir via `supabase secrets set MOMO_CALLBACK_SECRET=...`
const CALLBACK_SECRET = Deno.env.get("MOMO_CALLBACK_SECRET") || "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Authentification du webhook : header X-Callback-Secret ou ?secret= dans l'URL
  const providedSecret = req.headers.get("x-callback-secret")
    || new URL(req.url).searchParams.get("secret")
    || "";
  if (!CALLBACK_SECRET || providedSecret !== CALLBACK_SECRET) {
    console.warn("momo-callback: secret invalide ou absent — requête rejetée");
    return corsResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json();
    console.log("MoMo callback received:", JSON.stringify(body));

    const { externalId, status, financialTransactionId } = body;

    if (!externalId) {
      return corsResponse({ error: "externalId manquant" }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (status === "SUCCESSFUL") {
      // Update order payment status
      const { error } = await supabase
        .from("payments")
        .upsert({
          order_id: externalId,
          method: "mtn_momo",
          status: "paid",
          provider_reference: financialTransactionId,
        });

      if (error) {
        console.error("Failed to update payment:", error);
        return corsResponse({ error: error.message }, 500);
      }

      // Update order payment_status
      await supabase
        .from("orders")
        .update({ payment_status: "paid", status: "confirmed" })
        .eq("id", externalId);

      console.log(`Order ${externalId} paid via MoMo ${financialTransactionId}`);
    } else if (status === "FAILED") {
      await supabase
        .from("payments")
        .upsert({
          order_id: externalId,
          method: "mtn_momo",
          status: "failed",
          provider_reference: financialTransactionId,
        });

      await supabase
        .from("orders")
        .update({ payment_status: "failed" })
        .eq("id", externalId);
    }

    return corsResponse({ success: true });
  } catch (err) {
    console.error("momo-callback error:", err);
    return corsResponse({ error: (err as Error).message }, 500);
  }
});
