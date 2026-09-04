import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const LOCAL_AUDIO_PROTOCOL = "local-audio:";

function storageRoot() {
  return path.resolve(process.cwd(), ".local-data", "audio");
}

function safeSegment(value: string) {
  const normalized = value.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
  if (!normalized) throw new Error("FILE_INVALID");
  return normalized;
}

function assertLocalStorageAllowed() {
  if (process.env.NODE_ENV === "production") throw new Error("CONFIGURATION_ERROR");
}

function resolveLocalPath(url: string) {
  assertLocalStorageAllowed();
  const parsed = new URL(url);
  if (parsed.protocol !== LOCAL_AUDIO_PROTOCOL) throw new Error("FILE_INVALID");
  const segments = parsed.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (!segments.length || segments.some((segment) => segment === "." || segment === "..")) throw new Error("FILE_INVALID");
  const root = storageRoot();
  const target = path.resolve(root, ...segments);
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error("FILE_INVALID");
  return target;
}

export function isLocalAudioUrl(url: string) {
  try {
    return new URL(url).protocol === LOCAL_AUDIO_PROTOCOL;
  } catch {
    return false;
  }
}

export async function saveLocalAudio(input: { organizationId: string; prepId: string; originalName: string; bytes: Uint8Array }) {
  assertLocalStorageAllowed();
  const segments = [safeSegment(input.organizationId), safeSegment(input.prepId), `${randomUUID()}-${safeSegment(input.originalName)}`];
  const relativePath = path.join(...segments);
  const target = path.resolve(storageRoot(), relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, input.bytes);
  const pathname = relativePath.split(path.sep).join("/");
  const encodedPath = pathname.split("/").map(encodeURIComponent).join("/");
  return {
    pathname: `local/${pathname}`,
    url: `${LOCAL_AUDIO_PROTOCOL}///${encodedPath}`,
    etag: createHash("sha256").update(input.bytes).digest("hex"),
  };
}

export async function readLocalAudio(url: string) {
  return readFile(resolveLocalPath(url));
}

export async function deleteLocalAudio(url: string) {
  await rm(resolveLocalPath(url), { force: true });
}
