const buckets = new Map();

const WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000);
const MAX_ATTEMPTS = Number(process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS || 40);
const BLOCK_MS = Number(process.env.AUTH_RATE_LIMIT_BLOCK_MS || 15 * 60 * 1000);

const cleanupStaleBuckets = () => {
    const now = Date.now();
    for (const [key, value] of buckets.entries()) {
        if (value.blockedUntil && value.blockedUntil > now) continue;
        if (now - value.windowStart > WINDOW_MS) {
            buckets.delete(key);
        }
    }
};

setInterval(cleanupStaleBuckets, Math.max(60_000, Math.floor(WINDOW_MS / 2))).unref();

export const authRateLimit = (req, res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
    const key = `${ip}:${req.path}`;
    const now = Date.now();

    const current = buckets.get(key) || {
        count: 0,
        windowStart: now,
        blockedUntil: 0,
    };

    if (current.blockedUntil > now) {
        return res.status(429).json({
            success: false,
            message: "Too many attempts. Please try again later.",
        });
    }

    if (now - current.windowStart > WINDOW_MS) {
        current.count = 0;
        current.windowStart = now;
    }

    current.count += 1;

    if (current.count > MAX_ATTEMPTS) {
        current.blockedUntil = now + BLOCK_MS;
        buckets.set(key, current);
        return res.status(429).json({
            success: false,
            message: "Too many attempts. Please try again later.",
        });
    }

    buckets.set(key, current);
    next();
};
