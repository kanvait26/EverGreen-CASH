import { getDb } from "@/db";
import { newId, nowIso } from "@/lib/ids";

export async function writeAudit(
  entityType: string,
  entityId: string,
  action: string,
  payload: unknown = {},
): Promise<void> {
  const db = getDb();
  await db.auditLogs.add({
    id: newId(),
    entityType,
    entityId,
    action,
    payloadJson: JSON.stringify(payload),
    createdAt: nowIso(),
  });
}
