import { prisma } from "../db/prisma";
import { emailQueue, enqueueEmailJob } from "../queues/emailQueue";

/**
 * Belt-and-suspenders recovery: BullMQ delayed jobs already survive a normal
 * server restart because they live in Redis (AOF-persisted). This handles
 * the edge case where Redis itself was wiped/lost while Postgres still has
 * SCHEDULED rows — we re-add them as delayed jobs (or immediately, if their
 * time has already passed) using the DB row id as the BullMQ jobId, so if
 * the job actually still exists in Redis this is a harmless no-op.
 */
export async function reconcileScheduledJobs() {
  const pending = await prisma.emailJob.findMany({
    where: { status: "SCHEDULED" },
    select: { id: true, scheduledAt: true },
  });

  let recovered = 0;
  for (const job of pending) {
    const existing = await emailQueue.getJob(job.id);
    if (existing) continue;

    const delayMs = job.scheduledAt.getTime() - Date.now();
    await enqueueEmailJob(job.id, delayMs);
    recovered++;
  }

  if (recovered > 0) {
    console.log(`[reconcile] re-queued ${recovered} scheduled job(s) missing from Redis`);
  }
}
