import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { afterEach } from "vitest";
import { getDb, resetDbSingleton } from "@/db";

afterEach(async () => {
  try {
    const db = getDb();
    db.close();
    await db.delete();
  } catch {
    /* ignore */
  }
  resetDbSingleton();
});
