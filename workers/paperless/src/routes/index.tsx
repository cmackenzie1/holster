import {
	createFileRoute,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { useState, useCallback, useEffect, useMemo } from "react";
import {
	useReactTable,
	getCoreRowModel,
	flexRender,
	createColumnHelper,
	type RowSelectionState,
} from "@tanstack/react-table";
import {
	FileText,
	Plus,
	Calendar,
	Hash,
	User,
	Tag,
	Upload,
	X,
	Loader2,
	CheckCircle,
	AlertCircle,
	Settings,
	Trash2,
	Edit2,
	Check,
	Filter,
	Users,
	HardDrive,
	Search,
	LayoutGrid,
	List,
	Image,
	FileType,
} from "lucide-react";
import {
	createDbFromHyperdrive,
	listDocuments,
	listTags,
	listCorrespondents,
	getStorageStats,
} from "@/db";
import { formatBytes } from "@/utils/format";
import { generatePdfThumbnail, isPdfFile } from "@/utils/pdf-thumbnail";

interface TagData {
	id: string;
	name: string;
	color: string | null;
}

/**
 * Generate a deterministic color from a string.
 * Uses a simple hash to pick a hue, with fixed saturation and lightness for pleasant colors.
 */
function generateColorFromString(str: string): string {
	if (!str.trim()) return "#3b82f6";

	// Simple hash function
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}

	// Use hash to generate hue (0-360)
	const hue = Math.abs(hash) % 360;
	// Fixed saturation and lightness for nice, readable colors
	const saturation = 65 + (Math.abs(hash >> 8) % 20); // 65-85%
	const lightness = 45 + (Math.abs(hash >> 16) % 15); // 45-60%

	// Convert HSL to hex
	const hslToHex = (h: number, s: number, l: number): string => {
		const sNorm = s / 100;
		const lNorm = l / 100;
		const a = sNorm * Math.min(lNorm, 1 - lNorm);
		const f = (n: number) => {
			const k = (n + h / 30) % 12;
			const color = lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
			return Math.round(255 * color)
				.toString(16)
				.padStart(2, "0");
		};
		return `#${f(0)}${f(8)}${f(4)}`;
	};

	return hslToHex(hue, saturation, lightness);
}

interface DocumentRow {
	id: string;
	title: string;
	archiveSerialNumber: number | null;
	dateCreated: string | null;
	createdAt: string;
	correspondent: string | null;
	tags: Array<{ id: bigint; name: string; color: string | null }>;
}

const columnHelper = createColumnHelper<DocumentRow>();

const filterMiddleware = createMiddleware({ type: "function" })
	.inputValidator(
		(data: { filterTagIds?: string[]; cursor?: string; search?: string }) =>
			data,
	)
	.server(({ next }) => next());

