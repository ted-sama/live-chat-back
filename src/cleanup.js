import fs from "fs/promises";
import path from "path";

const QUOTA_GRACE_MS = 60 * 1000;

const listUploads = async (directory) => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith(".")) continue;

    const filePath = path.join(directory, entry.name);
    try {
      const stats = await fs.stat(filePath);
      files.push({ path: filePath, size: stats.size, mtimeMs: stats.mtimeMs });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  return files;
};

const remove = async (filePath) => {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    console.error(`[cleanup] failed to delete ${filePath}:`, error.message);
    return false;
  }
};

export const purgeUploads = async (directory) => {
  await fs.mkdir(directory, { recursive: true });
  const files = await listUploads(directory);
  const deleted = (await Promise.all(files.map(({ path: p }) => remove(p)))).filter(Boolean).length;

  if (deleted > 0) console.log(`[cleanup] startup purge removed ${deleted} file(s)`);
};

export const sweepUploads = async (directory, { ttlMs, maxTotalBytes }) => {
  await fs.mkdir(directory, { recursive: true });

  const now = Date.now();
  let files = await listUploads(directory);
  let expired = 0;

  for (const file of files) {
    if (now - file.mtimeMs > ttlMs && (await remove(file.path))) expired += 1;
  }

  files = files.filter((file) => now - file.mtimeMs <= ttlMs);

  let total = files.reduce((sum, file) => sum + file.size, 0);
  let evicted = 0;

  if (total > maxTotalBytes) {
    // Files still being written have a fresh mtime; the grace window keeps them safe.
    const evictable = files
      .filter((file) => now - file.mtimeMs > QUOTA_GRACE_MS)
      .sort((a, b) => a.mtimeMs - b.mtimeMs);

    for (const file of evictable) {
      if (total <= maxTotalBytes) break;
      if (await remove(file.path)) {
        total -= file.size;
        evicted += 1;
      }
    }
  }

  if (expired > 0 || evicted > 0) {
    console.log(
      `[cleanup] expired=${expired} evicted=${evicted} remaining=${(total / 1048576).toFixed(1)}MB`
    );
  }

  return { expired, evicted, totalBytes: total };
};

export const startUploadsJanitor = (directory, { ttlMs, maxTotalBytes, sweepIntervalMs }) => {
  const run = () =>
    sweepUploads(directory, { ttlMs, maxTotalBytes }).catch((error) =>
      console.error("[cleanup] sweep failed:", error.message)
    );

  run();
  const timer = setInterval(run, sweepIntervalMs);
  timer.unref();
  return () => clearInterval(timer);
};

export const uploadsUsage = async (directory) => {
  try {
    const files = await listUploads(directory);
    return {
      files: files.length,
      bytes: files.reduce((sum, file) => sum + file.size, 0),
    };
  } catch {
    return { files: 0, bytes: 0 };
  }
};
