import { encryptSnapshot, decryptSnapshot, recordBackupMeta, snapshotCounts } from "@/lib/backup";
import { nowIso } from "@/lib/ids";
import { getSettings, updateSettings } from "@/lib/settings";
import type { SnapshotPayload } from "@/lib/types";

const APPDATA = "https://www.googleapis.com/auth/drive.appdata";
const TOKEN_KEY = "eg_gis_access_token";
const TOKEN_EXP_KEY = "eg_gis_access_exp";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string; expires_in?: number }) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

function clientId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
}

export function isGoogleConfigured(): boolean {
  return Boolean(clientId());
}

export function loadGisScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-eg-gis]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("تعذر تحميل Google Identity")));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.dataset.egGis = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("تعذر تحميل Google Identity"));
    document.head.appendChild(s);
  });
}

function storedToken(): string | null {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const exp = Number(sessionStorage.getItem(TOKEN_EXP_KEY) ?? 0);
  if (!token || Date.now() > exp - 15_000) return null;
  return token;
}

export async function connectGoogle(): Promise<string> {
  if (!isGoogleConfigured()) {
    throw new Error("أضف NEXT_PUBLIC_GOOGLE_CLIENT_ID في ملف البيئة");
  }
  await loadGisScript();
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId(),
      scope: APPDATA,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error || "تم رفض التفويض"));
          return;
        }
        const expires = Date.now() + (resp.expires_in ?? 3600) * 1000;
        sessionStorage.setItem(TOKEN_KEY, resp.access_token);
        sessionStorage.setItem(TOKEN_EXP_KEY, String(expires));
        resolve(resp.access_token);
      },
    });
    client.requestAccessToken({ prompt: "consent" });
  });
}

export async function getAccessToken(interactive = true): Promise<string> {
  const cached = storedToken();
  if (cached) return cached;
  if (!interactive) throw new Error("يلزم إعادة ربط Google Drive");
  return connectGoogle();
}

export async function disconnectGoogle(): Promise<void> {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(token);
  }
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_EXP_KEY);
  await updateSettings({ googleAccountEmail: null });
}

async function driveFetch(path: string, init: RequestInit, token: string) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Drive: ${res.status} ${text.slice(0, 180)}`);
  }
  return res;
}

export interface DriveFileInfo {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
}

export async function listDriveBackups(): Promise<DriveFileInfo[]> {
  const token = await getAccessToken(true);
  const q = encodeURIComponent("name contains 'evergreen-cash-' and trashed = false");
  const res = await driveFetch(
    `files?spaces=appDataFolder&fields=files(id,name,createdTime,size)&q=${q}&orderBy=createdTime desc`,
    { method: "GET" },
    token,
  );
  const json = (await res.json()) as { files: DriveFileInfo[] };
  return json.files ?? [];
}

export async function uploadEncryptedBackup(passphrase: string): Promise<{ fileId: string; fileName: string }> {
  const { bytes, fileName, snapshot } = await encryptSnapshot(passphrase);
  const token = await getAccessToken(true);
  const metadata = {
    name: fileName,
    parents: ["appDataFolder"],
  };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([bytes as BlobPart], { type: "application/octet-stream" }));
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    await recordBackupMeta({
      source: "drive",
      driveFileId: null,
      fileName,
      createdAt: nowIso(),
      recordCounts: snapshotCounts(snapshot),
      schemaVersion: snapshot.schemaVersion,
      verified: false,
      sizeBytes: bytes.byteLength,
      success: false,
      error: text.slice(0, 200),
    });
    throw new Error("فشل رفع النسخة الاحتياطية");
  }
  const created = (await res.json()) as { id: string; name: string; size?: string };
  const verify = await driveFetch(`files/${created.id}?fields=id,name,size`, { method: "GET" }, token);
  const verified = await verify.json();
  await recordBackupMeta({
    source: "drive",
    driveFileId: created.id,
    fileName,
    createdAt: nowIso(),
    recordCounts: snapshotCounts(snapshot),
    schemaVersion: snapshot.schemaVersion,
    verified: Boolean(verified?.id),
    sizeBytes: bytes.byteLength,
    success: true,
    error: null,
  });
  const settings = await getSettings();
  if (!settings.googleAccountEmail) {
    await updateSettings({ googleAccountEmail: "connected" });
  }
  await pruneOldDriveBackups(token);
  return { fileId: created.id, fileName };
}

async function pruneOldDriveBackups(token: string) {
  try {
    const files = await listDriveBackups();
    const extra = files.slice(7);
    for (const f of extra) {
      await driveFetch(`files/${f.id}`, { method: "DELETE" }, token).catch(() => undefined);
    }
  } catch {
    return;
  }
}

export async function downloadDriveBackup(fileId: string, passphrase: string): Promise<SnapshotPayload> {
  const token = await getAccessToken(true);
  const res = await driveFetch(`files/${fileId}?alt=media`, { method: "GET" }, token);
  const text = await res.text();
  return decryptSnapshot(text, passphrase);
}

export async function tryAutoBackup(passphraseProvider: () => string | null): Promise<boolean> {
  if (!navigator.onLine) return false;
  if (!storedToken()) return false;
  const passphrase = passphraseProvider();
  if (!passphrase) return false;
  try {
    await uploadEncryptedBackup(passphrase);
    return true;
  } catch {
    return false;
  }
}
