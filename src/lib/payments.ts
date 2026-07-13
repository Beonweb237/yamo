// Payment helpers — calls Supabase Edge Functions for MoMo / Orange Money

const FUNCTIONS_BASE = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
  || "https://vkzsbkrjeekwhkzfuxvo.supabase.co/functions/v1";

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

async function functionCall<T = unknown>(name: string, body: unknown): Promise<T> {
  const res = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return data as T;
}

/** Initialise un paiement MTN MoMo */
export async function initiateMoMoPayment(params: {
  orderId: string;
  amount: number;
  phone: string;
  payerMessage?: string;
}): Promise<{ success: boolean; referenceId: string; message: string }> {
  return functionCall("momo-payment", {
    orderId: params.orderId,
    amount: params.amount,
    phone: params.phone,
    payerMessage: params.payerMessage || "Commande Yamo",
  });
}

/** Valide une commande côté serveur avant soumission */
export async function validateOrder(params: {
  restaurantId: string;
  items: { menuItemId: string; quantity: number }[];
  promoCode?: string;
}): Promise<{
  valid: boolean;
  subtotal: number;
  deliveryFee: number;
  total: number;
  currency: string;
}> {
  return functionCall("validate-order", params);
}
