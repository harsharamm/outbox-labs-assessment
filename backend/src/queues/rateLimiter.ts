import { redisConnection } from "../lib/redis";

/** Hour-window key such as "rl:<senderId>:2026090411" (UTC, hourly bucket). */
function hourWindowKey(senderId: string, at: Date): string {
  const y = at.getUTCFullYear();
  const m = String(at.getUTCMonth() + 1).padStart(2, "0");
  const d = String(at.getUTCDate()).padStart(2, "0");
  const h = String(at.getUTCHours()).padStart(2, "0");
  return `rl:${senderId}:${y}${m}${d}${h}`;
}

export function startOfNextHour(from: Date): Date {
  const next = new Date(from);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return next;
}

/**
 * Atomically increments the per-sender hourly send counter and reports
 * whether this send is still within `limit`. Safe across multiple worker
 * processes/instances because Redis INCR is atomic; the key auto-expires
 * so it never needs manual resetting.
 */
export async function tryConsumeHourlySlot(
  senderId: string,
  limit: number,
  now = new Date()
): Promise<{ allowed: boolean; count: number }> {
  const key = hourWindowKey(senderId, now);
  const count = await redisConnection.incr(key);
  if (count === 1) {
    // first increment in this window: expire in a bit over an hour
    await redisConnection.expire(key, 3660);
  }
  if (count > limit) {
    // release the slot we just claimed since this send is being rejected
    await redisConnection.decr(key);
    return { allowed: false, count: count - 1 };
  }
  return { allowed: true, count };
}