const getDocuments = createServerFn({ method: "GET" })
	.middleware([filterMiddleware])
	.handler(async ({ data }) => {
		const startTime = Date.now();
		const filterTagIds = data?.filterTagIds ?? [];
		const cursor = data?.cursor;
		const search = data?.search;
		const wideEvent: Record<string, unknown> = {
			function: "getDocuments",
			timestamp: new Date().toISOString(),
			filter_tag_ids: filterTagIds,
			cursor,
			search: search ? `"${search}"` : null,
		};

		try {
			const db = createDbFromHyperdrive(env.HYPERDRIVE);

			// Use repository function with cursor-based pagination and search
			const result = await listDocuments(db, { filterTagIds, cursor, search });

			wideEvent.documents = {
				count: result.items.length,
				limit: 50,
				filtered: filterTagIds.length > 0,
				searched: !!search,
				has_more: result.hasMore,
			};
			wideEvent.outcome = "success";

			return result;
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

const getStorageStatsServer = createServerFn({ method: "GET" }).handler(
	async () => {
		const startTime = Date.now();
		const wideEvent: Record<string, unknown> = {
			function: "getStorageStats",
			timestamp: new Date().toISOString(),
		};

		try {
			const db = createDbFromHyperdrive(env.HYPERDRIVE);

			const stats = await getStorageStats(db);

			wideEvent.storage = {
				total_bytes: stats.totalBytes,
				file_count: stats.fileCount,
			};
			wideEvent.outcome = "success";

			return stats;
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

interface UploadResponse {
	success?: boolean;
	documentId?: string;
	title?: string;
	error?: string;
}

async function uploadDocument(file: File): Promise<UploadResponse> {
	const formData = new FormData();
	formData.append("file", file);

	// Generate thumbnail for PDFs
	if (isPdfFile(file)) {
		try {
			const thumbnail = await generatePdfThumbnail(file);
			if (thumbnail) {
				formData.append("thumbnail", thumbnail, `${file.name}.thumb.jpg`);
			}
		} catch (error) {
			console.error("Failed to generate PDF thumbnail:", error);
			// Continue with upload even if thumbnail generation fails
		}
	}

	const response = await fetch("/api/upload", {
		method: "POST",
		body: formData,
	});

	const result: UploadResponse = await response.json();

	if (!response.ok) {
		throw new Error(result.error || "Upload failed");
	}

	return result;
}

export const Route = createFileRoute("/")({
	component: Dashboard,
	validateSearch: (search: Record<string, unknown>) => ({
		upload: search.upload === true || search.upload === "true",
		q: typeof search.q === "string" ? search.q : "",
	}),
	loader: async ({ search }) => {
		const searchQuery = (search as { q?: string })?.q ?? "";
		const [documentsResult, allTags, allCorrespondents, storageStats] =
			await Promise.all([
				getDocuments({ data: { search: searchQuery || undefined } }),
				getAllTags(),
				getAllCorrespondents(),
				getStorageStatsServer(),
			]);
		return {
			documentsResult,
			allTags,
			allCorrespondents,
			storageStats,
			initialSearch: searchQuery,
		};
	},
});

function Dashboard() {
	const {
		documentsResult: initialResult = {
			items: [],
			nextCursor: null,
			hasMore: false,
		},
		allTags = [],
		allCorrespondents = [],
		storageStats = { totalBytes: 0, fileCount: 0 },
		initialSearch = "",
	} = Route.useLoaderData() ?? {};
	const searchParams = Route.useSearch();
	const uploadFromUrl = searchParams.upload;
	const searchFromUrl = searchParams.q ?? "";
	const router = useRouter();
	const navigate = useNavigate();
	const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
	const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
	const [isCorrespondentManagerOpen, setIsCorrespondentManagerOpen] =
		useState(false);
	const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
	const [searchQuery, setSearchQuery] = useState(initialSearch);
	const [documents, setDocuments] = useState(initialResult.items);
	const [nextCursor, setNextCursor] = useState<string | null>(
		initialResult.nextCursor,
	);
	const [hasMore, setHasMore] = useState(initialResult.hasMore);
	const [isFiltering, setIsFiltering] = useState(false);
	const [isLoadingMore, setIsLoadingMore] = useState(false);

	// Open upload modal if URL has ?upload=true
	useEffect(() => {
		if (uploadFromUrl) {
			setIsUploadModalOpen(true);
			// Clear the URL param
			navigate({ to: "/", search: { upload: false }, replace: true });
		}
	}, [uploadFromUrl, navigate]);

	// Quick drop zone state
	const [isDragging, setIsDragging] = useState(false);
	const [quickUploads, setQuickUploads] = useState<FileUploadState[]>([]);

	// Row selection state
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
	const [isDeleting, setIsDeleting] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [showBulkTagModal, setShowBulkTagModal] = useState(false);
	const [showBulkCorrespondentModal, setShowBulkCorrespondentModal] =
		useState(false);

	// View mode state
	const [viewMode, setViewMode] = useState<"table" | "grid">("table");

	// Table columns
	const columns = useMemo(
		() => [
			columnHelper.display({
				id: "select",
				header: ({ table }) => (
					<input
						type="checkbox"
						checked={table.getIsAllRowsSelected()}
						onChange={table.getToggleAllRowsSelectedHandler()}
						className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-800 cursor-pointer"
					/>
				),
				cell: ({ row }) => (
					<input
						type="checkbox"
						checked={row.getIsSelected()}
						onChange={row.getToggleSelectedHandler()}
						onClick={(e) => e.stopPropagation()}
						className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-800 cursor-pointer"
					/>
				),
			}),
			columnHelper.accessor("archiveSerialNumber", {
				header: () => (
					<div className="flex items-center gap-2">
						<Hash className="w-4 h-4" />
						ASN
					</div>
				),
				cell: (info) => (
					<span className="text-slate-300 font-mono text-sm">
						{info.getValue() ?? "-"}
					</span>
				),
			}),
			columnHelper.accessor("title", {
				header: "Title",
				cell: (info) => (
					<div className="flex items-center gap-3">
						<FileText className="w-5 h-5 text-cyan-400 flex-shrink-0" />
						<span className="text-white font-medium">{info.getValue()}</span>
					</div>
				),
			}),
			columnHelper.accessor("correspondent", {
				header: () => (
					<div className="flex items-center gap-2">
						<User className="w-4 h-4" />
						Correspondent
					</div>
				),
				cell: (info) => (
					<span className="text-slate-300">{info.getValue() ?? "-"}</span>
				),
			}),
			columnHelper.accessor("tags", {
				header: () => (
					<div className="flex items-center gap-2">
						<Tag className="w-4 h-4" />
						Tags
					</div>
				),
				cell: (info) => {
					const tags = info.getValue();
					return (
						<div className="flex flex-wrap gap-1">
							{tags.length > 0 ? (
								tags.map((tag) => (
									<span
										key={tag.id.toString()}
										className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
										style={{
											backgroundColor: tag.color ? `${tag.color}20` : "#374151",
											color: tag.color ?? "#9CA3AF",
											borderColor: tag.color ?? "#4B5563",
											borderWidth: "1px",
										}}
									>
										{tag.name}
									</span>
								))
							) : (
								<span className="text-slate-500 text-sm">-</span>
							)}
						</div>
					);
				},
			}),
			columnHelper.accessor("dateCreated", {
				header: () => (
					<div className="flex items-center gap-2">
						<Calendar className="w-4 h-4" />
						Date
					</div>
				),
				cell: (info) => {
					const value = info.getValue();
					return (
						<span className="text-slate-300 text-sm">
							{value ? new Date(value).toLocaleDateString() : "-"}
						</span>
					);
				},
			}),
		],
		[],
	);

	const table = useReactTable({
		data: documents,
		columns,
		state: { rowSelection },
		onRowSelectionChange: setRowSelection,
		getCoreRowModel: getCoreRowModel(),
		getRowId: (row) => row.id,
	});

	const selectedCount = Object.keys(rowSelection).length;
	const selectedIds = Object.keys(rowSelection);

	const handleBulkDelete = async () => {
		setIsDeleting(true);
		try {
			await Promise.all(
				selectedIds.map((id) =>
					fetch(`/api/documents/${id}`, { method: "DELETE" }),
				),
			);
			setRowSelection({});
			setShowDeleteConfirm(false);
			router.invalidate();
		} catch (error) {
			console.error("Failed to delete documents:", error);
		} finally {
			setIsDeleting(false);
		}
	};

	// Sync search query from URL
	useEffect(() => {
		if (searchFromUrl !== searchQuery) {
			setSearchQuery(searchFromUrl);
		}
	}, [searchFromUrl, searchQuery]);

	// Refetch documents when filter or search changes
	useEffect(() => {
		const fetchFiltered = async () => {
			const hasFilters = selectedTagIds.length > 0 || searchQuery;
			if (!hasFilters) {
				setDocuments(initialResult.items);
				setNextCursor(initialResult.nextCursor);
				setHasMore(initialResult.hasMore);
				return;
			}
			setIsFiltering(true);
			try {
				const result = await getDocuments({
					data: {
						filterTagIds: selectedTagIds,
						search: searchQuery || undefined,
					},
				});
				setDocuments(result.items);
				setNextCursor(result.nextCursor);
				setHasMore(result.hasMore);
			} finally {
				setIsFiltering(false);
			}
		};
		fetchFiltered();
	}, [selectedTagIds, searchQuery, initialResult]);

	// Load more documents (cursor-based pagination)
	const loadMore = async () => {
		if (!nextCursor || isLoadingMore) return;
		setIsLoadingMore(true);
		try {
			const result = await getDocuments({
				data: {
					filterTagIds: selectedTagIds,
					search: searchQuery || undefined,
					cursor: nextCursor,
				},
			});
			setDocuments((prev) => [...prev, ...result.items]);
			setNextCursor(result.nextCursor);
			setHasMore(result.hasMore);
		} finally {
			setIsLoadingMore(false);
		}
	};

	const toggleTagFilter = (tagId: string) => {
		setSelectedTagIds((prev) =>
			prev.includes(tagId)
				? prev.filter((id) => id !== tagId)
				: [...prev, tagId],
		);
	};

	const clearFilters = () => {
		setSelectedTagIds([]);
	};

	// Quick drop zone handlers
	const handleQuickDrop = useCallback(
		async (e: React.DragEvent) => {
			e.preventDefault();
			setIsDragging(false);
			if (e.dataTransfer.files.length === 0) return;

			const newFiles = Array.from(e.dataTransfer.files);
			const newUploads: FileUploadState[] = newFiles.map((file) => ({
				file,
				status: "uploading" as const,
			}));

			setQuickUploads((prev) => [...prev, ...newUploads]);

			for (const file of newFiles) {
				try {
					await uploadDocument(file);
					setQuickUploads((prev) =>
						prev.map((u) =>
							u.file === file ? { ...u, status: "success" as const } : u,
						),
					);
				} catch (error) {
					setQuickUploads((prev) =>
						prev.map((u) =>
							u.file === file
								? {
										...u,
										status: "error" as const,
										error:
											error instanceof Error ? error.message : "Upload failed",
									}
								: u,
						),
					);
				}
			}

			// Refresh after all uploads complete
			router.invalidate();
		},
		[router],
	);

	const clearCompletedUploads = () => {
		setQuickUploads((prev) => prev.filter((u) => u.status === "uploading"));
	};

	return (
		<div className="min-h-full">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{/* Dashboard Header */}
				<div className="flex items-center justify-between mb-6">
					<div>
						<h1 className="text-3xl font-bold text-white">Dashboard</h1>
						<p className="text-slate-400 mt-1">Welcome to Paperless</p>
					</div>
				</div>

				{/* Top Section: Statistics + Upload */}
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
					{/* Statistics Card */}
					<div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 p-6">
						<h2 className="text-lg font-semibold text-white mb-4">
							Statistics
						</h2>
						<div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
							<div className="bg-slate-700/50 rounded-lg p-4">
								<div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
									<FileText className="w-4 h-4" />
									Loaded
								</div>
								<p className="text-2xl font-bold text-white">
									{documents.length}
									{hasMore && "+"}
								</p>
							</div>
							<div className="bg-slate-700/50 rounded-lg p-4">
								<div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
									<HardDrive className="w-4 h-4" />
									Storage
								</div>
								<p className="text-2xl font-bold text-white">
									{formatBytes(storageStats.totalBytes)}
								</p>
							</div>
							<div className="bg-slate-700/50 rounded-lg p-4">
								<div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
									<Tag className="w-4 h-4" />
									Tags
								</div>
								<p className="text-2xl font-bold text-white">
									{allTags.length}
								</p>
							</div>
							<div className="bg-slate-700/50 rounded-lg p-4">
								<div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
									<Users className="w-4 h-4" />
									Correspondents
								</div>
								<p className="text-2xl font-bold text-white">
									{allCorrespondents.length}
								</p>
							</div>
							<div className="bg-slate-700/50 rounded-lg p-4">
								<div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
									<Hash className="w-4 h-4" />
									Current ASN
								</div>
								<p className="text-2xl font-bold text-white">
									{documents.length > 0
										? Math.max(
												...documents.map((d) => d.archiveSerialNumber || 0),
											)
										: 0}
								</p>
							</div>
						</div>
					</div>

					{/* Upload Card */}
					<div
						onDragOver={(e) => {
							e.preventDefault();
							setIsDragging(true);
						}}
						onDragLeave={(e) => {
							e.preventDefault();
							setIsDragging(false);
						}}
						onDrop={handleQuickDrop}
						onClick={() => setIsUploadModalOpen(true)}
						className={`bg-slate-800 rounded-xl border-2 border-dashed p-6 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[160px] ${
							isDragging
								? "border-cyan-500 bg-cyan-500/10"
								: "border-slate-600 hover:border-cyan-500/50 hover:bg-slate-700/30"
						}`}
					>
						<Upload
							className={`w-10 h-10 mb-3 ${isDragging ? "text-cyan-400" : "text-slate-400"}`}
						/>
						<p
							className={`font-medium ${isDragging ? "text-cyan-400" : "text-white"}`}
						>
							Upload documents
						</p>
						<p className="text-slate-500 text-sm mt-1">
							or drop files anywhere
						</p>

						{/* Upload Progress */}
						{quickUploads.length > 0 && (
							<div className="mt-4 w-full space-y-2">
								{quickUploads.map((upload, index) => (
									<div
										key={index}
										className="flex items-center gap-2 p-2 bg-slate-700 rounded-lg text-sm"
										title={upload.file.name}
										onClick={(e) => e.stopPropagation()}
									>
										{upload.status === "uploading" && (
											<Loader2 className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />
										)}
										{upload.status === "success" && (
											<CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
										)}
										{upload.status === "error" && (
											<AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
										)}
										<span className="text-white truncate flex-1">
											{upload.file.name}
										</span>
									</div>
								))}
								{quickUploads.every((u) => u.status !== "uploading") && (
									<button
										onClick={(e) => {
											e.stopPropagation();
											clearCompletedUploads();
										}}
										className="text-sm text-slate-400 hover:text-white transition-colors w-full text-center py-1"
									>
										Clear
									</button>
								)}
							</div>
						)}
					</div>
				</div>

				{/* Documents Section Header */}
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-4">
						<div>
							<h2 className="text-xl font-semibold text-white">Documents</h2>
							<p className="text-slate-400 text-sm">
								{selectedCount > 0 ? (
									<span className="text-cyan-400">
										{selectedCount} selected
									</span>
								) : (
									<>
										{documents.length} document
										{documents.length !== 1 ? "s" : ""}
										{(selectedTagIds.length > 0 || searchQuery) && (
											<span className="text-cyan-400">
												{" "}
												(
												{[
													searchQuery && `"${searchQuery}"`,
													selectedTagIds.length > 0 &&
														`${selectedTagIds.length} tag${selectedTagIds.length !== 1 ? "s" : ""}`,
												]
													.filter(Boolean)
													.join(", ")}
												)
											</span>
										)}
									</>
								)}
							</p>
						</div>

						{/* View Toggle */}
						<div className="flex bg-slate-700 rounded-lg p-1">
							<button
								onClick={() => setViewMode("table")}
								className={`p-2 rounded-md transition-colors ${
									viewMode === "table"
										? "bg-slate-600 text-white"
										: "text-slate-400 hover:text-white"
								}`}
								title="Table view"
							>
								<List className="w-4 h-4" />
							</button>
							<button
								onClick={() => setViewMode("grid")}
								className={`p-2 rounded-md transition-colors ${
									viewMode === "grid"
										? "bg-slate-600 text-white"
										: "text-slate-400 hover:text-white"
								}`}
								title="Grid view"
							>
								<LayoutGrid className="w-4 h-4" />
							</button>
						</div>
					</div>
					<div className="flex gap-3">
						{selectedCount > 0 ? (
							<>
								<button
									onClick={() => setShowBulkTagModal(true)}
									className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
								>
									<Tag className="w-4 h-4" />
									Add Tags
								</button>
								<button
									onClick={() => setShowBulkCorrespondentModal(true)}
									className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
								>
									<Users className="w-4 h-4" />
									Set Correspondent
								</button>
								<button
									onClick={() => setShowDeleteConfirm(true)}
									className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
								>
									<Trash2 className="w-4 h-4" />
									Delete
								</button>
								<button
									onClick={() => setRowSelection({})}
									className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white transition-colors"
								>
									<X className="w-4 h-4" />
								</button>
							</>
						) : (
							<>
								<button
									onClick={() => setIsCorrespondentManagerOpen(true)}
									className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
								>
									<Users className="w-4 h-4" />
									Correspondents
								</button>
								<button
									onClick={() => setIsTagManagerOpen(true)}
									className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
								>
									<Settings className="w-4 h-4" />
									Tags
								</button>
							</>
						)}
					</div>
				</div>

				{/* Tag Filter */}
				{allTags.length > 0 && (
					<div className="mb-4">
						<div className="flex items-center gap-3 flex-wrap">
							<div className="flex items-center gap-2 text-slate-400 text-sm">
								<Filter className="w-4 h-4" />
								Filter:
							</div>
							{allTags.map((tag) => (
								<button
									key={tag.id}
									onClick={() => toggleTagFilter(tag.id)}
									className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-all ${
										selectedTagIds.includes(tag.id)
											? "ring-2 ring-white ring-offset-2 ring-offset-slate-900"
											: "opacity-70 hover:opacity-100"
									}`}
									style={{
										backgroundColor: tag.color ? `${tag.color}20` : "#374151",
										color: tag.color ?? "#9CA3AF",
										borderColor: tag.color ?? "#4B5563",
										borderWidth: "1px",
									}}
								>
									{tag.name}
								</button>
							))}
							{selectedTagIds.length > 0 && (
								<button
									onClick={clearFilters}
									className="inline-flex items-center gap-1 px-3 py-1 text-sm text-slate-400 hover:text-white transition-colors"
								>
									<X className="w-3 h-3" />
									Clear
								</button>
							)}
							{isFiltering && (
								<Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
							)}
						</div>
					</div>
				)}

				{/* Documents Table/Grid */}
				{documents.length === 0 ? (
					<div className="text-center py-16 bg-slate-800 rounded-xl border border-slate-700">
						<FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
						<h3 className="text-xl font-semibold text-white mb-2">
							No documents yet
						</h3>
						<p className="text-slate-400 mb-6">
							Upload your first document to get started
						</p>
						<button
							onClick={() => setIsUploadModalOpen(true)}
							className="flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors mx-auto"
						>
							<Plus className="w-5 h-5" />
							Upload Document
						</button>
					</div>
				) : viewMode === "table" ? (
					<div className="rounded-xl border border-slate-700 overflow-clip">
						<table className="w-full border-collapse">
							<thead className="sticky top-0 z-10">
								{table.getHeaderGroups().map((headerGroup) => (
									<tr
										key={headerGroup.id}
										className="bg-slate-800 border-b border-slate-700"
									>
										{headerGroup.headers.map((header) => (
											<th
												key={header.id}
												className="text-left px-6 py-4 text-sm font-medium text-slate-400 bg-slate-800"
											>
												{header.isPlaceholder
													? null
													: flexRender(
															header.column.columnDef.header,
															header.getContext(),
														)}
											</th>
										))}
									</tr>
								))}
							</thead>
							<tbody className="bg-slate-800">
								{table.getRowModel().rows.map((row) => (
									<tr
										key={row.id}
										onClick={() =>
											navigate({
												to: "/documents/$id",
												params: { id: row.original.id },
											})
										}
										className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer ${
											row.getIsSelected() ? "bg-cyan-500/10" : ""
										}`}
									>
										{row.getVisibleCells().map((cell) => (
											<td key={cell.id} className="px-6 py-4">
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext(),
												)}
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>

						{/* Load More Button */}
						{hasMore && (
							<div className="p-4 border-t border-slate-700 flex justify-center bg-slate-800">
								<button
									onClick={loadMore}
									disabled={isLoadingMore}
									className="flex items-center gap-2 px-6 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700/50 text-white font-medium rounded-lg transition-colors"
								>
									{isLoadingMore ? (
										<>
											<Loader2 className="w-4 h-4 animate-spin" />
											Loading...
										</>
									) : (
										"Load More"
									)}
								</button>
							</div>
						)}
					</div>
				) : (
					/* Grid View */
					<div>
						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
							{documents.map((doc) => {
								const isSelected = rowSelection[doc.id] === true;
								const isImage =
									doc.primaryFile?.mimeType?.startsWith("image/") ?? false;
								const isPdf = doc.primaryFile?.mimeType === "application/pdf";

								return (
									<div
										key={doc.id}
										onClick={() =>
											navigate({ to: "/documents/$id", params: { id: doc.id } })
										}
										className={`group bg-slate-800 rounded-xl border overflow-hidden cursor-pointer transition-all hover:border-cyan-500/50 hover:shadow-lg ${
											isSelected
												? "border-cyan-500 ring-2 ring-cyan-500/30"
												: "border-slate-700"
										}`}
									>
										{/* Thumbnail */}
										<div className="aspect-[3/4] bg-slate-900 relative overflow-hidden">
											{doc.primaryFile?.thumbnailKey ? (
												// Use generated thumbnail (for PDFs)
												<img
													src={`/api/files/${encodeURIComponent(doc.primaryFile.thumbnailKey)}`}
													alt={doc.title}
													className="w-full h-full object-cover"
												/>
											) : isImage && doc.primaryFile ? (
												// Use original image as thumbnail
												<img
													src={`/api/files/${encodeURIComponent(doc.primaryFile.objectKey)}`}
													alt={doc.title}
													className="w-full h-full object-cover"
												/>
											) : (
												// Fallback to file type icon
												<div className="w-full h-full flex items-center justify-center">
													{isPdf ? (
														<FileText className="w-16 h-16 text-red-400/50" />
													) : doc.primaryFile ? (
														<FileType className="w-16 h-16 text-slate-500" />
													) : (
														<FileText className="w-16 h-16 text-slate-600" />
													)}
												</div>
											)}

											{/* Selection checkbox overlay */}
											<div
												className={`absolute top-2 left-2 transition-opacity ${
													isSelected
														? "opacity-100"
														: "opacity-0 group-hover:opacity-100"
												}`}
												onClick={(e) => {
													e.stopPropagation();
													setRowSelection((prev) => ({
														...prev,
														[doc.id]: !prev[doc.id],
													}));
												}}
											>
												<div
													className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
														isSelected
															? "bg-cyan-500 border-cyan-500"
															: "bg-slate-800/80 border-slate-400 hover:border-white"
													}`}
												>
													{isSelected && (
														<Check className="w-4 h-4 text-white" />
													)}
												</div>
											</div>

											{/* ASN badge */}
											{doc.archiveSerialNumber && (
												<div className="absolute top-2 right-2 px-2 py-0.5 bg-slate-800/80 rounded text-xs font-mono text-slate-300">
													#{doc.archiveSerialNumber}
												</div>
											)}
										</div>

										{/* Info */}
										<div className="p-3">
											<h3
												className="text-white font-medium text-sm truncate mb-1"
												title={doc.title}
											>
												{doc.title}
											</h3>
											{doc.correspondent && (
												<p className="text-slate-400 text-xs truncate mb-2">
													{doc.correspondent}
												</p>
											)}
											{doc.tags.length > 0 && (
												<div className="flex flex-wrap gap-1">
													{doc.tags.slice(0, 2).map((tag) => (
														<span
															key={String(tag.id)}
															className="px-1.5 py-0.5 rounded text-xs"
															style={{
																backgroundColor: tag.color
																	? `${tag.color}30`
																	: "#374151",
																color: tag.color ?? "#9CA3AF",
															}}
														>
															{tag.name}
														</span>
													))}
													{doc.tags.length > 2 && (
														<span className="px-1.5 py-0.5 text-xs text-slate-500">
															+{doc.tags.length - 2}
														</span>
													)}
												</div>
											)}
										</div>
									</div>
								);
							})}
						</div>

						{/* Load More Button */}
						{hasMore && (
							<div className="mt-6 flex justify-center">
								<button
									onClick={loadMore}
									disabled={isLoadingMore}
									className="flex items-center gap-2 px-6 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700/50 text-white font-medium rounded-lg transition-colors"
								>
									{isLoadingMore ? (
										<>
											<Loader2 className="w-4 h-4 animate-spin" />
											Loading...
										</>
									) : (
										"Load More"
									)}
								</button>
							</div>
						)}
					</div>
				)}
			</div>

			{/* Upload Modal */}
			{isUploadModalOpen && (
				<UploadModal
					onClose={() => setIsUploadModalOpen(false)}
					onSuccess={() => {
						setIsUploadModalOpen(false);
						router.invalidate();
					}}
				/>
			)}

			{/* Tag Manager Modal */}
			{isTagManagerOpen && (
				<TagManagerModal
					onClose={() => setIsTagManagerOpen(false)}
					onUpdate={() => {
						router.invalidate();
					}}
				/>
			)}

			{/* Correspondent Manager Modal */}
			{isCorrespondentManagerOpen && (
				<CorrespondentManagerModal
					onClose={() => setIsCorrespondentManagerOpen(false)}
					onUpdate={() => {
						router.invalidate();
					}}
				/>
			)}

			{/* Delete Confirmation Modal */}
			{showDeleteConfirm && (
				<div className="fixed inset-0 z-50 flex items-center justify-center">
					<div
						className="absolute inset-0 bg-black/60 backdrop-blur-sm"
						onClick={() => !isDeleting && setShowDeleteConfirm(false)}
					/>
					<div className="relative bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-md mx-4 p-6">
						<h3 className="text-lg font-semibold text-white mb-2">
							Delete {selectedCount} Document{selectedCount !== 1 ? "s" : ""}
						</h3>
						<p className="text-slate-400 mb-6">
							Are you sure you want to delete {selectedCount} document
							{selectedCount !== 1 ? "s" : ""}? This action cannot be undone.
						</p>
						<div className="flex justify-end gap-3">
							<button
								onClick={() => setShowDeleteConfirm(false)}
								disabled={isDeleting}
								className="px-4 py-2 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
							>
								Cancel
							</button>
							<button
								onClick={handleBulkDelete}
								disabled={isDeleting}
								className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 text-white font-medium rounded-lg transition-colors"
							>
								{isDeleting ? (
									<Loader2 className="w-4 h-4 animate-spin" />
								) : (
									<Trash2 className="w-4 h-4" />
								)}
								Delete
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Bulk Tag Assignment Modal */}
			{showBulkTagModal && (
				<BulkTagModal
					documentIds={selectedIds}
					allTags={allTags}
					onClose={() => setShowBulkTagModal(false)}
					onSuccess={() => {
						setShowBulkTagModal(false);
						setRowSelection({});
						router.invalidate();
					}}
				/>
			)}

			{/* Bulk Correspondent Assignment Modal */}
			{showBulkCorrespondentModal && (
				<BulkCorrespondentModal
					documentIds={selectedIds}
					allCorrespondents={allCorrespondents}
					onClose={() => setShowBulkCorrespondentModal(false)}
					onSuccess={() => {
						setShowBulkCorrespondentModal(false);
						setRowSelection({});
						router.invalidate();
					}}
				/>
			)}
		</div>
	);
}

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface FileUploadState {
	file: File;
	status: UploadStatus;
	error?: string;
}

function UploadModal({
	onClose,
	onSuccess,
}: {
	onClose: () => void;
	onSuccess: () => void;
}) {
	const [isDragging, setIsDragging] = useState(false);
	const [uploads, setUploads] = useState<FileUploadState[]>([]);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
	}, []);

	const processFiles = useCallback(async (fileList: FileList | File[]) => {
		const newFiles = Array.from(fileList);
		const newUploads: FileUploadState[] = newFiles.map((file) => ({
			file,
			status: "uploading" as const,
		}));

		setUploads((prev) => [...prev, ...newUploads]);

		// Upload each file
		for (let i = 0; i < newFiles.length; i++) {
			const file = newFiles[i];

			try {
				await uploadDocument(file);
				setUploads((prev) =>
					prev.map((u) =>
						u.file === file ? { ...u, status: "success" as const } : u,
					),
				);
			} catch (error) {
				setUploads((prev) =>
					prev.map((u) =>
						u.file === file
							? {
									...u,
									status: "error" as const,
									error:
										error instanceof Error ? error.message : "Upload failed",
								}
							: u,
					),
				);
			}
		}
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragging(false);
			if (e.dataTransfer.files.length > 0) {
				processFiles(e.dataTransfer.files);
			}
		},
		[processFiles],
	);

	const handleFileSelect = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			if (e.target.files && e.target.files.length > 0) {
				processFiles(e.target.files);
			}
		},
		[processFiles],
	);

	const allDone =
		uploads.length > 0 &&
		uploads.every((u) => u.status === "success" || u.status === "error");
	const hasSuccess = uploads.some((u) => u.status === "success");

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-sm"
				onClick={onClose}
			/>

			{/* Modal */}
			<div className="relative bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-lg mx-4">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-slate-700">
					<h2 className="text-lg font-semibold text-white">Upload Documents</h2>
					<button
						onClick={onClose}
						className="p-1 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Content */}
				<div className="p-4">
					{/* Drop Zone */}
					<div
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
						className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
							isDragging
								? "border-cyan-500 bg-cyan-500/10"
								: "border-slate-600 hover:border-slate-500"
						}`}
					>
						<input
							type="file"
							multiple
							onChange={handleFileSelect}
							className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
							accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif"
						/>
						<Upload
							className={`w-12 h-12 mx-auto mb-4 ${
								isDragging ? "text-cyan-400" : "text-slate-500"
							}`}
						/>
						<p className="text-white font-medium mb-1">
							Drop files here or click to browse
						</p>
						<p className="text-slate-400 text-sm">
							PDF, Word, images, and text files supported
						</p>
					</div>

					{/* Upload List */}
					{uploads.length > 0 && (
						<div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
							{uploads.map((upload, index) => (
								<div
									key={index}
									className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg"
								>
									<FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
									<div className="flex-1 min-w-0">
										<p className="text-white text-sm truncate">
											{upload.file.name}
										</p>
										<p className="text-slate-400 text-xs">
											{formatFileSize(upload.file.size)}
										</p>
									</div>
									<div className="flex-shrink-0">
										{upload.status === "uploading" && (
											<Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
										)}
										{upload.status === "success" && (
											<CheckCircle className="w-5 h-5 text-green-400" />
										)}
										{upload.status === "error" && (
											<span title={upload.error}>
												<AlertCircle className="w-5 h-5 text-red-400" />
											</span>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="flex justify-end gap-3 p-4 border-t border-slate-700">
					<button
						onClick={onClose}
						className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
					>
						Cancel
					</button>
					{allDone && hasSuccess && (
						<button
							onClick={onSuccess}
							className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors"
						>
							Done
						</button>
					)}
				</div>
			</div>
		</div>
	);
}

function TagManagerModal({
	onClose,
	onUpdate,
}: {
	onClose: () => void;
	onUpdate: () => void;
}) {
	const [tags, setTags] = useState<TagData[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editName, setEditName] = useState("");
	const [editColor, setEditColor] = useState("");
	const [newName, setNewName] = useState("");
	const [newColor, setNewColor] = useState("#3b82f6");
	const [isCreating, setIsCreating] = useState(false);
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

	const fetchTags = useCallback(async () => {
		setIsLoading(true);
		try {
			const response = await fetch("/api/tags");
			const data = (await response.json()) as { tags?: TagData[] };
			setTags(data.tags || []);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchTags();
	}, [fetchTags]);

	// Auto-generate color when name changes
	useEffect(() => {
		setNewColor(generateColorFromString(newName));
	}, [newName]);

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
				onUpdate();
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
				onUpdate();
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
		try {
			const response = await fetch(`/api/tags/${id}`, {
				method: "DELETE",
			});

			if (response.ok) {
				await fetchTags();
				onUpdate();
				setDeleteConfirmId(null);
			}
		} catch (error) {
			console.error("Failed to delete tag:", error);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-sm"
				onClick={onClose}
			/>

			{/* Modal */}
			<div className="relative bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-slate-700">
					<h2 className="text-lg font-semibold text-white flex items-center gap-2">
						<Tag className="w-5 h-5" />
						Manage Tags
					</h2>
					<button
						onClick={onClose}
						className="p-1 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Content */}
				<div className="p-4 overflow-y-auto flex-1">
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
						</div>
					) : (
						<div className="space-y-2">
							{tags.length === 0 ? (
								<p className="text-slate-400 text-center py-4">
									No tags yet. Create your first tag below.
								</p>
							) : (
								tags.map((tag) => (
									<div
										key={tag.id}
										className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg"
									>
										{editingId === tag.id ? (
											<>
												<input
													type="color"
													value={editColor}
													onChange={(e) => setEditColor(e.target.value)}
													className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
												/>
												<input
													type="text"
													value={editName}
													onChange={(e) => setEditName(e.target.value)}
													className="flex-1 px-3 py-1 bg-slate-600 border border-slate-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
													autoFocus
													onKeyDown={(e) => {
														if (e.key === "Enter") saveEdit();
														if (e.key === "Escape") cancelEditing();
													}}
												/>
												<button
													onClick={saveEdit}
													className="p-1.5 hover:bg-slate-600 rounded text-green-400 hover:text-green-300"
												>
													<Check className="w-4 h-4" />
												</button>
												<button
													onClick={cancelEditing}
													className="p-1.5 hover:bg-slate-600 rounded text-slate-400 hover:text-white"
												>
													<X className="w-4 h-4" />
												</button>
											</>
										) : deleteConfirmId === tag.id ? (
											<>
												<span className="flex-1 text-white text-sm">
													Delete "{tag.name}"?
												</span>
												<button
													onClick={() => deleteTag(tag.id)}
													className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded"
												>
													Delete
												</button>
												<button
													onClick={() => setDeleteConfirmId(null)}
													className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded"
												>
													Cancel
												</button>
											</>
										) : (
											<>
												<div
													className="w-6 h-6 rounded-full border-2"
													style={{
														backgroundColor: tag.color
															? `${tag.color}40`
															: "#374151",
														borderColor: tag.color ?? "#4B5563",
													}}
												/>
												<span className="flex-1 text-white">{tag.name}</span>
												<button
													onClick={() => startEditing(tag)}
													className="p-1.5 hover:bg-slate-600 rounded text-slate-400 hover:text-white"
												>
													<Edit2 className="w-4 h-4" />
												</button>
												<button
													onClick={() => setDeleteConfirmId(tag.id)}
													className="p-1.5 hover:bg-slate-600 rounded text-slate-400 hover:text-red-400"
												>
													<Trash2 className="w-4 h-4" />
												</button>
											</>
										)}
									</div>
								))
							)}
						</div>
					)}
				</div>

				{/* Add Tag Form */}
				<div className="p-4 border-t border-slate-700">
					<div className="flex items-center gap-3">
						<input
							type="color"
							value={newColor}
							onChange={(e) => setNewColor(e.target.value)}
							className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
						/>
						<input
							type="text"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							placeholder="New tag name..."
							className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
							onKeyDown={(e) => {
								if (e.key === "Enter") createTag();
							}}
						/>
						<button
							onClick={createTag}
							disabled={!newName.trim() || isCreating}
							className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
						>
							{isCreating ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								<Plus className="w-4 h-4" />
							)}
							Add
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

interface CorrespondentData {
	id: string;
	name: string;
}

function CorrespondentManagerModal({
	onClose,
	onUpdate,
}: {
	onClose: () => void;
	onUpdate: () => void;
}) {
	const [correspondents, setCorrespondents] = useState<CorrespondentData[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editName, setEditName] = useState("");
	const [newName, setNewName] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

	const fetchCorrespondents = useCallback(async () => {
		setIsLoading(true);
		try {
			const response = await fetch("/api/correspondents");
			const data = (await response.json()) as {
				correspondents?: CorrespondentData[];
			};
			setCorrespondents(data.correspondents || []);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchCorrespondents();
	}, [fetchCorrespondents]);

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
				onUpdate();
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
				onUpdate();
				setNewName("");
			}
		} catch (error) {
			console.error("Failed to create correspondent:", error);
		} finally {
			setIsCreating(false);
		}
	};

	const deleteCorrespondent = async (id: string) => {
		try {
			const response = await fetch(`/api/correspondents/${id}`, {
				method: "DELETE",
			});

			if (response.ok) {
				await fetchCorrespondents();
				onUpdate();
				setDeleteConfirmId(null);
			}
		} catch (error) {
			console.error("Failed to delete correspondent:", error);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-sm"
				onClick={onClose}
			/>

			{/* Modal */}
			<div className="relative bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-slate-700">
					<h2 className="text-lg font-semibold text-white flex items-center gap-2">
						<Users className="w-5 h-5" />
						Manage Correspondents
					</h2>
					<button
						onClick={onClose}
						className="p-1 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Content */}
				<div className="p-4 overflow-y-auto flex-1">
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
						</div>
					) : (
						<div className="space-y-2">
							{correspondents.length === 0 ? (
								<p className="text-slate-400 text-center py-4">
									No correspondents yet. Create your first correspondent below.
								</p>
							) : (
								correspondents.map((correspondent) => (
									<div
										key={correspondent.id}
										className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg"
									>
										{editingId === correspondent.id ? (
											<>
												<User className="w-5 h-5 text-slate-400 flex-shrink-0" />
												<input
													type="text"
													value={editName}
													onChange={(e) => setEditName(e.target.value)}
													className="flex-1 px-3 py-1 bg-slate-600 border border-slate-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
													autoFocus
													onKeyDown={(e) => {
														if (e.key === "Enter") saveEdit();
														if (e.key === "Escape") cancelEditing();
													}}
												/>
												<button
													onClick={saveEdit}
													className="p-1.5 hover:bg-slate-600 rounded text-green-400 hover:text-green-300"
												>
													<Check className="w-4 h-4" />
												</button>
												<button
													onClick={cancelEditing}
													className="p-1.5 hover:bg-slate-600 rounded text-slate-400 hover:text-white"
												>
													<X className="w-4 h-4" />
												</button>
											</>
										) : deleteConfirmId === correspondent.id ? (
											<>
												<span className="flex-1 text-white text-sm">
													Delete "{correspondent.name}"?
												</span>
												<button
													onClick={() => deleteCorrespondent(correspondent.id)}
													className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded"
												>
													Delete
												</button>
												<button
													onClick={() => setDeleteConfirmId(null)}
													className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded"
												>
													Cancel
												</button>
											</>
										) : (
											<>
												<User className="w-5 h-5 text-slate-400 flex-shrink-0" />
												<span className="flex-1 text-white">
													{correspondent.name}
												</span>
												<button
													onClick={() => startEditing(correspondent)}
													className="p-1.5 hover:bg-slate-600 rounded text-slate-400 hover:text-white"
												>
													<Edit2 className="w-4 h-4" />
												</button>
												<button
													onClick={() => setDeleteConfirmId(correspondent.id)}
													className="p-1.5 hover:bg-slate-600 rounded text-slate-400 hover:text-red-400"
												>
													<Trash2 className="w-4 h-4" />
												</button>
											</>
										)}
									</div>
								))
							)}
						</div>
					)}
				</div>

				{/* Add Correspondent Form */}
				<div className="p-4 border-t border-slate-700">
					<div className="flex items-center gap-3">
						<User className="w-5 h-5 text-slate-400 flex-shrink-0" />
						<input
							type="text"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							placeholder="New correspondent name..."
							className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
							onKeyDown={(e) => {
								if (e.key === "Enter") createCorrespondent();
							}}
						/>
						<button
							onClick={createCorrespondent}
							disabled={!newName.trim() || isCreating}
							className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
						>
							{isCreating ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								<Plus className="w-4 h-4" />
							)}
							Add
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

function formatFileSize(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function BulkTagModal({
	documentIds,
	allTags,
	onClose,
	onSuccess,
}: {
	documentIds: string[];
	allTags: TagData[];
	onClose: () => void;
	onSuccess: () => void;
}) {
	const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
	const [isSaving, setIsSaving] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [localTags, setLocalTags] = useState<TagData[]>(allTags);
	const [isCreating, setIsCreating] = useState(false);

	const normalizedSearch = searchQuery.trim().toLowerCase();

	const filteredTags = localTags.filter((tag) =>
		tag.name.toLowerCase().includes(normalizedSearch),
	);

	const exactMatch = localTags.some(
		(tag) => tag.name.toLowerCase() === normalizedSearch,
	);

	const showCreateOption = normalizedSearch.length > 0 && !exactMatch;

	const toggleTag = (tagId: string) => {
		setSelectedTagIds((prev) => {
			const next = new Set(prev);
			if (next.has(tagId)) {
				next.delete(tagId);
			} else {
				next.add(tagId);
			}
			return next;
		});
	};

	const handleCreateTag = async () => {
		if (!normalizedSearch || isCreating) return;

		setIsCreating(true);
		try {
			const color = generateColorFromString(normalizedSearch);
			const response = await fetch("/api/tags", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: normalizedSearch, color }),
			});

			if (response.ok) {
				const newTag = await response.json();
				setLocalTags((prev) => [...prev, newTag]);
				setSelectedTagIds((prev) => new Set([...prev, newTag.id]));
				setSearchQuery("");
			}
		} catch (error) {
			console.error("Failed to create tag:", error);
		} finally {
			setIsCreating(false);
		}
	};

	const handleSave = async () => {
		if (selectedTagIds.size === 0) return;

		setIsSaving(true);
		try {
			// Add selected tags to each document
			for (const docId of documentIds) {
				// Get current tags for this document
				const docResponse = await fetch(`/api/documents/${docId}`);
				if (!docResponse.ok) continue;

				const doc = await docResponse.json();
				const currentTagIds = new Set(
					(doc.tags || []).map((t: { id: string }) => t.id),
				);

				// Merge with selected tags
				const mergedTagIds = Array.from(
					new Set([...currentTagIds, ...selectedTagIds]),
				);

				await fetch(`/api/documents/${docId}/tags`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ tagIds: mergedTagIds }),
				});
			}

			onSuccess();
		} catch (error) {
			console.error("Failed to update tags:", error);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-sm"
				onClick={onClose}
			/>
			<div className="relative bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-md mx-4">
				<div className="flex items-center justify-between p-4 border-b border-slate-700">
					<h2 className="text-lg font-semibold text-white flex items-center gap-2">
						<Tag className="w-5 h-5" />
						Add Tags to {documentIds.length} Document
						{documentIds.length !== 1 ? "s" : ""}
					</h2>
					<button
						onClick={onClose}
						className="p-1 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				<div className="p-4 border-b border-slate-700">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search or create tags..."
							className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
							autoFocus
							onKeyDown={(e) => {
								if (e.key === "Enter" && showCreateOption) {
									e.preventDefault();
									handleCreateTag();
								}
							}}
						/>
					</div>
				</div>

				<div className="p-4 max-h-[50vh] overflow-y-auto">
					<div className="space-y-2">
						{showCreateOption && (
							<button
								onClick={handleCreateTag}
								disabled={isCreating}
								className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 border-dashed"
							>
								{isCreating ? (
									<Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
								) : (
									<Plus className="w-5 h-5 text-cyan-400" />
								)}
								<span className="text-cyan-400 flex-1 text-left">
									Create "
									<span className="font-medium">{normalizedSearch}</span>"
								</span>
							</button>
						)}

						{filteredTags.length === 0 && !showCreateOption ? (
							<p className="text-slate-400 text-center py-4">
								{localTags.length === 0
									? "No tags yet. Type to create one!"
									: "No matching tags found."}
							</p>
						) : (
							filteredTags.map((tag) => (
								<button
									key={tag.id}
									onClick={() => toggleTag(tag.id)}
									className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
										selectedTagIds.has(tag.id)
											? "bg-slate-600"
											: "bg-slate-700/50 hover:bg-slate-700"
									}`}
								>
									<div
										className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
											selectedTagIds.has(tag.id)
												? "bg-cyan-500 border-cyan-500"
												: "border-slate-500"
										}`}
									>
										{selectedTagIds.has(tag.id) && (
											<Check className="w-3 h-3 text-white" />
										)}
									</div>
									<div
										className="w-4 h-4 rounded-full"
										style={{ backgroundColor: tag.color ?? "#4B5563" }}
									/>
									<span className="text-white flex-1 text-left">
										{tag.name}
									</span>
								</button>
							))
						)}
					</div>
				</div>

				<div className="flex justify-end gap-3 p-4 border-t border-slate-700">
					<button
						onClick={onClose}
						className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
					>
						Cancel
					</button>
					<button
						onClick={handleSave}
						disabled={selectedTagIds.size === 0 || isSaving}
						className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
					>
						{isSaving ? (
							<Loader2 className="w-4 h-4 animate-spin" />
						) : (
							<Check className="w-4 h-4" />
						)}
						Add Tags
					</button>
				</div>
			</div>
		</div>
	);
}

function BulkCorrespondentModal({
	documentIds,
	allCorrespondents,
	onClose,
	onSuccess,
}: {
	documentIds: string[];
	allCorrespondents: CorrespondentData[];
	onClose: () => void;
	onSuccess: () => void;
}) {
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [localCorrespondents, setLocalCorrespondents] =
		useState<CorrespondentData[]>(allCorrespondents);
	const [isCreating, setIsCreating] = useState(false);

	const normalizedSearch = searchQuery.trim().toLowerCase();

	const filteredCorrespondents = localCorrespondents.filter((c) =>
		c.name.toLowerCase().includes(normalizedSearch),
	);

	const exactMatch = localCorrespondents.some(
		(c) => c.name.toLowerCase() === normalizedSearch,
	);

	const showCreateOption = normalizedSearch.length > 0 && !exactMatch;

	const handleCreateCorrespondent = async () => {
		if (!normalizedSearch || isCreating) return;

		setIsCreating(true);
		try {
			const response = await fetch("/api/correspondents", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: searchQuery.trim() }),
			});

			if (response.ok) {
				const newCorrespondent = await response.json();
				setLocalCorrespondents((prev) => [...prev, newCorrespondent]);
				setSelectedId(newCorrespondent.id);
				setSearchQuery("");
			}
		} catch (error) {
			console.error("Failed to create correspondent:", error);
		} finally {
			setIsCreating(false);
		}
	};

	const handleSave = async () => {
		setIsSaving(true);
		try {
			for (const docId of documentIds) {
				await fetch(`/api/documents/${docId}/correspondent`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ correspondentId: selectedId }),
				});
			}

			onSuccess();
		} catch (error) {
			console.error("Failed to update correspondent:", error);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-sm"
				onClick={onClose}
			/>
			<div className="relative bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-md mx-4">
				<div className="flex items-center justify-between p-4 border-b border-slate-700">
					<h2 className="text-lg font-semibold text-white flex items-center gap-2">
						<Users className="w-5 h-5" />
						Set Correspondent for {documentIds.length} Document
						{documentIds.length !== 1 ? "s" : ""}
					</h2>
					<button
						onClick={onClose}
						className="p-1 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				<div className="p-4 border-b border-slate-700">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search or create correspondent..."
							className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
							autoFocus
							onKeyDown={(e) => {
								if (e.key === "Enter" && showCreateOption) {
									e.preventDefault();
									handleCreateCorrespondent();
								}
							}}
						/>
					</div>
				</div>

				<div className="p-4 max-h-[50vh] overflow-y-auto">
					<div className="space-y-2">
						{showCreateOption && (
							<button
								onClick={handleCreateCorrespondent}
								disabled={isCreating}
								className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 border-dashed"
							>
								{isCreating ? (
									<Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
								) : (
									<Plus className="w-5 h-5 text-cyan-400" />
								)}
								<span className="text-cyan-400 flex-1 text-left">
									Create "
									<span className="font-medium">{searchQuery.trim()}</span>"
								</span>
							</button>
						)}

						{/* None option */}
						<button
							onClick={() => setSelectedId(null)}
							className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
								selectedId === null
									? "bg-slate-600"
									: "bg-slate-700/50 hover:bg-slate-700"
							}`}
						>
							<div
								className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
									selectedId === null
										? "bg-cyan-500 border-cyan-500"
										: "border-slate-500"
								}`}
							>
								{selectedId === null && (
									<div className="w-2 h-2 bg-white rounded-full" />
								)}
							</div>
							<span className="text-slate-400 italic">
								None (clear correspondent)
							</span>
						</button>

						{filteredCorrespondents.length === 0 && !showCreateOption ? (
							<p className="text-slate-400 text-center py-4">
								{localCorrespondents.length === 0
									? "No correspondents yet. Type to create one!"
									: "No matching correspondents found."}
							</p>
						) : (
							filteredCorrespondents.map((correspondent) => (
								<button
									key={correspondent.id}
									onClick={() => setSelectedId(correspondent.id)}
									className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
										selectedId === correspondent.id
											? "bg-slate-600"
											: "bg-slate-700/50 hover:bg-slate-700"
									}`}
								>
									<div
										className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
											selectedId === correspondent.id
												? "bg-cyan-500 border-cyan-500"
												: "border-slate-500"
										}`}
									>
										{selectedId === correspondent.id && (
											<div className="w-2 h-2 bg-white rounded-full" />
										)}
									</div>
									<span className="text-white flex-1 text-left">
										{correspondent.name}
									</span>
								</button>
							))
						)}
					</div>
				</div>

				<div className="flex justify-end gap-3 p-4 border-t border-slate-700">
					<button
						onClick={onClose}
						className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
					>
						Cancel
					</button>
					<button
						onClick={handleSave}
						disabled={isSaving}
						className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
					>
						{isSaving ? (
							<Loader2 className="w-4 h-4 animate-spin" />
						) : (
							<Check className="w-4 h-4" />
						)}
						Set Correspondent
					</button>
				</div>
			</div>
		</div>
	);
}
