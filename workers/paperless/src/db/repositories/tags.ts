import { eq, and, isNull } from "drizzle-orm";
import type { Database } from "../index";
import { tags } from "../schema";

export interface TagData {
  id: string;
  name: string;
  color: string | null;
}

/**
 * Get all tags that are not soft-deleted.
 */
export async function listTags(db: Database): Promise<TagData[]> {
  const results = await db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(tags)
    .where(isNull(tags.deletedAt));

  return results.map((t) => ({
    id: t.id.toString(),
    name: t.name,
    color: t.color,
  }));
}

/**
 * Get a tag by ID, ensuring it's not soft-deleted.
 * Returns null if not found or deleted.
 */
export async function getTagById(
  db: Database,
  id: bigint
): Promise<TagData | null> {
  const [tag] = await db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(tags)
    .where(and(eq(tags.id, id), isNull(tags.deletedAt)))
    .limit(1);

  if (!tag) {
    return null;
  }

  return {
    id: tag.id.toString(),
    name: tag.name,
    color: tag.color,
  };
}

/**
 * Normalize a tag name: trim whitespace and convert to lowercase.
 */
export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Create a new tag. Tag names are normalized (trimmed and lowercased).
 */
export async function createTag(
  db: Database,
  name: string,
  color?: string | null
): Promise<TagData> {
  const normalizedName = normalizeTagName(name);

  const [newTag] = await db
    .insert(tags)
    .values({
      name: normalizedName,
      color: color?.trim() || null,
    })
    .returning({
      id: tags.id,
      name: tags.name,
      color: tags.color,
    });

  return {
    id: newTag.id.toString(),
    name: newTag.name,
    color: newTag.color,
  };
}

/**
 * Update a tag's name and/or color.
 * Returns true if updated, false if not found.
 */
export async function updateTag(
  db: Database,
  id: bigint,
  updates: { name?: string; color?: string | null }
): Promise<boolean> {
  // Check if tag exists and is not deleted
  const [existing] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.id, id), isNull(tags.deletedAt)))
    .limit(1);

  if (!existing) {
    return false;
  }

  const updateData: { name?: string; color?: string | null } = {};
  if (updates.name !== undefined) updateData.name = updates.name.trim();
  if (updates.color !== undefined)
    updateData.color = updates.color?.trim() || null;

  if (Object.keys(updateData).length > 0) {
    await db.update(tags).set(updateData).where(eq(tags.id, id));
  }

  return true;
}

/**
 * Soft-delete a tag by ID.
 * Returns true if deleted, false if not found.
 */
export async function softDeleteTag(db: Database, id: bigint): Promise<boolean> {
  // Check if tag exists and is not already deleted
  const [existing] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.id, id), isNull(tags.deletedAt)))
    .limit(1);

  if (!existing) {
    return false;
  }

  await db
    .update(tags)
    .set({ deletedAt: new Date() })
    .where(eq(tags.id, id));

  return true;
}
