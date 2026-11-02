import { getDb } from "@/db";
import { writeAudit } from "@/lib/audit";
import { newId, nowIso } from "@/lib/ids";
import type { Person } from "@/lib/types";

export interface PersonInput {
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export async function createPerson(input: PersonInput): Promise<Person> {
  const name = input.name.trim();
  if (!name) throw new Error("الاسم مطلوب");
  const now = nowIso();
  const person: Person = {
    id: newId(),
    name,
    phone: input.phone?.trim() ?? "",
    address: input.address?.trim() ?? "",
    notes: input.notes?.trim() ?? "",
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  await getDb().people.add(person);
  await writeAudit("person", person.id, "create", { name });
  return person;
}

export async function updatePerson(id: string, input: PersonInput): Promise<Person> {
  const db = getDb();
  const existing = await db.people.get(id);
  if (!existing) throw new Error("الشخص غير موجود");
  const name = input.name.trim();
  if (!name) throw new Error("الاسم مطلوب");
  const next: Person = {
    ...existing,
    name,
    phone: input.phone?.trim() ?? "",
    address: input.address?.trim() ?? "",
    notes: input.notes?.trim() ?? "",
    updatedAt: nowIso(),
  };
  await db.people.put(next);
  await writeAudit("person", id, "update", { name });
  return next;
}

export async function archivePerson(id: string): Promise<void> {
  const db = getDb();
  const existing = await db.people.get(id);
  if (!existing) throw new Error("الشخص غير موجود");
  await db.people.update(id, { archived: true, updatedAt: nowIso() });
  await writeAudit("person", id, "archive", {});
}

export async function restorePerson(id: string): Promise<void> {
  const db = getDb();
  await db.people.update(id, { archived: false, updatedAt: nowIso() });
  await writeAudit("person", id, "restore", {});
}

export async function searchPeople(query: string, includeArchived = false): Promise<Person[]> {
  const db = getDb();
  const all = await db.people.orderBy("name").toArray();
  const q = query.trim();
  return all.filter((p) => {
    if (!includeArchived && p.archived) return false;
    if (!q) return true;
    return p.name.includes(q) || p.phone.includes(q);
  });
}

export async function getPerson(id: string): Promise<Person | undefined> {
  return getDb().people.get(id);
}

export async function canDeletePerson(id: string): Promise<boolean> {
  const db = getDb();
  const linkedEvent = await db.ledgerEvents.where("personId").equals(id).first();
  if (linkedEvent) return false;
  const linkedInvoice = await db.invoices.where("customerPersonId").equals(id).first();
  if (linkedInvoice) return false;
  const linkedAdvance = await db.advances.where("personId").equals(id).first();
  return !linkedAdvance;
}

export async function deletePerson(id: string): Promise<void> {
  if (!(await canDeletePerson(id))) {
    throw new Error("لا يمكن حذف شخص مرتبط بسجلات. استخدم الأرشفة.");
  }
  await getDb().people.delete(id);
  await writeAudit("person", id, "delete", {});
}
