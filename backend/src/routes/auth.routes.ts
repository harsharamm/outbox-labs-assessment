import { Router } from "express";
import passport from "../config/passport";
import { env } from "../config/env";
import { signAuthToken, verifyAuthToken } from "../lib/jwt";
import { AUTH_COOKIE_NAME, requireAuth } from "../middleware/auth";
import { prisma } from "../db/prisma";
import { exchangeSlackCode, getSlackAuthorizeUrl } from "../lib/slack";
import type { User } from "@prisma/client";

const router = Router();

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.nodeEnv === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// --- Google OAuth ---
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: `${env.frontendUrl}/login?error=google` }),
  (req, res) => {
    const user = req.user as User;
    const token = signAuthToken({ userId: user.id });
    res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);
    res.redirect(`${env.frontendUrl}/`);
  }
);

router.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME);
  res.json({ ok: true });
});

// --- Slack OAuth (must be logged in already) ---
router.get("/slack", requireAuth, (req, res) => {
  const state = signAuthToken({ userId: req.userId! });
  res.redirect(getSlackAuthorizeUrl(state));
});

router.get("/slack/callback", async (req, res) => {
  try {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) {
      return res.redirect(`${env.frontendUrl}/?slack=error`);
    }
    const { userId } = verifyAuthToken(state);
    const result = await exchangeSlackCode(code);

    if (!result.ok) {
      console.error("[slack oauth] exchange failed", result.error);
      return res.redirect(`${env.frontendUrl}/?slack=error`);
    }

    await prisma.slackIntegration.upsert({
      where: { userId },
      update: {
        teamName: result.team?.name,
        accessToken: result.access_token,
        webhookUrl: result.incoming_webhook?.url,
        connected: true,
      },
      create: {
        userId,
        teamName: result.team?.name,
        accessToken: result.access_token,
        webhookUrl: result.incoming_webhook?.url,
        connected: true,
      },
    });

    res.redirect(`${env.frontendUrl}/?slack=connected`);
  } catch (err) {
    console.error("[slack oauth] callback error", err);
    res.redirect(`${env.frontendUrl}/?slack=error`);
  }
});

export default router;
