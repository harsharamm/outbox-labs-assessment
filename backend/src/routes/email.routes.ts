import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../db/prisma";
import { extractEmailsFromBuffer } from "../utils/csv";
import { scheduleBatch } from "../services/emailService";
import { searchEmails } from "../lib/elasticsearch";

const router = Router();
router.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const scheduleSchema = z.object({
  senderId: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  startTime: z.string().min(1),
  delayMs: z.coerce.number().int().min(0),
  hourlyLimit: z.coerce.number().int().min(1),
});

router.post("/schedule", upload.single("file"), async (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  if (!req.file) {
    return res.status(400).json({ error: "A CSV/text file of recipients is required" });
  }

  const sender = await prisma.sender.findFirst({
    where: { id: parsed.data.senderId, userId: req.userId! },
  });
  if (!sender) {
    return res.status(404).json({ error: "Sender not found" });
  }

  const recipients = extractEmailsFromBuffer(req.file.buffer);
  if (recipients.length === 0) {
    return res.status(400).json({ error: "No valid email addresses found in the uploaded file" });
  }

  const result = await scheduleBatch({
    userId: req.userId!,
    senderId: parsed.data.senderId,
    subject: parsed.data.subject,
    body: parsed.data.body,
    recipients,
    startTime: new Date(parsed.data.startTime),
    delayMs: parsed.data.delayMs,
    hourlyLimit: parsed.data.hourlyLimit,
  });

  res.status(201).json({ ...result, recipientCount: recipients.length });
});

router.get("/", async (req, res) => {
  const status = req.query.status === "sent" ? "SENT" : "SCHEDULED";
  const jobs = await prisma.emailJob.findMany({
    where: {
      status: status === "SENT" ? { in: ["SENT", "FAILED"] } : "SCHEDULED",
      batch: { userId: req.userId! },
    },
    include: { batch: { select: { subject: true } } },
    orderBy: { scheduledAt: status === "SENT" ? "desc" : "asc" },
    take: 200,
  });

  res.json(
    jobs.map((job) => ({
      id: job.id,
      email: job.recipientEmail,
      subject: job.batch.subject,
      scheduledAt: job.scheduledAt,
      sentAt: job.sentAt,
      status: job.status,
      error: job.error,
    }))
  );
});

router.get("/search", async (req, res) => {
  const q = String(req.query.q ?? "");
  const status = req.query.status === "sent" ? "SENT" : req.query.status === "scheduled" ? "SCHEDULED" : undefined;
  try {
    const results = await searchEmails(req.userId!, q, status);
    res.json(results);
  } catch (err) {
    console.error("[search] elasticsearch query failed", err);
    res.status(503).json({ error: "Search is temporarily unavailable" });
  }
});

export default router;
