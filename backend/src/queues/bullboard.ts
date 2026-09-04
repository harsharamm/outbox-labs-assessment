import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { emailQueue } from "./emailQueue";

export function buildBullBoardRouter(basePath: string) {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(basePath);

  // Minor type mismatch between the installed bullmq and @bull-board/api
  // Job type declarations; functionally compatible at runtime.
  createBullBoard({
    queues: [new BullMQAdapter(emailQueue) as any],
    serverAdapter,
  });

  return serverAdapter.getRouter();
}
