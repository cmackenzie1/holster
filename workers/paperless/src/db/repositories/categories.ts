import { and, eq, isNull } from "drizzle-orm";
import { generateColorFromString } from "../../utils/format";
import type { Database } from "../index";
import { categories } from "../schema";

export interface CategoryData {
	id: string;
	name: string;
	color: string | null;
}

/**
 * Get all categories that are not soft-deleted, ordered by name.
 */
export async function listCategories(db: Database): Promise<CategoryData[]> {
	const results = await db
		.select({
			id: categories.id,
			name: categories.name,
			color: categories.color,
		})
		.from(categories)
		.where(isNull(categories.deletedAt));

	return results.map((c) => ({
		id: c.id.toString(),
		name: c.name,
		color: c.color,
	}));
}

/**
 * Get a category by ID, ensuring it's not soft-deleted.
 * Returns null if not found or deleted.
 */
export async function getCategoryById(
	db: Database,
	id: bigint,
): Promise<CategoryData | null> {
	const [category] = await db
		.select({
			id: categories.id,
			name: categories.name,
			color: categories.color,
		})
		.from(categories)
		.where(and(eq(categories.id, id), isNull(categories.deletedAt)))
		.limit(1);

	if (!category) {
		return null;
	}

	return {
		id: category.id.toString(),
		name: category.name,
		color: category.color,
	};
}

/**
 * Create a new category.
 * If no color is provided, one is auto-generated from the category name.
 */
export async function createCategory(
	db: Database,
	name: string,
	color?: string | null,
): Promise<CategoryData> {
	const trimmedName = name.trim();
	const resolvedColor = color?.trim() || generateColorFromString(trimmedName);

	const [newCategory] = await db
		.insert(categories)
		.values({
			name: trimmedName,
			color: resolvedColor,
		})
		.returning({
			id: categories.id,
			name: categories.name,
			color: categories.color,
		});

	return {
		id: newCategory.id.toString(),
		name: newCategory.name,
		color: newCategory.color,
	};
}

/**
 * Update a category's name and/or color.
 * Returns true if updated, false if not found.
 */
export async function updateCategory(
	db: Database,
	id: bigint,
	updates: { name?: string; color?: string | null },
): Promise<boolean> {
	const [existing] = await db
		.select({ id: categories.id })
		.from(categories)
		.where(and(eq(categories.id, id), isNull(categories.deletedAt)))
		.limit(1);

	if (!existing) {
		return false;
	}

	const updateData: { name?: string; color?: string | null } = {};
	if (updates.name !== undefined) updateData.name = updates.name.trim();
	if (updates.color !== undefined)
		updateData.color = updates.color?.trim() || null;

	if (Object.keys(updateData).length > 0) {
		await db.update(categories).set(updateData).where(eq(categories.id, id));
	}

	return true;
}

/**
 * Soft-delete a category by ID.
 * Returns true if deleted, false if not found.
 */
export async function softDeleteCategory(
	db: Database,
	id: bigint,
): Promise<boolean> {
	const [existing] = await db
		.select({ id: categories.id })
		.from(categories)
		.where(and(eq(categories.id, id), isNull(categories.deletedAt)))
		.limit(1);

	if (!existing) {
		return false;
	}

	await db
		.update(categories)
		.set({ deletedAt: new Date() })
		.where(eq(categories.id, id));

	return true;
}
