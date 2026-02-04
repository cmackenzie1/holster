import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { useState, useEffect } from "react";
import {
	Users,
	User,
	Plus,
	Edit2,
	Trash2,
	Check,
	X,
	Loader2,
	ArrowLeft,
	FileText,
} from "lucide-react";
import { createDbFromHyperdrive, listCorrespondents } from "@/db";

interface CorrespondentData {
	id: string;
	name: string;
}

const getAllCorrespondents = createServerFn({ method: "GET" }).handler(
	async () => {
		const startTime = Date.now();
		const wideEvent: Record<string, unknown> = {
			function: "getAllCorrespondents",
			timestamp: new Date().toISOString(),
		};

		try {
			const db = createDbFromHyperdrive(env.HYPERDRIVE);
			const results = await listCorrespondents(db);

			wideEvent.correspondents_count = results.length;
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
	},
);

export const Route = createFileRoute("/correspondents")({
	component: CorrespondentsPage,
	loader: async () => {
		const correspondents = await getAllCorrespondents();
		return { correspondents };
	},
});

function CorrespondentsPage() {
	const { correspondents: initialCorrespondents = [] } =
		Route.useLoaderData() ?? {};
	const [correspondents, setCorrespondents] = useState<CorrespondentData[]>(
		initialCorrespondents,
	);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editName, setEditName] = useState("");
	const [newName, setNewName] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	// Sync correspondents when loader data changes
	useEffect(() => {
		setCorrespondents(initialCorrespondents ?? []);
	}, [initialCorrespondents]);

	const fetchCorrespondents = async () => {
		try {
			const response = await fetch("/api/correspondents");
			const data = (await response.json()) as {
				correspondents?: CorrespondentData[];
			};
			setCorrespondents(data.correspondents || []);
		} catch (error) {
			console.error("Failed to fetch correspondents:", error);
		}
	};

	const startEditing = (correspondent: CorrespondentData) => {
		setEditingId(correspondent.id);
		setEditName(correspondent.name);
	};

	const cancelEditing = () => {
		setEditingId(null);
		setEditName("");
	};

	const saveEdit = async () => {
		if (!editingId || !editName.trim()) return;

		try {
			const response = await fetch(`/api/correspondents/${editingId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: editName.trim() }),
			});

			if (response.ok) {
				await fetchCorrespondents();
				cancelEditing();
			}
		} catch (error) {
			console.error("Failed to update correspondent:", error);
		}
	};

	const createCorrespondent = async () => {
		if (!newName.trim()) return;

		setIsCreating(true);
		try {
			const response = await fetch("/api/correspondents", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: newName.trim() }),
			});

			if (response.ok) {
				await fetchCorrespondents();
				setNewName("");
			}
		} catch (error) {
			console.error("Failed to create correspondent:", error);
		} finally {
			setIsCreating(false);
		}
	};

	const deleteCorrespondent = async (id: string) => {
		setIsDeleting(true);
		try {
			const response = await fetch(`/api/correspondents/${id}`, {
				method: "DELETE",
			});

			if (response.ok) {
				await fetchCorrespondents();
				setDeleteConfirmId(null);
			}
		} catch (error) {
			console.error("Failed to delete correspondent:", error);
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
							<Users className="w-8 h-8 text-cyan-400" />
							<div>
								<h1 className="text-2xl font-bold text-white">
									Correspondents
								</h1>
								<p className="text-slate-400">
									{correspondents.length} correspondent
									{correspondents.length !== 1 ? "s" : ""}
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* Create New Correspondent */}
				<div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-6">
					<h2 className="text-lg font-semibold text-white mb-4">
						Add New Correspondent
					</h2>
					<div className="flex items-center gap-3">
						<User className="w-6 h-6 text-slate-400 flex-shrink-0" />
						<input
							type="text"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							placeholder="Correspondent name..."
							className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
							onKeyDown={(e) => {
								if (e.key === "Enter") createCorrespondent();
							}}
						/>
						<button
							onClick={createCorrespondent}
							disabled={!newName.trim() || isCreating}
							className="flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
						>
							{isCreating ? (
								<Loader2 className="w-5 h-5 animate-spin" />
							) : (
								<Plus className="w-5 h-5" />
							)}
							Add
						</button>
					</div>
				</div>

				{/* Correspondents List */}
				<div className="bg-slate-800 rounded-xl border border-slate-700">
					<div className="p-4 border-b border-slate-700">
						<h2 className="text-lg font-semibold text-white">
							All Correspondents
						</h2>
					</div>

					{correspondents.length === 0 ? (
						<div className="p-8 text-center">
							<Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
							<p className="text-slate-400">
								No correspondents yet. Add your first correspondent above.
							</p>
						</div>
					) : (
						<div className="divide-y divide-slate-700">
							{correspondents.map((correspondent) => (
								<div
									key={correspondent.id}
									className="p-4 flex items-center gap-4 hover:bg-slate-700/30 transition-colors"
								>
									{editingId === correspondent.id ? (
										<>
											<User className="w-10 h-10 p-2 bg-slate-700 rounded-lg text-slate-400 flex-shrink-0" />
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
									) : deleteConfirmId === correspondent.id ? (
										<>
											<div className="flex-1">
												<p className="text-white">
													Delete "
													<span className="font-medium">
														{correspondent.name}
													</span>
													"?
												</p>
												<p className="text-sm text-slate-400">
													This will remove the correspondent from all documents.
												</p>
											</div>
											<button
												onClick={() => deleteCorrespondent(correspondent.id)}
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
											<div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
												<User className="w-5 h-5 text-slate-400" />
											</div>
											<div className="flex-1 min-w-0">
												<p className="text-white font-medium">
													{correspondent.name}
												</p>
											</div>
											<button
												onClick={() => startEditing(correspondent)}
												className="p-2 hover:bg-slate-600 rounded-lg text-slate-400 hover:text-white"
											>
												<Edit2 className="w-5 h-5" />
											</button>
											<button
												onClick={() => setDeleteConfirmId(correspondent.id)}
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
