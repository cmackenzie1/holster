import { env } from "cloudflare:workers";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
	ArrowLeft,
	Check,
	Edit2,
	FileText,
	Info,
	Loader2,
	Plus,
	Tag,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createDbFromHyperdrive, listTags } from "@/db";
import { generateColorFromString } from "@/utils/format";

interface TagData {
	id: string;
	name: string;
	color: string | null;
}

const getAllTags = createServerFn({ method: "GET" }).handler(async () => {
	const startTime = Date.now();
	const wideEvent: Record<string, unknown> = {
		function: "getAllTags",
		timestamp: new Date().toISOString(),
	};

	try {
		const db = createDbFromHyperdrive(env.HYPERDRIVE);
		const results = await listTags(db);

		wideEvent.tags_count = results.length;
		wideEvent.outcome = "success";

		return results;
	} catch (error) {
		wideEvent.outcome = "error";
		wideEvent.error = {
			message: error instanceof Error ? error.message : String(error),
			type: error instanceof Error ? error.name : "UnknownError",
		};
		throw error;
	} finally {
		wideEvent.duration_ms = Date.now() - startTime;
		console.log(JSON.stringify(wideEvent));
	}
});

export const Route = createFileRoute("/tags")({
	component: TagsPage,
	loader: async () => {
		const tags = await getAllTags();
		return { tags };
	},
});

