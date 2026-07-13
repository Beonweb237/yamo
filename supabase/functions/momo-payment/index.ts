// Edge Function: momo-payment
// Initie un paiement MTN MoMo pour une commande Yamo
// Si MOMO_SUBSCRIPTION_KEY n'est pas configurée → mode simulation

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, corsResponse } from "../_shared/cors.ts";
import {
  getMoMoConfig,
  createApiUser,
  createApiKey,
  getAccessToken,
  requestToPay,
} from "../_shared/momo.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IS_SIMULATION = !Deno.env.get("MOMO_SUBSCRIPTION_KEY");

interface PaymentRequest {
  orderId: string;
  amount: number;
  phone: string;
  payerMessage?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: PaymentRequest = await req.json();

    if (!body.orderId || !body.amount || !body.phone) {
      return corsResponse({ error: "orderId, amount, phone requis" }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const referenceId = `yamo-${body.orderId}-${Date.now()}`.slice(0, 36);

    // ── Mode simulation ──
    if (IS_SIMULATION) {
      console.log(`[SIMULATION] Paiement ${body.amount} XAF pour commande ${body.orderId}`);

      // Mark payment as paid
      await supabase.from("payments").upsert({
        order_id: body.orderId,
        method: "mtn_momo",
        amount: body.amount,
        status: "paid",
        provider_reference: referenceId,
      });

      // Confirm the order
      await supabase
        .from("orders")
        .update({ payment_status: "paid", status: "confirmed" })
        .eq("id", body.orderId);

      return corsResponse({
        success: true,
        referenceId,
        simulation: true,
        message: `[SIMULATION] Paiement de ${body.amount} XAF accepté. Commande confirmée.`,
      });
    }

    // ── Mode réel MoMo ──
    const config = getMoMoConfig();

    await createApiUser(config, referenceId);
    const apiKey = await createApiKey(config, referenceId);
    const token = await getAccessToken(config, referenceId, apiKey);

    await requestToPay(config, token, referenceId, {
      amount: String(body.amount),
      currency: "XAF",
      externalId: body.orderId,
      payer: {
        partyIdType: "MSISDN",
        partyId: body.phone.replace(/^\+/, ""),
      },
      payerMessage: body.payerMessage || "Commande Yamo",
      payeeNote: `Commande ${body.orderId}`,
    });

    return corsResponse({
      success: true,
      referenceId,
      simulation: false,
      message: "Demande de paiement envoyée. Vérifiez votre téléphone.",
    });
  } catch (err) {
    console.error("momo-payment error:", err);
    return corsResponse({ error: (err as Error).message }, 500);
  }
});
