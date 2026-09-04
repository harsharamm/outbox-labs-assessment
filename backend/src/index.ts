import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "./config/passport";
import { env } from "./config/env";
import { ensureEmailsIndex } from "./lib/elasticsearch";
import { startEmailWorker } from "./queues/emailWorker";
import { reconcileScheduledJobs } from "./startup/reconcile";
import { buildBullBoardRouter } from "./queues/bullboard";
import { requireAuth } from "./middleware/auth";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import senderRoutes from "./routes/sender.routes";
import emailRoutes from "./routes/email.routes";

const app = express();

app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(passport.initialize());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/api", userRoutes);
app.use("/api/senders", senderRoutes);
app.use("/api/emails", emailRoutes);

// Live BullMQ dashboard, gated behind the same auth as the rest of the API.
app.use("/admin/queues", requireAuth, buildBullBoardRouter("/admin/queues"));

async function main() {
  await ensureEmailsIndex().catch((err) =>
    console.error("[startup] elasticsearch index setup failed (continuing):", err.message)
  );

  startEmailWorker();
  await reconcileScheduledJobs();

  app.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port}`);
    console.log(`[server] BullMQ dashboard at http://localhost:${env.port}/admin/queues`);
  });
}

main().catch((err) => {
  console.error("[startup] fatal error", err);
  process.exit(1);
});
