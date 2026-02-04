import { eq, and, isNull } from "drizzle-orm";
import type { Database } from "../index";
import { correspondents } from "../schema";

export interface CorrespondentData {
  id: string;
  name: string;
}

/**
 * Get all correspondents that are not soft-deleted.
 */
export async function listCorrespondents(
  db: Database
): Promise<CorrespondentData[]> {
  const results = await db
    .select({
      id: correspondents.id,
      name: correspondents.name,
    })
    .from(correspondents)
    .where(isNull(correspondents.deletedAt));

  return results.map((c) => ({
    id: c.id.toString(),
    name: c.name,
  }));
}

/**
 * Get a correspondent by ID, ensuring it's not soft-deleted.
 * Returns null if not found or deleted.
 */
export async function getCorrespondentById(
  db: Database,
  id: bigint
): Promise<CorrespondentData | null> {
  const [correspondent] = await db
    .select({
      id: correspondents.id,
      name: correspondents.name,
    })
    .from(correspondents)
    .where(and(eq(correspondents.id, id), isNull(correspondents.deletedAt)))
    .limit(1);

  if (!correspondent) {
    return null;
  }

  return {
    id: correspondent.id.toString(),
    name: correspondent.name,
  };
}

/**
 * Create a new correspondent.
 */
export async function createCorrespondent(
  db: Database,
  name: string
): Promise<CorrespondentData> {
  const [newCorrespondent] = await db
    .insert(correspondents)
    .values({ name: name.trim() })
    .returning({
      id: correspondents.id,
      name: correspondents.name,
    });

  return {
    id: newCorrespondent.id.toString(),
    name: newCorrespondent.name,
  };
}

/**
 * Update a correspondent's name.
 * Returns true if updated, false if not found.
 */
export async function updateCorrespondent(
  db: Database,
  id: bigint,
  name: string
): Promise<boolean> {
  // Check if correspondent exists and is not deleted
  const [existing] = await db
    .select({ id: correspondents.id })
    .from(correspondents)
    .where(and(eq(correspondents.id, id), isNull(correspondents.deletedAt)))
    .limit(1);

  if (!existing) {
    return false;
  }

  await db
    .update(correspondents)
    .set({ name: name.trim() })
    .where(eq(correspondents.id, id));

  return true;
}

/**
 * Soft-delete a correspondent by ID.
 * Returns true if deleted, false if not found.
 */
export async function softDeleteCorrespondent(
  db: Database,
  id: bigint
): Promise<boolean> {
  // Check if correspondent exists and is not already deleted
  const [existing] = await db
    .select({ id: correspondents.id })
    .from(correspondents)
    .where(and(eq(correspondents.id, id), isNull(correspondents.deletedAt)))
    .limit(1);

  if (!existing) {
    return false;
  }

  await db
    .update(correspondents)
    .set({ deletedAt: new Date() })
    .where(eq(correspondents.id, id));

  return true;
}
