function rateLimitKey(req, username) {
  const ip =
    req.headers["x-forwarded-for"] ||
    req.socket.remoteAddress ||
    req.ip ||
    "unknown";
  return `${String(username || "").toLowerCase()}::${ip}`;
}

export function createLoginTracker({ limit, windowMs }) {
  const attempts = new Map();

  function checkLock(req, username) {
    const key = rateLimitKey(req, username);
    const current = attempts.get(key);
    if (!current) {
      return { locked: false };
    }

    const now = Date.now();
    if (current.lockedUntil && current.lockedUntil > now) {
      return { locked: true, retryInMs: current.lockedUntil - now };
    }

    if (current.lockedUntil && current.lockedUntil <= now) {
      attempts.delete(key);
    }

    return { locked: false };
  }

  function registerFailure(req, username) {
    const key = rateLimitKey(req, username);
    const now = Date.now();
    const current = attempts.get(key) || {
      count: 0,
      firstAttemptAt: now,
      lockedUntil: null
    };

    if (now - current.firstAttemptAt > windowMs) {
      current.count = 0;
      current.firstAttemptAt = now;
      current.lockedUntil = null;
    }

    current.count += 1;
    if (current.count >= limit) {
      current.lockedUntil = now + windowMs;
      current.count = 0;
      current.firstAttemptAt = now;
    }

    attempts.set(key, current);
  }

  function clearFailures(req, username) {
    const key = rateLimitKey(req, username);
    attempts.delete(key);
  }

  return {
    checkLock,
    registerFailure,
    clearFailures
  };
}

export function requireOperatorAuth(req, res, next) {
  if (req.session?.user?.role === "operator") {
    next();
    return;
  }

  res.status(401).json({ error: "Veritas: Operator sign-in is required." });
}
