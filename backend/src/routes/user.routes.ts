import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../db/prisma";

const router = Router();

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    include: { slackIntegration: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    slackConnected: user.slackIntegration?.connected ?? false,
  });
});

router.post("/slack/disconnect", requireAuth, async (req, res) => {
  await prisma.slackIntegration.updateMany({
    where: { userId: req.userId! },
    data: { connected: false, accessToken: null, webhookUrl: null },
  });
  res.json({ ok: true });
});

export default router;
