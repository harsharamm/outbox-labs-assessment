import { prisma } from "../db/prisma";
import { emailQueue } from "../queues/emailQueue";
import { indexEmail } from "../lib/elasticsearch";

export interface ScheduleBatchInput {
  userId: string;
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: Date;
  delayMs: number;
  hourlyLimit: number;
}

/**
 * Creates the batch + one EmailJob per recipient, spacing recipients
 * `delayMs` apart starting at `startTime`, then enqueues each as a BullMQ
 * delayed job (jobId = EmailJob.id, giving idempotent re-adds).
 */
export async function scheduleBatch(input: ScheduleBatchInput) {
  const batch = await prisma.emailBatch.create({
    data: {
      userId: input.userId,
      senderId: input.senderId,
      subject: input.subject,
      body: input.body,
      delayMs: input.delayMs,
      hourlyLimit: input.hourlyLimit,
      startTime: input.startTime,
    },
  });

  const jobsData = input.recipients.map((recipientEmail, index) => ({
    batchId: batch.id,
    recipientEmail,
    scheduledAt: new Date(input.startTime.getTime() + index * input.delayMs),
  }));

  await prisma.emailJob.createMany({ data: jobsData });

  const createdJobs = await prisma.emailJob.findMany({
    where: { batchId: batch.id },
    select: { id: true, scheduledAt: true, recipientEmail: true },
  });

  await Promise.all(
    createdJobs.map((job) =>
      indexEmail(job.id, {
        userId: input.userId,
        recipientEmail: job.recipientEmail,
        subject: input.subject,
        bodySnippet: input.body.slice(0, 200),
        status: "SCHEDULED",
        scheduledAt: job.scheduledAt.toISOString(),
        sentAt: null,
      })
    )
  );

  // Bulk-add so scheduling 1000+ recipients at once stays a handful of
  // Redis round trips instead of one per recipient.
  await emailQueue.addBulk(
    createdJobs.map((job) => ({
      name: "send-email",
      data: { emailJobId: job.id },
      opts: {
        jobId: job.id,
        delay: Math.max(job.scheduledAt.getTime() - Date.now(), 0),
      },
    }))
  );

  return { batchId: batch.id, jobCount: createdJobs.length };
}
