import crypto from "crypto";
import { config } from "../config.js";

const matches = (provided, expected) => {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const requireApiKey = (req, res, next) => {
  if (!config.apiKey) return next();

  const header = req.get("x-api-key") || "";
  const bearer = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const provided = header || bearer;

  if (!provided || !matches(provided, config.apiKey)) {
    return res.status(401).json({ error: "Invalid or missing API key" });
  }

  next();
};