function TagsPage() {
	const { tags: initialTags = [] } = Route.useLoaderData() ?? {};
	const [tags, setTags] = useState<TagData[]>(initialTags);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editName, setEditName] = useState("");
	const [editColor, setEditColor] = useState("");
	const [newName, setNewName] = useState("");
	const [newColor, setNewColor] = useState("#3b82f6");
	const [isCreating, setIsCreating] = useState(false);
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	// Sync tags when loader data changes
	useEffect(() => {
		setTags(initialTags ?? []);
	}, [initialTags]);

	// Auto-generate color when name changes
	useEffect(() => {
		setNewColor(generateColorFromString(newName));
	}, [newName]);

	const fetchTags = async () => {
		try {
			const response = await fetch("/api/tags");
			const data = (await response.json()) as { tags?: TagData[] };
			setTags(data.tags || []);
		} catch (error) {
			console.error("Failed to fetch tags:", error);
		}
	};

	const startEditing = (tag: TagData) => {
		setEditingId(tag.id);
		setEditName(tag.name);
		setEditColor(tag.color || "#3b82f6");
	};

	const cancelEditing = () => {
		setEditingId(null);
		setEditName("");
		setEditColor("");
	};

	const saveEdit = async () => {
		if (!editingId || !editName.trim()) return;

		try {
			const response = await fetch(`/api/tags/${editingId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: editName.trim(), color: editColor }),
			});

			if (response.ok) {
				await fetchTags();
				cancelEditing();
			}
		} catch (error) {
			console.error("Failed to update tag:", error);
		}
	};

	const createTag = async () => {
		if (!newName.trim()) return;

		setIsCreating(true);
		try {
			const response = await fetch("/api/tags", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: newName.trim(), color: newColor }),
			});

			if (response.ok) {
				await fetchTags();
				setNewName("");
				setNewColor("#3b82f6");
			}
		} catch (error) {
			console.error("Failed to create tag:", error);
		} finally {
			setIsCreating(false);
		}
	};

	const deleteTag = async (id: string) => {
		setIsDeleting(true);
		try {
			const response = await fetch(`/api/tags/${id}`, {
				method: "DELETE",
			});

			if (response.ok) {
				await fetchTags();
				setDeleteConfirmId(null);
			}
		} catch (error) {
			console.error("Failed to delete tag:", error);
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<div className="min-h-full">
			<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{/* Header */}
				<div className="mb-8">
					<Link
						to="/"
						className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
					>
						<ArrowLeft className="w-4 h-4" />
						Back to Documents
					</Link>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<Tag className="w-8 h-8 text-cyan-400" />
							<div>
								<h1 className="text-2xl font-bold text-white">Tags</h1>
								<p className="text-slate-400">
									{tags.length} tag{tags.length !== 1 ? "s" : ""}
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* Info Box */}
				<div className="flex gap-3 p-4 bg-slate-700/30 border border-slate-700 rounded-xl mb-6">
					<Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
					<div className="text-sm text-slate-300">
						<p>
							<span className="text-white font-medium">Tags</span> are labels to
							classify and organize documents. A document can have multiple
							tags.
						</p>
						<p className="text-slate-400 mt-1">
							Examples: Important, Tax Deductible, Needs Review, 2025, Warranty.
						</p>
					</div>
				</div>

				{/* Create New Tag */}
				<div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-6">
					<h2 className="text-lg font-semibold text-white mb-4">
						Create New Tag
					</h2>
					<div className="flex items-center gap-3">
						<input
							type="color"
							value={newColor}
							onChange={(e) => setNewColor(e.target.value)}
							className="w-12 h-12 rounded-lg cursor-pointer bg-transparent border-0"
						/>
						<input
							type="text"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							placeholder="Tag name..."
							className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
							onKeyDown={(e) => {
								if (e.key === "Enter") createTag();
							}}
						/>
						<button
							onClick={createTag}
							disabled={!newName.trim() || isCreating}
							className="flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
						>
							{isCreating ? (
								<Loader2 className="w-5 h-5 animate-spin" />
							) : (
								<Plus className="w-5 h-5" />
							)}
							Create
						</button>
					</div>
				</div>

				{/* Tags List */}
				<div className="bg-slate-800 rounded-xl border border-slate-700">
					<div className="p-4 border-b border-slate-700">
						<h2 className="text-lg font-semibold text-white">All Tags</h2>
					</div>

					{tags.length === 0 ? (
						<div className="p-8 text-center">
							<Tag className="w-12 h-12 text-slate-600 mx-auto mb-4" />
							<p className="text-slate-400">
								No tags yet. Create your first tag above.
							</p>
						</div>
					) : (
						<div className="divide-y divide-slate-700">
							{tags.map((tag) => (
								<div
									key={tag.id}
									className="p-4 flex items-center gap-4 hover:bg-slate-700/30 transition-colors"
								>
									{editingId === tag.id ? (
										<>
											<input
												type="color"
												value={editColor}
												onChange={(e) => setEditColor(e.target.value)}
												className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
											/>
											<input
												type="text"
												value={editName}
												onChange={(e) => setEditName(e.target.value)}
												className="flex-1 px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
												autoFocus
												onKeyDown={(e) => {
													if (e.key === "Enter") saveEdit();
													if (e.key === "Escape") cancelEditing();
												}}
											/>
											<button
												onClick={saveEdit}
												className="p-2 hover:bg-slate-600 rounded-lg text-green-400 hover:text-green-300"
											>
												<Check className="w-5 h-5" />
											</button>
											<button
												onClick={cancelEditing}
												className="p-2 hover:bg-slate-600 rounded-lg text-slate-400 hover:text-white"
											>
												<X className="w-5 h-5" />
											</button>
										</>
									) : deleteConfirmId === tag.id ? (
										<>
											<div className="flex-1">
												<p className="text-white">
													Delete "
													<span className="font-medium">{tag.name}</span>"?
												</p>
												<p className="text-sm text-slate-400">
													This will remove the tag from all documents.
												</p>
											</div>
											<button
												onClick={() => deleteTag(tag.id)}
												disabled={isDeleting}
												className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 text-white text-sm font-medium rounded-lg"
											>
												{isDeleting ? (
													<Loader2 className="w-4 h-4 animate-spin" />
												) : (
													"Delete"
												)}
											</button>
											<button
												onClick={() => setDeleteConfirmId(null)}
												disabled={isDeleting}
												className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium rounded-lg"
											>
												Cancel
											</button>
										</>
									) : (
										<>
											<div
												className="w-10 h-10 rounded-lg border-2 flex-shrink-0"
												style={{
													backgroundColor: tag.color
														? `${tag.color}30`
														: "#37415130",
													borderColor: tag.color ?? "#4B5563",
												}}
											/>
											<div className="flex-1 min-w-0">
												<p className="text-white font-medium">{tag.name}</p>
												<p className="text-sm text-slate-400">
													{tag.color ?? "No color"}
												</p>
											</div>
											<span
												className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
												style={{
													backgroundColor: tag.color
														? `${tag.color}20`
														: "#374151",
													color: tag.color ?? "#9CA3AF",
													borderColor: tag.color ?? "#4B5563",
													borderWidth: "1px",
												}}
											>
												{tag.name}
											</span>
											<button
												onClick={() => startEditing(tag)}
												className="p-2 hover:bg-slate-600 rounded-lg text-slate-400 hover:text-white"
											>
												<Edit2 className="w-5 h-5" />
											</button>
											<button
												onClick={() => setDeleteConfirmId(tag.id)}
												className="p-2 hover:bg-slate-600 rounded-lg text-slate-400 hover:text-red-400"
											>
												<Trash2 className="w-5 h-5" />
											</button>
										</>
									)}
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
