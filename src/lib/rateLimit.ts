import type { NextRequest } from "next/server";

type Bucket = { count: number; reset: number };

const g = globalThis as typeof globalThis & {
  __mehfilRateLimit?: Map<string, Bucket>;
};
const buckets: Map<string, Bucket> =
  g.__mehfilRateLimit ?? (g.__mehfilRateLimit = new Map());

/**
 * Tiny fixed-window rate limiter (per IP, per scope).
 * Returns a 429 Response when the limit is exceeded, otherwise null.
 */
export function rateLimit(
  req: NextRequest,
  scope: string,
  max: number,
  windowMs: number
): Response | null {
  const ip =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.reset) {
    if (buckets.size > 5000) buckets.clear();
    buckets.set(key, { count: 1, reset: now + windowMs });
    return null;
  }

  bucket.count += 1;
  if (bucket.count > max) {
    return Response.json(
      { error: "Too many requests — please slow down a little." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((bucket.reset - now) / 1000))),
        },
      }
    );
  }
  return null;
}