import path from "path";

export const PHOTO_DIR = path.join(process.cwd(), "data", "photos");
export const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 10 MB

export const PHOTO_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
