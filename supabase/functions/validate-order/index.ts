// Edge Function: validate-order
// Validation côté serveur d'une commande avant soumission
// — Vérifie les prix, la dispo, et calcule les frais exacts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, corsResponse } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ValidateRequest {
  restaurantId: string;
  items: { menuItemId: string; quantity: number }[];
  promoCode?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: ValidateRequest = await req.json();

    if (!body.restaurantId || !body.items?.length) {
      return corsResponse({ error: "restaurantId et items requis" }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch restaurant
    const { data: restaurant, error: rErr } = await supabase
      .from("restaurants")
      .select("id, is_open, delivery_fee, min_order")
      .eq("id", body.restaurantId)
      .single();

    if (rErr || !restaurant) {
      return corsResponse({ error: "Restaurant introuvable" }, 404);
    }

    if (!restaurant.is_open) {
      return corsResponse({ error: "Ce restaurant est actuellement fermé" }, 400);
    }

    // Fetch menu items
    const itemIds = body.items.map((i) => i.menuItemId);
    const { data: menuItems, error: mErr } = await supabase
      .from("menu_items")
      .select("id, price, name, is_available")
      .in("id", itemIds)
      .eq("restaurant_id", body.restaurantId);

    if (mErr || !menuItems) {
      return corsResponse({ error: "Impossible de charger les articles" }, 500);
    }

    // Validate each item
    const priceMap = new Map(menuItems.map((m) => [m.id, m]));
    let subtotal = 0;
    const invalidItems: string[] = [];

    for (const item of body.items) {
      const menuItem = priceMap.get(item.menuItemId);
      if (!menuItem) {
        invalidItems.push(`Article ${item.menuItemId} introuvable`);
        continue;
      }
      if (!menuItem.is_available) {
        invalidItems.push(`"${menuItem.name}" n'est plus disponible`);
        continue;
      }
      subtotal += menuItem.price * item.quantity;
    }

    if (invalidItems.length > 0) {
      return corsResponse({ error: invalidItems.join("; ") }, 400);
    }

    const deliveryFee = restaurant.delivery_fee || 0;
    const total = subtotal + deliveryFee;

    if (subtotal < (restaurant.min_order || 0)) {
      return corsResponse(
        { error: `Commande minimum : ${restaurant.min_order} XAF` },
        400,
      );
    }

    return corsResponse({
      valid: true,
      subtotal,
      deliveryFee,
      total,
      currency: "XAF",
    });
  } catch (err) {
    console.error("validate-order error:", err);
    return corsResponse({ error: (err as Error).message }, 500);
  }
});
