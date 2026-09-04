import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../db/prisma";

const router = Router();
router.use(requireAuth);

const createSenderSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  smtpUser: z.string().min(1),
  smtpPass: z.string().min(1),
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
});

router.get("/", async (req, res) => {
  const senders = await prisma.sender.findMany({
    where: { userId: req.userId! },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(senders);
});

router.post("/", async (req, res) => {
  const parsed = createSenderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const sender = await prisma.sender.create({
    data: { ...parsed.data, userId: req.userId! },
  });
  res.status(201).json({ id: sender.id, name: sender.name, email: sender.email });
});

router.delete("/:id", async (req, res) => {
  await prisma.sender.deleteMany({
    where: { id: req.params.id, userId: req.userId! },
  });
  res.json({ ok: true });
});

export default router;
