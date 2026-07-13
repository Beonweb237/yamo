// MTN MoMo API helpers — Cameroon (sandbox)
// Prod: https://ericssondeveloperapi.portal.azure-api.net
// Sandbox: https://sandbox.momodeveloper.mtn.com

const MOMO_BASE = Deno.env.get("MOMO_BASE_URL") || "https://sandbox.momodeveloper.mtn.com";
const MOMO_SUBSCRIPTION_KEY = Deno.env.get("MOMO_SUBSCRIPTION_KEY") || "";

export interface MoMoConfig {
  baseUrl: string;
  subscriptionKey: string;
  targetEnvironment: string;
  callbackHost: string;
}

export function getMoMoConfig(): MoMoConfig {
  return {
    baseUrl: MOMO_BASE,
    subscriptionKey: MOMO_SUBSCRIPTION_KEY,
    targetEnvironment: "sandbox", // "production" for live
    callbackHost: Deno.env.get("MOMO_CALLBACK_HOST") || "",
  };
}

export async function createApiUser(config: MoMoConfig, referenceId: string) {
  const url = `${config.baseUrl}/v1_0/apiuser`;
  const body = { providerCallbackHost: config.callbackHost };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Reference-Id": referenceId,
      "Ocp-Apim-Subscription-Key": config.subscriptionKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`MoMo createApiUser failed: ${res.status} ${await res.text()}`);
  }
}

export async function createApiKey(config: MoMoConfig, referenceId: string): Promise<string> {
  const url = `${config.baseUrl}/v1_0/apiuser/${referenceId}/apikey`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": config.subscriptionKey,
    },
  });
  if (!res.ok) {
    throw new Error(`MoMo createApiKey failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.apiKey;
}

export async function getAccessToken(config: MoMoConfig, referenceId: string, apiKey: string): Promise<string> {
  const url = `${config.baseUrl}/collection/token/`;
  const auth = btoa(`${referenceId}:${apiKey}`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Ocp-Apim-Subscription-Key": config.subscriptionKey,
    },
  });
  if (!res.ok) {
    throw new Error(`MoMo getAccessToken failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token;
}

export async function requestToPay(
  config: MoMoConfig,
  token: string,
  referenceId: string,
  payload: { amount: string; currency: string; externalId: string; payer: { partyIdType: string; partyId: string }; payerMessage: string; payeeNote: string },
) {
  const url = `${config.baseUrl}/collection/v1_0/requesttopay`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Reference-Id": referenceId,
      "X-Target-Environment": config.targetEnvironment,
      "Ocp-Apim-Subscription-Key": config.subscriptionKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok && res.status !== 202) {
    throw new Error(`MoMo requestToPay failed: ${res.status} ${await res.text()}`);
  }
}

export async function getPaymentStatus(config: MoMoConfig, token: string, referenceId: string) {
  const url = `${config.baseUrl}/collection/v1_0/requesttopay/${referenceId}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Target-Environment": config.targetEnvironment,
      "Ocp-Apim-Subscription-Key": config.subscriptionKey,
    },
  });
  if (!res.ok) {
    throw new Error(`MoMo getPaymentStatus failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
