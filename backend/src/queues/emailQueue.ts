import { Queue } from "bullmq";
import { redisConnection } from "../lib/redis";

export const EMAIL_QUEUE_NAME = "email-queue";

export interface EmailJobData {
  emailJobId: string;
}

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail: false,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});

/** Adds a delayed job whose id is the DB EmailJob id, giving us idempotency:
 *  BullMQ silently no-ops if a job with that id already exists in the queue. */
export async function enqueueEmailJob(emailJobId: string, delayMs: number) {
  return emailQueue.add(
    "send-email",
    { emailJobId },
    { jobId: emailJobId, delay: Math.max(delayMs, 0) }
  );
}
