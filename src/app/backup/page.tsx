"use client";

import { Button, Card, Empty, Field, Input } from "@/components/ui";
import { useToast } from "@/components/toast";
import {
  decryptSnapshot,
  downloadBytes,
  encryptSnapshot,
  listBackupMeta,
  recordBackupMeta,
  restoreSnapshot,
  snapshotCounts,
} from "@/lib/backup";
import {
  connectGoogle,
  disconnectGoogle,
  downloadDriveBackup,
  isGoogleConfigured,
  listDriveBackups,
  uploadEncryptedBackup,
  type DriveFileInfo,
} from "@/lib/drive";
import { formatDateTime } from "@/lib/dates";
import { getSettings } from "@/lib/settings";
import type { BackupMeta, SnapshotPayload } from "@/lib/types";
import { nowIso } from "@/lib/ids";
import { rememberPassphrase } from "@/lib/auto-backup";
import { useCallback, useEffect, useState } from "react";

export default function BackupPage() {
  const { push } = useToast();
  const [pass, setPass] = useState("");
  const [history, setHistory] = useState<BackupMeta[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveFileInfo[]>([]);
  const [pending, setPending] = useState<SnapshotPayload | null>(null);
  const [pendingLabel, setPendingLabel] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setHistory(await listBackupMeta());
    const s = await getSettings();
    setEmail(s.googleAccountEmail);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function doLocalExport() {
    try {
      setBusy(true);
      const { bytes, fileName, snapshot } = await encryptSnapshot(pass);
      downloadBytes(fileName, bytes, "application/octet-stream");
      await recordBackupMeta({
        source: "file",
        driveFileId: null,
        fileName,
        createdAt: nowIso(),
        recordCounts: snapshotCounts(snapshot),
        schemaVersion: snapshot.schemaVersion,
        verified: true,
        sizeBytes: bytes.byteLength,
        success: true,
        error: null,
      });
      rememberPassphrase(pass);
      push("تم تنزيل النسخة المشفّرة");
      await reload();
    } catch (err) {
      push(err instanceof Error ? err.message : "فشل التصدير", "err");
    } finally {
      setBusy(false);
    }
  }

  async function doDriveBackup() {
    try {
      setBusy(true);
      await uploadEncryptedBackup(pass);
      rememberPassphrase(pass);
      push("رُفعت النسخة وتحقق الخادم من الملف");
      await reload();
    } catch (err) {
      push(err instanceof Error ? err.message : "فشل الرفع", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold text-forest-800">النسخ الاحتياطي</h1>
      <Card className="space-y-3 text-sm leading-7 text-forest-700">
        <p>
          تُشفَّر البيانات محلياً بـ AES-256-GCM ومفتاح مشتق من عبارة الاسترداد (PBKDF2). Google Drive يستخدم نطاق
          drive.appdata فقط. لا تُرسل العبارة إلى أي خادم.
        </p>
        <p>
          على iPadOS قد يُعلَّق تطبيق الويب في الخلفية ولا يكتمل المزامنة التلقائية. لا تعتمد على النسخ في الخلفية.
        </p>
      </Card>
      <Card className="space-y-3">
        <Field label="عبارة الاسترداد (٨ أحرف على الأقل)">
          <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="off" />
        </Field>
        <div className="flex flex-wrap gap-3">
          <Button disabled={busy} variant="secondary" onClick={doLocalExport}>
            تصدير ملف مشفّر
          </Button>
          <Button disabled={busy} onClick={doDriveBackup}>
            نسخ إلى Google Drive
          </Button>
          <Button
            variant="lime"
            onClick={async () => {
              try {
                await connectGoogle();
                push("تم ربط Google");
                await reload();
              } catch (err) {
                push(err instanceof Error ? err.message : "فشل الربط", "err");
              }
            }}
          >
            ربط Google
          </Button>
          <Button variant="ghost" onClick={() => disconnectGoogle().then(() => { push("تم الفصل"); reload(); })}>
            فصل Google
          </Button>
        </div>
        <p className="text-sm">{isGoogleConfigured() ? `الحالة: ${email ? "مرتبط" : "غير مرتبط"}` : "أضف NEXT_PUBLIC_GOOGLE_CLIENT_ID لتمكين Drive"}</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">استعادة من Drive</h2>
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              setDriveFiles(await listDriveBackups());
            } catch (err) {
              push(err instanceof Error ? err.message : "فشل القائمة", "err");
            }
          }}
        >
          عرض النسخ السحابية
        </Button>
        {driveFiles.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-2 rounded-2xl bg-forest-50 p-3">
            <span className="text-sm">{f.name}</span>
            <Button
              className="min-h-10 text-sm"
              onClick={async () => {
                try {
                  const snap = await downloadDriveBackup(f.id, pass);
                  setPending(snap);
                  setPendingLabel(f.name);
                } catch (err) {
                  push(err instanceof Error ? err.message : "فشل التنزيل", "err");
                }
              }}
            >
              اختيار
            </Button>
          </div>
        ))}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">استعادة من ملف</h2>
        <input
          type="file"
          accept=".egbak,application/json,.json"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const text = await file.text();
              const snap = await decryptSnapshot(text, pass);
              setPending(snap);
              setPendingLabel(file.name);
            } catch (err) {
              push(err instanceof Error ? err.message : "ملف غير صالح", "err");
            }
          }}
        />
      </Card>

      {pending ? (
        <Card className="space-y-3 ring-2 ring-amber-400">
          <h2 className="font-bold">تأكيد الاستعادة — {pendingLabel}</h2>
          <p>التاريخ: {formatDateTime(pending.exportedAt)}</p>
          <p>
            أشخاص {pending.people.length} · قيود {pending.ledgerEvents.length} · فواتير {pending.invoices.length}
          </p>
          <p className="text-sm text-red-800">سيتم أخذ نسخة أمان من البيانات الحالية ثم الاستبدال ذرياً. الفشل يُبقي القاعدة الحالية.</p>
          <div className="flex gap-3">
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  setBusy(true);
                  await restoreSnapshot(pending);
                  push("تمت الاستعادة");
                  setPending(null);
                  window.location.reload();
                } catch (err) {
                  push(err instanceof Error ? err.message : "فشلت الاستعادة وتم الإبقاء على البيانات", "err");
                } finally {
                  setBusy(false);
                }
              }}
            >
              استعادة الآن
            </Button>
            <Button variant="secondary" onClick={() => setPending(null)}>
              إلغاء
            </Button>
          </div>
        </Card>
      ) : null}

      <h2 className="text-xl font-bold">السجل</h2>
      {history.length === 0 ? (
        <Empty title="لا نسخ مسجّلة بعد" />
      ) : (
        history.map((h) => (
          <Card key={h.id} className="flex justify-between gap-3">
            <div>
              <p>{h.fileName}</p>
              <p className="text-sm text-forest-600">
                {formatDateTime(h.createdAt)} · {h.source} · {h.success ? "نجاح" : "فشل"}
              </p>
            </div>
            <span>{h.verified ? "موثّق" : "غير موثّق"}</span>
          </Card>
        ))
      )}
    </div>
  );
}
