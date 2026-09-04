import { prisma } from "../db/prisma";
import { env } from "../config/env";

export function getSlackAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.slackClientId,
    scope: "incoming-webhook,chat:write",
    redirect_uri: env.slackCallbackUrl,
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

interface SlackOAuthResponse {
  ok: boolean;
  access_token?: string;
  team?: { name?: string };
  incoming_webhook?: { url?: string };
  error?: string;
}

export async function exchangeSlackCode(code: string): Promise<SlackOAuthResponse> {
  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.slackClientId,
      client_secret: env.slackClientSecret,
      code,
      redirect_uri: env.slackCallbackUrl,
    }),
  });
  return (await res.json()) as SlackOAuthResponse;
}

/**
 * Sends a Slack message for a rate-limit event. No-ops silently if the user
 * hasn't connected Slack (never throws / crashes the worker); works
 * immediately after a connect since it just reads the current DB row.
 */
export async function notifySlackRateLimit(
  userId: string,
  senderEmail: string,
  rescheduledCount: number,
  nextWindow: Date
) {
  try {
    const integration = await prisma.slackIntegration.findUnique({
      where: { userId },
    });
    if (!integration || !integration.connected || !integration.webhookUrl) {
      return;
    }
    const text = `:warning: Hourly send limit reached for *${senderEmail}*. Rescheduled ${rescheduledCount} email(s) to start at ${nextWindow.toISOString()}.`;
    await fetch(integration.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.error("[slack] failed to send rate-limit notification", err);
  }
}
