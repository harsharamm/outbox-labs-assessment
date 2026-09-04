import { DelayedError, Job, Worker } from "bullmq";
import { redisConnection } from "../lib/redis";
import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { EMAIL_QUEUE_NAME, EmailJobData } from "./emailQueue";
import { startOfNextHour, tryConsumeHourlySlot } from "./rateLimiter";
import { getTransport } from "../lib/mailer";
import { indexEmail } from "../lib/elasticsearch";
import { notifySlackRateLimit } from "../lib/slack";

/**
 * Atomically claims an EmailJob for processing. Returns null if it was
 * already claimed/sent by another worker or a previous run — this is what
 * makes the send idempotent across concurrent workers and restarts.
 */
async function claimJob(emailJobId: string) {
  const { count } = await prisma.emailJob.updateMany({
    where: { id: emailJobId, status: "SCHEDULED" },
    data: { status: "PROCESSING" },
  });
  if (count === 0) return null;

  return prisma.emailJob.findUnique({
    where: { id: emailJobId },
    include: { batch: { include: { sender: true, user: true } } },
  });
}

async function processEmailJob(job: Job<EmailJobData>, token?: string) {
  const claimed = await claimJob(job.data.emailJobId);
  if (!claimed) {
    // Already handled (duplicate delivery attempt / retry after a restart).
    return;
  }

  const { batch } = claimed;
  const { sender, user } = batch;

  const rateLimit = await tryConsumeHourlySlot(sender.id, batch.hourlyLimit);
  if (!rateLimit.allowed) {
    const nextWindow = startOfNextHour(new Date());
    await prisma.emailJob.update({
      where: { id: claimed.id },
      data: { status: "SCHEDULED", scheduledAt: nextWindow },
    });

    if (token) {
      await job.moveToDelayed(nextWindow.getTime(), token);
    }

    await notifySlackRateLimit(user.id, sender.email, 1, nextWindow);

    if (token) {
      throw new DelayedError();
    }
    return;
  }

  try {
    const transport = getTransport(sender);
    await transport.sendMail({
      from: `"${sender.name}" <${sender.email}>`,
      to: claimed.recipientEmail,
      subject: batch.subject,
      html: batch.body,
    });

    const sentAt = new Date();
    await prisma.emailJob.update({
      where: { id: claimed.id },
      data: { status: "SENT", sentAt },
    });

    await indexEmail(claimed.id, {
      userId: user.id,
      recipientEmail: claimed.recipientEmail,
      subject: batch.subject,
      bodySnippet: batch.body.slice(0, 200),
      status: "SENT",
      scheduledAt: claimed.scheduledAt.toISOString(),
      sentAt: sentAt.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown send error";
    await prisma.emailJob.update({
      where: { id: claimed.id },
      data: { status: "FAILED", error: message },
    });

    await indexEmail(claimed.id, {
      userId: user.id,
      recipientEmail: claimed.recipientEmail,
      subject: batch.subject,
      bodySnippet: batch.body.slice(0, 200),
      status: "FAILED",
      scheduledAt: claimed.scheduledAt.toISOString(),
      sentAt: null,
    });
  }
}

export function startEmailWorker() {
  const worker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: redisConnection,
    concurrency: env.workerConcurrency,
    // Global minimum delay between individual sends (mimics provider throttling).
    limiter: { max: 1, duration: env.minDelayMs },
  });

  worker.on("failed", (job, err) => {
    console.error(`[worker] job ${job?.id} failed:`, err.message);
  });

  console.log(
    `[worker] started (concurrency=${env.workerConcurrency}, minDelayMs=${env.minDelayMs})`
  );

  return worker;
}
