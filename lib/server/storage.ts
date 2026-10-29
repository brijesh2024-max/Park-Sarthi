import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_KEY = /^[a-f0-9-]+\.(jpg|png|webp)$/;

export class PhotoStorageError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "PhotoStorageError";
  }
}

type StorageConfig = { url: string; key: string; bucket: string };
let cached: { config: StorageConfig; client: SupabaseClient } | undefined;

function config(): StorageConfig {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "parking-photos";
  if (!url || !key) {
    throw new PhotoStorageError(503, "Photo storage is not configured yet. Please try again after setup.");
  }
  let parsed: URL;
  try { parsed = new URL(url); } catch {
    throw new PhotoStorageError(503, "Photo storage configuration needs attention.");
  }
  const local = process.env.NODE_ENV !== "production"
    && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if ((!local && parsed.protocol !== "https:") || parsed.username || parsed.password
    || parsed.search || parsed.hash || !["", "/"].includes(parsed.pathname)
    || !/^[a-zA-Z0-9_-]{1,100}$/.test(bucket)) {
    throw new PhotoStorageError(503, "Photo storage configuration needs attention.");
  }
  return { url: parsed.origin, key, bucket };
}

function storage() {
  const value = config();
  if (!cached || cached.config.url !== value.url || cached.config.key !== value.key) {
    cached = {
      config: value,
      client: createClient(value.url, value.key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: {
          fetch: (input, init) => fetch(input, {
            ...init,
            cache: "no-store",
            signal: init?.signal
              ? AbortSignal.any([init.signal, AbortSignal.timeout(15_000)])
              : AbortSignal.timeout(15_000),
          }),
        },
      }),
    };
  }
  return cached.client.storage.from(value.bucket);
}

function checkKey(key: string) {
  if (!PHOTO_KEY.test(key)) throw new PhotoStorageError(400, "Invalid photo identifier.");
}

// Only server routes call this adapter, after verifying the current user's
// permission. The service key bypasses storage RLS and is never sent to clients.
export async function putPhoto(
  key: string,
  bytes: Uint8Array,
  metadata: { contentType: string; ownerId: string },
): Promise<void> {
  checkKey(key);
  const expectedType = key.endsWith(".jpg") ? "image/jpeg" : key.endsWith(".png") ? "image/png" : "image/webp";
  if (bytes.byteLength < 16 || bytes.byteLength > MAX_PHOTO_BYTES || metadata.contentType !== expectedType) {
    throw new PhotoStorageError(400, "Upload a JPEG, PNG or WebP photo smaller than 5 MB.");
  }
  try {
    const { error } = await storage().upload(key, bytes, {
      contentType: metadata.contentType,
      cacheControl: "0",
      upsert: false,
      metadata: { ownerId: metadata.ownerId },
    });
    if (error) throw new PhotoStorageError(502, "Your photo could not be stored. Please try again.");
  } catch (error) {
    if (error instanceof PhotoStorageError) throw error;
    throw new PhotoStorageError(502, "Photo storage did not respond. Please try again.");
  }
}

export async function getPhoto(key: string): Promise<{ body: Blob } | null> {
  checkKey(key);
  try {
    const { data, error } = await storage().download(key);
    if (error) {
      const details = error as { statusCode?: string | number; status?: number; code?: string };
      if (String(details.statusCode ?? details.status) === "404"
        || details.code === "NoSuchKey" || details.code === "not_found") return null;
      throw new PhotoStorageError(502, "This photo could not be loaded. Please try again.");
    }
    return data ? { body: data } : null;
  } catch (error) {
    if (error instanceof PhotoStorageError) throw error;
    throw new PhotoStorageError(502, "Photo storage did not respond. Please try again.");
  }
}

export async function deletePhoto(key: string): Promise<void> {
  checkKey(key);
  try {
    const { error } = await storage().remove([key]);
    if (error) throw new PhotoStorageError(502, "Photo cleanup could not be completed.");
  } catch (error) {
    if (error instanceof PhotoStorageError) throw error;
    throw new PhotoStorageError(502, "Photo cleanup could not be completed.");
  }
}
