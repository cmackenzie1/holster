import { env } from "cloudflare:workers";
import {
	createFileRoute,
	type ErrorComponentProps,
	Link,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { createMiddleware, createServerFn } from "@tanstack/react-start";
import {
	AlertTriangle,
	ArrowLeft,
	Calendar,
	Check,
	ChevronDown,
	ChevronUp,
	Download,
	Edit2,
	File,
	FileText,
	FileType,
	FileX,
	FolderOpen,
	Hash,
	Home,
	Image,
	Loader2,
	MessageSquare,
	Plus,
	RefreshCw,
	Search,
	Send,
	Sparkles,
	Tag,
	Trash2,
	User,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
	createDbFromHyperdrive,
	getDocumentById,
	getNextASN,
	listActedSuggestionsByDocument,
	listCategories,
	listCommentsByDocument,
	listCorrespondents,
	listSuggestionsByDocument,
	listTags,
} from "@/db";
import { generateColorFromString } from "@/utils/format";

interface DocumentFile {
	id: string;
	objectKey: string;
	mimeType: string;
	sizeBytes: string;
	md5Hash: string | null;
	createdAt: string;
}

interface DocumentTag {
	id: string;
	name: string;
	color: string | null;
}

interface DocumentData {
	id: string;
	title: string;
	content: string | null;
	archiveSerialNumber: number | null;
	documentDate: string | null;
	dateCreated: string | null;
	createdAt: string;
	updatedAt: string;
	correspondent: { id: string; name: string } | null;
	category: { id: string; name: string; color: string | null } | null;
	tags: DocumentTag[];
	files: DocumentFile[];
}

interface SuggestionItem {
	id: string;
	type: "tag" | "correspondent" | "title" | "date" | "category";
	name: string;
	confidence: string;
	tagId: string | null;
	correspondentId: string | null;
	categoryId: string | null;
	accepted: boolean | null;
}

// Middleware to validate and pass the document ID
const documentIdMiddleware = createMiddleware({ type: "function" })
	.inputValidator((data: { id: string }) => data)
	.server(({ next }) => next());

const getDocument = createServerFn({ method: "GET" })
	.middleware([documentIdMiddleware])
	.handler(async ({ data }): Promise<DocumentData> => {
		const id = data.id;
		const startTime = Date.now();
		const wideEvent: Record<string, unknown> = {
			function: "getDocument",
			document_id: id,
			timestamp: new Date().toISOString(),
		};

		try {
			if (!id) {
				wideEvent.outcome = "error";
				wideEvent.error = {
					message: "Document ID not set",
					type: "ValidationError",
				};
				throw new Error("Document ID not set");
			}

			const db = createDbFromHyperdrive(env.HYPERDRIVE);

			// Use repository function which handles soft-delete filtering
			const doc = await getDocumentById(db, BigInt(id));

			if (!doc) {
				wideEvent.document = { found: false };
				wideEvent.outcome = "not_found";
				throw new Error("Document not found");
			}

			// Add business context to wide event
			wideEvent.document = {
				found: true,
				files_count: doc.files.length,
				tags_count: doc.tags.length,
				has_correspondent: !!doc.correspondent,
				has_content: !!doc.content,
			};
			wideEvent.outcome = "success";

			return doc;
		} catch (error) {
			if (wideEvent.outcome !== "not_found") {
				wideEvent.outcome = "error";
				wideEvent.error = {
					message: error instanceof Error ? error.message : String(error),
					type: error instanceof Error ? error.name : "UnknownError",
				};
			}
			throw error;
		} finally {
			wideEvent.duration_ms = Date.now() - startTime;
			console.log(JSON.stringify(wideEvent));
		}
	});

const getAllTags = createServerFn({ method: "GET" }).handler(async () => {
	const db = createDbFromHyperdrive(env.HYPERDRIVE);
	return listTags(db);
});

const getAllCorrespondents = createServerFn({ method: "GET" }).handler(
	async () => {
		const db = createDbFromHyperdrive(env.HYPERDRIVE);
		return listCorrespondents(db);
	},
);

const getAllCategories = createServerFn({ method: "GET" }).handler(async () => {
	const db = createDbFromHyperdrive(env.HYPERDRIVE);
	return listCategories(db);
});

const fetchNextASN = createServerFn({ method: "GET" }).handler(async () => {
	const db = createDbFromHyperdrive(env.HYPERDRIVE);
	return getNextASN(db);
});

const getDocumentSuggestions = createServerFn({ method: "GET" })
	.middleware([documentIdMiddleware])
	.handler(async ({ data }): Promise<SuggestionItem[]> => {
		const db = createDbFromHyperdrive(env.HYPERDRIVE);
		return listSuggestionsByDocument(db, BigInt(data.id));
	});

type TimelineEvent =
	| { type: "document_created"; timestamp: string }
	| {
			type: "comment_added";
			timestamp: string;
			commentId: string;
			content: string;
	  }
	| {
			type: "suggestion_accepted";
			timestamp: string;
			suggestionType: string;
			suggestionName: string;
	  }
	| {
			type: "suggestion_dismissed";
			timestamp: string;
			suggestionType: string;
			suggestionName: string;
	  };

const getDocumentTimeline = createServerFn({ method: "GET" })
	.middleware([documentIdMiddleware])
	.handler(async ({ data }): Promise<TimelineEvent[]> => {
		const db = createDbFromHyperdrive(env.HYPERDRIVE);
		const docId = BigInt(data.id);

		const [comments, actedSuggestions, doc] = await Promise.all([
			listCommentsByDocument(db, docId),
			listActedSuggestionsByDocument(db, docId),
			getDocumentById(db, docId),
		]);

		const events: TimelineEvent[] = [];

		if (doc) {
			events.push({
				type: "document_created",
				timestamp: doc.createdAt,
			});
		}

		for (const comment of comments) {
			events.push({
				type: "comment_added",
				timestamp: comment.createdAt,
				commentId: comment.id,
				content: comment.content,
			});
		}

		for (const suggestion of actedSuggestions) {
			events.push({
				type: suggestion.accepted
					? "suggestion_accepted"
					: "suggestion_dismissed",
				timestamp: suggestion.actedAt,
				suggestionType: suggestion.type,
				suggestionName: suggestion.name,
			});
		}

		events.sort(
			(a, b) =>
				new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
		);

		return events;
	});

export const Route = createFileRoute("/documents/$id")({
	component: DocumentView,
	errorComponent: DocumentErrorPage,
	loader: async ({ params }) => {
		const [
			document,
			allTags,
			allCorrespondents,
			allCategories,
			nextASN,
			suggestions,
			timeline,
		] = await Promise.all([
			getDocument({ data: { id: params.id } }),
			getAllTags(),
			getAllCorrespondents(),
			getAllCategories(),
			fetchNextASN(),
			getDocumentSuggestions({ data: { id: params.id } }),
			getDocumentTimeline({ data: { id: params.id } }),
		]);
		return {
			document,
			allTags,
			allCorrespondents,
			allCategories,
			nextASN,
			suggestions,
			timeline,
		};
	},
});

function DocumentErrorPage({ error, reset }: ErrorComponentProps) {
	const router = useRouter();
	const isNotFound = error?.message?.includes("not found");

	const handleRetry = () => {
		reset();
		router.invalidate();
	};

	return (
		<div className="min-h-full flex items-center justify-center px-4">
			<div className="text-center max-w-md">
				<div className="mb-8">
					<div
						className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-6 ${
							isNotFound
								? "bg-slate-800 border border-slate-700"
								: "bg-red-500/10 border border-red-500/30"
						}`}
					>
						{isNotFound ? (
							<FileX className="w-12 h-12 text-slate-400" />
						) : (
							<AlertTriangle className="w-12 h-12 text-red-400" />
						)}
					</div>
					<h1 className="text-4xl font-bold text-white mb-2">
						{isNotFound ? "Document Not Found" : "Error Loading Document"}
					</h1>
					<p className="text-slate-400 mb-6">
						{isNotFound
							? "This document doesn't exist or may have been deleted."
							: "There was a problem loading this document. Please try again."}
					</p>
					{!isNotFound && error?.message && (
						<div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-left mb-6">
							<p className="text-sm text-slate-400 mb-1">Error details:</p>
							<code className="text-sm text-red-400 break-all">
								{error.message}
							</code>
						</div>
					)}
				</div>
				<div className="flex flex-col sm:flex-row items-center justify-center gap-4">
					{!isNotFound && (
						<button
							onClick={handleRetry}
							className="inline-flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
						>
							<RefreshCw className="w-5 h-5" />
							Try Again
						</button>
					)}
					<Link
						to="/"
						onClick={() => reset()}
						className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors"
					>
						<Home className="w-5 h-5" />
						Back to Dashboard
					</Link>
				</div>
			</div>
		</div>
	);
}

function DocumentView() {
	const {
		document: doc,
		allTags = [],
		allCorrespondents = [],
		allCategories = [],
		nextASN = 1,
		suggestions: initialSuggestions = [],
		timeline: initialTimeline = [],
	} = Route.useLoaderData() ?? {};
	const router = useRouter();
	const navigate = useNavigate();
	const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
	const [isCorrespondentSelectorOpen, setIsCorrespondentSelectorOpen] =
		useState(false);
	const [isCategorySelectorOpen, setIsCategorySelectorOpen] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [editTitle, setEditTitle] = useState(doc.title);
	const [isSavingTitle, setIsSavingTitle] = useState(false);
	const [isEditingASN, setIsEditingASN] = useState(false);
	const [editASN, setEditASN] = useState<string>(
		doc.archiveSerialNumber?.toString() ?? "",
	);
	const [isSavingASN, setIsSavingASN] = useState(false);
	const [isEditingDate, setIsEditingDate] = useState(false);
	const [editDate, setEditDate] = useState(doc.documentDate ?? "");
	const [isSavingDate, setIsSavingDate] = useState(false);
	const [tagsExpanded, setTagsExpanded] = useState(false);
	const [contentExpanded, setContentExpanded] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);
	const [processQueued, setProcessQueued] = useState(false);
	const [processError, setProcessError] = useState<string | null>(null);
	const [suggestions, setSuggestions] =
		useState<SuggestionItem[]>(initialSuggestions);
	const [actioningSuggestion, setActioningSuggestion] = useState<string | null>(
		null,
	);
	const [timeline, setTimeline] = useState<TimelineEvent[]>(initialTimeline);
	const [newComment, setNewComment] = useState("");
	const [isSubmittingComment, setIsSubmittingComment] = useState(false);
	const [deletingCommentId, setDeletingCommentId] = useState<string | null>(
		null,
	);
	const primaryFile = doc.files[0];

	const MAX_VISIBLE_TAGS = 5;

	// Sync editTitle when doc.title changes (e.g., after router.invalidate())
	useEffect(() => {
		setEditTitle(doc.title);
	}, [doc.title]);

	// Sync editASN when doc.archiveSerialNumber changes
	useEffect(() => {
		setEditASN(doc.archiveSerialNumber?.toString() ?? "");
	}, [doc.archiveSerialNumber]);

	// Sync editDate when doc.documentDate changes
	useEffect(() => {
		setEditDate(doc.documentDate ?? "");
	}, [doc.documentDate]);

	// Sync suggestions when loader data changes
	useEffect(() => {
		setSuggestions(initialSuggestions);
	}, [initialSuggestions]);

	// Sync timeline when loader data changes
	useEffect(() => {
		setTimeline(initialTimeline);
	}, [initialTimeline]);

	const handleAddComment = async () => {
		const content = newComment.trim();
		if (!content) return;

		setIsSubmittingComment(true);
		try {
			const response = await fetch(`/api/documents/${doc.id}/comments`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content }),
			});

			if (response.ok) {
				setNewComment("");
				router.invalidate();
			}
		} catch (error) {
			console.error("Failed to add comment:", error);
		} finally {
			setIsSubmittingComment(false);
		}
	};

	const handleDeleteComment = async (commentId: string) => {
		setDeletingCommentId(commentId);
		// Optimistic remove
		setTimeline((prev) =>
			prev.filter(
				(e) => !(e.type === "comment_added" && e.commentId === commentId),
			),
		);
		try {
			await fetch(`/api/documents/${doc.id}/comments/${commentId}`, {
				method: "DELETE",
			});
			router.invalidate();
		} catch (error) {
			console.error("Failed to delete comment:", error);
			// Revert on error
			setTimeline(initialTimeline);
		} finally {
			setDeletingCommentId(null);
		}
	};

	const handleSaveTitle = async () => {
		if (!editTitle.trim() || editTitle.trim() === doc.title) {
			setIsEditingTitle(false);
			setEditTitle(doc.title);
			return;
		}

		setIsSavingTitle(true);
		try {
			const response = await fetch(`/api/documents/${doc.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: editTitle.trim() }),
			});

			if (response.ok) {
				setIsEditingTitle(false);
				router.invalidate();
			}
		} catch (error) {
			console.error("Failed to update title:", error);
		} finally {
			setIsSavingTitle(false);
		}
	};

	const handleCancelEditTitle = () => {
		setIsEditingTitle(false);
		setEditTitle(doc.title);
	};

	const handleSaveASN = async () => {
		const trimmed = editASN.trim();
		const newASN = trimmed === "" ? null : Number.parseInt(trimmed, 10);
		const currentASN = doc.archiveSerialNumber;

		// No change
		if (newASN === currentASN) {
			setIsEditingASN(false);
			return;
		}

		// Validate if we have a value
		if (trimmed !== "" && (isNaN(newASN!) || newASN! < 1)) {
			return;
		}

		setIsSavingASN(true);
		try {
			const response = await fetch(`/api/documents/${doc.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ archiveSerialNumber: newASN }),
			});

			if (response.ok) {
				setIsEditingASN(false);
				router.invalidate();
			}
		} catch (error) {
			console.error("Failed to update ASN:", error);
		} finally {
			setIsSavingASN(false);
		}
	};

	const handleCancelEditASN = () => {
		setIsEditingASN(false);
		setEditASN(doc.archiveSerialNumber?.toString() ?? "");
	};

	const handleSaveDate = async () => {
		const newDate = editDate.trim() || null;

		if (newDate === (doc.documentDate ?? null)) {
			setIsEditingDate(false);
			return;
		}

		setIsSavingDate(true);
		try {
			const response = await fetch(`/api/documents/${doc.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ documentDate: newDate }),
			});

			if (response.ok) {
				setIsEditingDate(false);
				router.invalidate();
			}
		} catch (error) {
			console.error("Failed to update document date:", error);
		} finally {
			setIsSavingDate(false);
		}
	};

	const handleCancelEditDate = () => {
		setIsEditingDate(false);
		setEditDate(doc.documentDate ?? "");
	};

	const handleAssignNextASN = async () => {
		setIsSavingASN(true);
		try {
			const response = await fetch(`/api/documents/${doc.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ archiveSerialNumber: nextASN }),
			});

			if (response.ok) {
				setIsEditingASN(false);
				router.invalidate();
			}
		} catch (error) {
			console.error("Failed to assign ASN:", error);
		} finally {
			setIsSavingASN(false);
		}
	};

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			const response = await fetch(`/api/documents/${doc.id}`, {
				method: "DELETE",
			});
			if (response.ok) {
				navigate({ to: "/" });
			}
		} catch (error) {
			console.error("Failed to delete document:", error);
			setIsDeleting(false);
			setShowDeleteConfirm(false);
		}
	};

	const handleProcess = async () => {
		setIsProcessing(true);
		setProcessError(null);
		setProcessQueued(false);
		try {
			const response = await fetch(`/api/documents/${doc.id}/process`, {
				method: "POST",
			});
			if (response.ok) {
				setProcessQueued(true);
			} else {
				const data = await response.json();
				setProcessError(
					(data as { error?: string }).error ?? "Processing failed",
				);
			}
		} catch (error) {
			setProcessError(
				error instanceof Error ? error.message : "Processing failed",
			);
		} finally {
			setIsProcessing(false);
		}
	};

	const handleAcceptSuggestion = async (suggestion: SuggestionItem) => {
		setActioningSuggestion(suggestion.id);
		try {
			const response = await fetch(
				`/api/documents/${doc.id}/suggestions/${suggestion.id}/accept`,
				{ method: "POST" },
			);
			if (response.ok) {
				setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
				router.invalidate();
			}
		} catch (error) {
			console.error("Failed to accept suggestion:", error);
		} finally {
			setActioningSuggestion(null);
		}
	};

	const handleDismissSuggestion = async (suggestion: SuggestionItem) => {
		setActioningSuggestion(suggestion.id);
		try {
			const response = await fetch(
				`/api/documents/${doc.id}/suggestions/${suggestion.id}/dismiss`,
				{ method: "POST" },
			);
			if (response.ok) {
				setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
			}
		} catch (error) {
			console.error("Failed to dismiss suggestion:", error);
		} finally {
			setActioningSuggestion(null);
		}
	};

	const isPdf = primaryFile?.mimeType === "application/pdf";
	const isImage = primaryFile?.mimeType?.startsWith("image/") ?? false;

	const fileUrl = primaryFile
		? `/api/files/${encodeURIComponent(primaryFile.objectKey)}`
		: null;

	return (
		<div className="min-h-full">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{/* Header */}
				<div className="mb-6">
					<Link
						to="/"
						className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
					>
						<ArrowLeft className="w-4 h-4" />
						Back to Documents
					</Link>
					<div className="flex items-start justify-between">
						<div className="flex-1 min-w-0 mr-4">
							{isEditingTitle ? (
								<div className="flex items-center gap-2">
									<input
										type="text"
										value={editTitle}
										onChange={(e) => setEditTitle(e.target.value)}
										className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-2xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
										autoFocus
										onKeyDown={(e) => {
											if (e.key === "Enter") handleSaveTitle();
											if (e.key === "Escape") handleCancelEditTitle();
										}}
										disabled={isSavingTitle}
									/>
									<button
										onClick={handleSaveTitle}
										disabled={isSavingTitle || !editTitle.trim()}
										className="p-2 hover:bg-slate-700 rounded-lg text-green-400 hover:text-green-300 disabled:opacity-50"
									>
										{isSavingTitle ? (
											<Loader2 className="w-5 h-5 animate-spin" />
										) : (
											<Check className="w-5 h-5" />
										)}
									</button>
									<button
										onClick={handleCancelEditTitle}
										disabled={isSavingTitle}
										className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white disabled:opacity-50"
									>
										<X className="w-5 h-5" />
									</button>
								</div>
							) : (
								<div className="flex items-center gap-2 group">
									<h1 className="text-2xl font-bold text-white truncate">
										{doc.title}
									</h1>
									<button
										onClick={() => setIsEditingTitle(true)}
										className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
									>
										<Edit2 className="w-4 h-4" />
									</button>
								</div>
							)}
							{doc.archiveSerialNumber && (
								<p className="text-slate-400 mt-1 font-mono">
									ASN: {doc.archiveSerialNumber}
								</p>
							)}
						</div>
						<div className="flex items-center gap-2 flex-shrink-0">
							{primaryFile && (
								<button
									onClick={handleProcess}
									disabled={isProcessing || processQueued}
									className={`flex items-center gap-2 px-4 py-2 ${
										processQueued
											? "bg-green-600/20 text-green-400 border border-green-500/30"
											: "bg-slate-700 hover:bg-slate-600 text-white"
									} disabled:opacity-50 rounded-lg transition-colors`}
								>
									{isProcessing ? (
										<Loader2 className="w-4 h-4 animate-spin" />
									) : processQueued ? (
										<Check className="w-4 h-4" />
									) : (
										<RefreshCw className="w-4 h-4" />
									)}
									{isProcessing
										? "Queuing..."
										: processQueued
											? "Queued"
											: "Reprocess"}
								</button>
							)}
							{fileUrl && (
								<a
									href={fileUrl}
									download
									className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
								>
									<Download className="w-4 h-4" />
									Download
								</a>
							)}
							<button
								onClick={() => setShowDeleteConfirm(true)}
								className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-colors"
							>
								<Trash2 className="w-4 h-4" />
								Delete
							</button>
						</div>
					</div>
				</div>

				{/* Delete Confirmation Modal */}
				{showDeleteConfirm && (
					<div className="fixed inset-0 z-50 flex items-center justify-center">
						<div
							className="absolute inset-0 bg-black/60 backdrop-blur-sm"
							onClick={() => !isDeleting && setShowDeleteConfirm(false)}
						/>
						<div className="relative bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-md mx-4 p-6">
							<h3 className="text-lg font-semibold text-white mb-2">
								Delete Document
							</h3>
							<p className="text-slate-400 mb-6">
								Are you sure you want to delete "{doc.title}"? This action
								cannot be undone.
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
									onClick={handleDelete}
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

				{/* Process queued banner */}
				{processQueued && (
					<div className="mb-6 flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400">
						<Check className="w-5 h-5 flex-shrink-0" />
						<p className="text-sm flex-1">
							Document processing has been queued. Content will be extracted
							shortly.
						</p>
						<button
							onClick={() => setProcessQueued(false)}
							className="p-1 hover:bg-green-500/20 rounded"
						>
							<X className="w-4 h-4" />
						</button>
					</div>
				)}

				{/* Process error banner */}
				{processError && (
					<div className="mb-6 flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
						<AlertTriangle className="w-5 h-5 flex-shrink-0" />
						<p className="text-sm flex-1">{processError}</p>
						<button
							onClick={() => setProcessError(null)}
							className="p-1 hover:bg-red-500/20 rounded"
						>
							<X className="w-4 h-4" />
						</button>
					</div>
				)}

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Document Preview + Content */}
					<div className="lg:col-span-2 space-y-6">
						<div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
							<div className="p-4 border-b border-slate-700">
								<h2 className="text-lg font-semibold text-white">Preview</h2>
							</div>
							<div className="aspect-[3/4] bg-slate-900">
								{!primaryFile ? (
									<div className="h-full flex items-center justify-center text-slate-500">
										<div className="text-center">
											<FileText className="w-16 h-16 mx-auto mb-4" />
											<p>No file attached</p>
										</div>
									</div>
								) : isPdf ? (
									<iframe
										src={fileUrl!}
										className="w-full h-full"
										title={doc.title}
									/>
								) : isImage ? (
									<div className="h-full flex items-center justify-center p-4">
										<img
											src={fileUrl!}
											alt={doc.title}
											className="max-w-full max-h-full object-contain"
										/>
									</div>
								) : (
									<div className="h-full flex items-center justify-center text-slate-500">
										<div className="text-center">
											<FileType className="w-16 h-16 mx-auto mb-4" />
											<p>Preview not available for this file type</p>
											<p className="text-sm mt-1">{primaryFile.mimeType}</p>
											{fileUrl && (
												<a
													href={fileUrl}
													download
													className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
												>
													<Download className="w-4 h-4" />
													Download to view
												</a>
											)}
										</div>
									</div>
								)}
							</div>
						</div>

						{/* Extracted Content */}
						<div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
							<button
								onClick={() =>
									doc.content && setContentExpanded(!contentExpanded)
								}
								className="w-full p-4 border-b border-slate-700 flex items-center justify-between"
							>
								<h2 className="text-lg font-semibold text-white flex items-center gap-2">
									<FileText className="w-5 h-5" />
									Extracted Content
								</h2>
								{doc.content ? (
									<div className="flex items-center gap-2 text-slate-400">
										<span className="text-xs">
											{doc.content.length.toLocaleString()} chars
										</span>
										{contentExpanded ? (
											<ChevronUp className="w-4 h-4" />
										) : (
											<ChevronDown className="w-4 h-4" />
										)}
									</div>
								) : (
									<span className="text-xs text-slate-500">
										No content extracted
									</span>
								)}
							</button>
							{doc.content && contentExpanded && (
								<div className="p-4 max-h-96 overflow-y-auto">
									<pre className="text-slate-300 text-sm whitespace-pre-wrap font-sans leading-relaxed">
										{doc.content}
									</pre>
								</div>
							)}
						</div>
					</div>

					{/* Metadata Sidebar */}
					<div className="space-y-6">
						{/* Details Card */}
						<div className="bg-slate-800 rounded-xl border border-slate-700">
							<div className="p-4 border-b border-slate-700">
								<h2 className="text-lg font-semibold text-white">Details</h2>
							</div>
							<div className="p-4 space-y-4">
								{/* Archive Serial Number */}
								<div className="flex items-start gap-3">
									<Hash className="w-5 h-5 text-slate-400 mt-0.5" />
									<div className="flex-1">
										<p className="text-sm text-slate-400">
											Archive Serial Number
										</p>
										{isEditingASN ? (
											<div className="flex flex-wrap items-center gap-2 mt-1">
												<input
													type="number"
													min="1"
													value={editASN}
													onChange={(e) => setEditASN(e.target.value)}
													className="w-28 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
													placeholder={`Next: #${nextASN}`}
													autoFocus
													onKeyDown={(e) => {
														if (e.key === "Enter") handleSaveASN();
														if (e.key === "Escape") handleCancelEditASN();
													}}
													disabled={isSavingASN}
												/>
												<button
													onClick={() => {
														setEditASN(nextASN.toString());
													}}
													disabled={isSavingASN}
													className="px-2 py-1 text-xs font-medium border border-cyan-500 text-cyan-400 hover:bg-cyan-500/20 rounded transition-colors disabled:opacity-50"
												>
													Use #{nextASN}
												</button>
												<button
													onClick={handleSaveASN}
													disabled={isSavingASN}
													className="p-1 hover:bg-slate-700 rounded text-green-400 hover:text-green-300 disabled:opacity-50"
												>
													{isSavingASN ? (
														<Loader2 className="w-4 h-4 animate-spin" />
													) : (
														<Check className="w-4 h-4" />
													)}
												</button>
												<button
													onClick={handleCancelEditASN}
													disabled={isSavingASN}
													className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white disabled:opacity-50"
												>
													<X className="w-4 h-4" />
												</button>
											</div>
										) : (
											<div className="flex items-center gap-2">
												<p className="text-white font-mono">
													{doc.archiveSerialNumber ?? "Not assigned"}
												</p>
												{!doc.archiveSerialNumber && (
													<button
														onClick={handleAssignNextASN}
														disabled={isSavingASN}
														className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white rounded-md shadow-sm transition-colors disabled:opacity-50"
													>
														{isSavingASN ? (
															<Loader2 className="w-3 h-3 animate-spin" />
														) : (
															<>
																<Hash className="w-3 h-3" />
																Assign #{nextASN}
															</>
														)}
													</button>
												)}
											</div>
										)}
									</div>
									{!isEditingASN && (
										<button
											onClick={() => setIsEditingASN(true)}
											className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
										>
											<Edit2 className="w-4 h-4" />
										</button>
									)}
								</div>

								{/* Correspondent */}
								<div className="flex items-start gap-3">
									<User className="w-5 h-5 text-slate-400 mt-0.5" />
									<div className="flex-1">
										<p className="text-sm text-slate-400">Correspondent</p>
										<p className="text-white">
											{doc.correspondent?.name ?? "None"}
										</p>
									</div>
									<button
										onClick={() => setIsCorrespondentSelectorOpen(true)}
										className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
									>
										<Edit2 className="w-4 h-4" />
									</button>
								</div>

								{/* Category */}
								<div className="flex items-start gap-3">
									<FolderOpen className="w-5 h-5 text-slate-400 mt-0.5" />
									<div className="flex-1">
										<p className="text-sm text-slate-400">Category</p>
										{doc.category ? (
											<span
												className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium"
												style={{
													backgroundColor: doc.category.color
														? `${doc.category.color}20`
														: "#374151",
													color: doc.category.color ?? "#9CA3AF",
													borderColor: doc.category.color ?? "#4B5563",
													borderWidth: "1px",
												}}
											>
												{doc.category.name}
											</span>
										) : (
											<p className="text-white">None</p>
										)}
									</div>
									<button
										onClick={() => setIsCategorySelectorOpen(true)}
										className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
									>
										<Edit2 className="w-4 h-4" />
									</button>
								</div>

								{/* Document Date */}
								<div className="flex items-start gap-3">
									<Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
									<div className="flex-1">
										<p className="text-sm text-slate-400">Document Date</p>
										{isEditingDate ? (
											<div className="flex items-center gap-2 mt-1">
												<input
													type="date"
													value={editDate}
													onChange={(e) => setEditDate(e.target.value)}
													className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 [color-scheme:dark]"
													onKeyDown={(e) => {
														if (e.key === "Enter") handleSaveDate();
														if (e.key === "Escape") handleCancelEditDate();
													}}
													disabled={isSavingDate}
												/>
												<button
													type="button"
													onClick={handleSaveDate}
													disabled={isSavingDate}
													className="p-1 hover:bg-slate-700 rounded text-green-400 hover:text-green-300 disabled:opacity-50"
												>
													<Check className="w-4 h-4" />
												</button>
												<button
													type="button"
													onClick={handleCancelEditDate}
													disabled={isSavingDate}
													className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white disabled:opacity-50"
												>
													<X className="w-4 h-4" />
												</button>
												{doc.documentDate && (
													<button
														type="button"
														onClick={() => setEditDate("")}
														disabled={isSavingDate}
														className="px-2 py-1 text-xs border border-red-500/50 text-red-400 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
													>
														Clear
													</button>
												)}
											</div>
										) : (
											<div className="flex items-center gap-2 group/date">
												<p className="text-white">
													{doc.documentDate
														? new Date(
																`${doc.documentDate}T00:00:00`,
															).toLocaleDateString(undefined, {
																year: "numeric",
																month: "long",
																day: "numeric",
															})
														: "Not set"}
												</p>
												<button
													type="button"
													onClick={() => setIsEditingDate(true)}
													className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
												>
													<Edit2 className="w-4 h-4" />
												</button>
											</div>
										)}
									</div>
								</div>

								{/* Created At */}
								<div className="flex items-start gap-3">
									<FileText className="w-5 h-5 text-slate-400 mt-0.5" />
									<div>
										<p className="text-sm text-slate-400">Added</p>
										<p className="text-white">
											{new Date(doc.createdAt).toLocaleDateString(undefined, {
												year: "numeric",
												month: "long",
												day: "numeric",
												hour: "2-digit",
												minute: "2-digit",
											})}
										</p>
									</div>
								</div>
							</div>
						</div>

						{/* AI Suggestions Card */}
						{suggestions.length > 0 && (
							<div className="bg-slate-800 rounded-xl border border-cyan-500/30">
								<div className="p-4 border-b border-slate-700">
									<h2 className="text-lg font-semibold text-white flex items-center gap-2">
										<Sparkles className="w-5 h-5 text-cyan-400" />
										Suggestions
										<span className="ml-auto text-xs font-normal text-slate-400">
											{suggestions.length}
										</span>
									</h2>
								</div>
								<div className="p-4 space-y-3">
									{suggestions.map((suggestion) => {
										const isActioning = actioningSuggestion === suggestion.id;
										const confidence = Math.round(
											Number.parseFloat(suggestion.confidence) * 100,
										);
										return (
											<div
												key={suggestion.id}
												className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg"
											>
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2">
														<span
															className={`text-xs px-1.5 py-0.5 rounded font-medium ${
																suggestion.type === "tag"
																	? "bg-blue-500/20 text-blue-400"
																	: suggestion.type === "category"
																		? "bg-emerald-500/20 text-emerald-400"
																		: "bg-purple-500/20 text-purple-400"
															}`}
														>
															{suggestion.type}
														</span>
														<span className="text-white text-sm truncate">
															{suggestion.name}
														</span>
													</div>
													<p className="text-xs text-slate-400 mt-1">
														{confidence}% confidence
														{suggestion.tagId ||
														suggestion.correspondentId ||
														suggestion.categoryId
															? ""
															: " (new)"}
													</p>
												</div>
												<div className="flex items-center gap-1 flex-shrink-0">
													<button
														onClick={() => handleAcceptSuggestion(suggestion)}
														disabled={isActioning}
														className="p-1.5 hover:bg-green-500/20 rounded-lg transition-colors text-green-400 hover:text-green-300 disabled:opacity-50"
														title="Accept"
													>
														{isActioning ? (
															<Loader2 className="w-4 h-4 animate-spin" />
														) : (
															<Check className="w-4 h-4" />
														)}
													</button>
													<button
														onClick={() => handleDismissSuggestion(suggestion)}
														disabled={isActioning}
														className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors text-slate-400 hover:text-red-400 disabled:opacity-50"
														title="Dismiss"
													>
														<X className="w-4 h-4" />
													</button>
												</div>
											</div>
										);
									})}
								</div>
							</div>
						)}

						{/* Tags Card */}
						<div className="bg-slate-800 rounded-xl border border-slate-700">
							<div className="p-4 border-b border-slate-700 flex items-center justify-between">
								<h2 className="text-lg font-semibold text-white flex items-center gap-2">
									<Tag className="w-5 h-5" />
									Tags
								</h2>
								<button
									onClick={() => setIsTagSelectorOpen(true)}
									className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
								>
									<Edit2 className="w-4 h-4" />
								</button>
							</div>
							<div className="p-4">
								{doc.tags.length > 0 ? (
									<>
										<div className="flex flex-wrap gap-2">
											{(tagsExpanded
												? doc.tags
												: doc.tags.slice(0, MAX_VISIBLE_TAGS)
											).map((tag: DocumentTag) => (
												<span
													key={tag.id}
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
											))}
										</div>
										{doc.tags.length > MAX_VISIBLE_TAGS && (
											<button
												onClick={() => setTagsExpanded(!tagsExpanded)}
												className="mt-3 flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
											>
												{tagsExpanded ? (
													<>
														<ChevronUp className="w-4 h-4" />
														Show less
													</>
												) : (
													<>
														<ChevronDown className="w-4 h-4" />
														Show {doc.tags.length - MAX_VISIBLE_TAGS} more
													</>
												)}
											</button>
										)}
									</>
								) : (
									<p className="text-slate-500 text-sm">No tags assigned</p>
								)}
							</div>
						</div>

						{/* Tag Selector Modal */}
						{isTagSelectorOpen && (
							<TagSelectorModal
								documentId={doc.id}
								currentTagIds={doc.tags.map((t: DocumentTag) => t.id)}
								allTags={allTags}
								onClose={() => setIsTagSelectorOpen(false)}
								onUpdate={() => {
									setIsTagSelectorOpen(false);
									router.invalidate();
								}}
							/>
						)}

						{/* Correspondent Selector Modal */}
						{isCorrespondentSelectorOpen && (
							<CorrespondentSelectorModal
								documentId={doc.id}
								currentCorrespondentId={doc.correspondent?.id ?? null}
								allCorrespondents={allCorrespondents}
								onClose={() => setIsCorrespondentSelectorOpen(false)}
								onUpdate={() => {
									setIsCorrespondentSelectorOpen(false);
									router.invalidate();
								}}
							/>
						)}

						{/* Category Selector Modal */}
						{isCategorySelectorOpen && (
							<CategorySelectorModal
								documentId={doc.id}
								currentCategoryId={doc.category?.id ?? null}
								allCategories={allCategories}
								onClose={() => setIsCategorySelectorOpen(false)}
								onUpdate={() => {
									setIsCategorySelectorOpen(false);
									router.invalidate();
								}}
							/>
						)}

						{/* Files Card */}
						<div className="bg-slate-800 rounded-xl border border-slate-700">
							<div className="p-4 border-b border-slate-700">
								<h2 className="text-lg font-semibold text-white flex items-center gap-2">
									<File className="w-5 h-5" />
									Files
								</h2>
							</div>
							<div className="p-4 space-y-3">
								{doc.files.length > 0 ? (
									doc.files.map((file: DocumentFile) => (
										<div
											key={file.id}
											className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg"
										>
											{file.mimeType === "application/pdf" ? (
												<FileText className="w-8 h-8 text-red-400" />
											) : file.mimeType.startsWith("image/") ? (
												<Image className="w-8 h-8 text-blue-400" />
											) : (
												<File className="w-8 h-8 text-slate-400" />
											)}
											<div className="flex-1 min-w-0">
												<p className="text-white text-sm truncate">
													{file.objectKey.split("/").pop()}
												</p>
												<div className="flex items-center gap-2 text-xs text-slate-400">
													<span>{file.mimeType}</span>
													<span>•</span>
													<span>{formatFileSize(Number(file.sizeBytes))}</span>
												</div>
											</div>
											<a
												href={`/api/files/${encodeURIComponent(file.objectKey)}`}
												download
												className="p-2 hover:bg-slate-600 rounded-lg transition-colors text-slate-400 hover:text-white"
											>
												<Download className="w-4 h-4" />
											</a>
										</div>
									))
								) : (
									<p className="text-slate-500 text-sm">No files attached</p>
								)}
							</div>
						</div>

						{/* Activity Card */}
						<div className="bg-slate-800 rounded-xl border border-slate-700">
							<div className="p-4 border-b border-slate-700">
								<h2 className="text-lg font-semibold text-white flex items-center gap-2">
									<MessageSquare className="w-5 h-5" />
									Activity
									<span className="ml-auto text-xs font-normal text-slate-400">
										{timeline.length}
									</span>
								</h2>
							</div>
							<div className="max-h-96 overflow-y-auto">
								{timeline.length > 0 ? (
									<div className="p-4 space-y-3">
										{timeline.map((event, idx) => (
											<TimelineEntry
												key={`${event.type}-${event.timestamp}-${idx}`}
												event={event}
												deletingCommentId={deletingCommentId}
												onDeleteComment={handleDeleteComment}
											/>
										))}
									</div>
								) : (
									<div className="p-4">
										<p className="text-slate-500 text-sm">No activity yet</p>
									</div>
								)}
							</div>
							<div className="p-4 border-t border-slate-700">
								<div className="flex gap-2">
									<textarea
										value={newComment}
										onChange={(e) => setNewComment(e.target.value)}
										placeholder="Add a comment..."
										className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
										rows={2}
										onKeyDown={(e) => {
											if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
												e.preventDefault();
												handleAddComment();
											}
										}}
										disabled={isSubmittingComment}
									/>
									<button
										onClick={handleAddComment}
										disabled={isSubmittingComment || !newComment.trim()}
										className="self-end p-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
									>
										{isSubmittingComment ? (
											<Loader2 className="w-4 h-4 animate-spin" />
										) : (
											<Send className="w-4 h-4" />
										)}
									</button>
								</div>
								<p className="text-xs text-slate-500 mt-1">
									Ctrl+Enter to submit
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

interface TagSelectorTag {
	id: string;
	name: string;
	color: string | null;
}

/**
 * Normalize a tag name for comparison: trim and lowercase.
 */
function normalizeTagName(name: string): string {
	return name.trim().toLowerCase();
}

/**
 * Simple fuzzy match: checks if the tag name contains all characters
 * of the search term in order (case-insensitive).
 */
function fuzzyMatch(tagName: string, search: string): boolean {
	const normalizedTag = normalizeTagName(tagName);
	const normalizedSearch = normalizeTagName(search);

	if (!normalizedSearch) return true;

	// Simple contains match for better UX
	if (normalizedTag.includes(normalizedSearch)) return true;

	// Fuzzy: all search chars appear in order
	let searchIndex = 0;
	for (const char of normalizedTag) {
		if (char === normalizedSearch[searchIndex]) {
			searchIndex++;
			if (searchIndex === normalizedSearch.length) return true;
		}
	}
	return false;
}

function TagSelectorModal({
	documentId,
	currentTagIds,
	allTags: initialTags,
	onClose,
	onUpdate,
}: {
	documentId: string;
	currentTagIds: string[];
	allTags: TagSelectorTag[];
	onClose: () => void;
	onUpdate: () => void;
}) {
	const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
		new Set(currentTagIds),
	);
	const [allTags, setAllTags] = useState<TagSelectorTag[]>(initialTags);
	const [searchQuery, setSearchQuery] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [isCreating, setIsCreating] = useState(false);

	const normalizedSearch = normalizeTagName(searchQuery);

	// Filter tags by fuzzy search
	const filteredTags = allTags.filter((tag) =>
		fuzzyMatch(tag.name, searchQuery),
	);

	// Check if there's an exact match (normalized)
	const exactMatch = allTags.some(
		(tag) => normalizeTagName(tag.name) === normalizedSearch,
	);

	// Show create option if search has text and no exact match exists
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
				// Add to local tags list
				setAllTags((prev) => [...prev, newTag]);
				// Auto-select the new tag
				setSelectedTagIds((prev) => new Set([...prev, newTag.id]));
				// Clear search
				setSearchQuery("");
			}
		} catch (error) {
			console.error("Failed to create tag:", error);
		} finally {
			setIsCreating(false);
		}
	};

	const handleSave = async () => {
		setIsSaving(true);
		try {
			const response = await fetch(`/api/documents/${documentId}/tags`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ tagIds: Array.from(selectedTagIds) }),
			});

			if (response.ok) {
				onUpdate();
			}
		} catch (error) {
			console.error("Failed to update tags:", error);
		} finally {
			setIsSaving(false);
		}
	};

	const hasChanges =
		selectedTagIds.size !== currentTagIds.length ||
		!currentTagIds.every((id) => selectedTagIds.has(id));

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-sm"
				onClick={onClose}
			/>

			{/* Modal */}
			<div className="relative bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-md mx-4">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-slate-700">
					<h2 className="text-lg font-semibold text-white flex items-center gap-2">
						<Tag className="w-5 h-5" />
						Edit Tags
					</h2>
					<button
						onClick={onClose}
						className="p-1 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Search Input */}
				<div className="p-4 border-b border-slate-700">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search or create tags..."
							className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
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

				{/* Content */}
				<div className="p-4 max-h-[50vh] overflow-y-auto">
					<div className="space-y-2">
						{/* Create new tag option */}
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
									Create tag "
									<span className="font-medium">{normalizedSearch}</span>"
								</span>
							</button>
						)}

						{/* Existing tags */}
						{filteredTags.length === 0 && !showCreateOption ? (
							<p className="text-slate-400 text-center py-4">
								{allTags.length === 0
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
										style={{
											backgroundColor: tag.color ?? "#4B5563",
										}}
									/>
									<span className="text-white flex-1 text-left">
										{tag.name}
									</span>
								</button>
							))
						)}
					</div>
				</div>

				{/* Footer */}
				<div className="flex justify-end gap-3 p-4 border-t border-slate-700">
					<button
						onClick={onClose}
						className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
					>
						Cancel
					</button>
					<button
						onClick={handleSave}
						disabled={!hasChanges || isSaving}
						className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
					>
						{isSaving ? (
							<Loader2 className="w-4 h-4 animate-spin" />
						) : (
							<Check className="w-4 h-4" />
						)}
						Save
					</button>
				</div>
			</div>
		</div>
	);
}

function TimelineEntry({
	event,
	deletingCommentId,
	onDeleteComment,
}: {
	event: TimelineEvent;
	deletingCommentId: string | null;
	onDeleteComment: (id: string) => void;
}) {
	const timeStr = new Date(event.timestamp).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

	if (event.type === "document_created") {
		return (
			<div className="flex items-start gap-2 text-sm">
				<FileText className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
				<div className="flex-1 min-w-0">
					<p className="text-slate-400">Document created</p>
					<p className="text-xs text-slate-500">{timeStr}</p>
				</div>
			</div>
		);
	}

	if (event.type === "comment_added") {
		const isDeleting = deletingCommentId === event.commentId;
		return (
			<div className="p-3 bg-slate-700/50 rounded-lg border-l-2 border-cyan-500/50">
				<div className="flex items-start gap-2">
					<MessageSquare className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
					<div className="flex-1 min-w-0">
						<p className="text-white text-sm whitespace-pre-wrap break-words">
							{event.content}
						</p>
						<p className="text-xs text-slate-500 mt-1">{timeStr}</p>
					</div>
					<button
						onClick={() => onDeleteComment(event.commentId)}
						disabled={isDeleting}
						className="p-1 hover:bg-red-500/20 rounded transition-colors text-slate-500 hover:text-red-400 disabled:opacity-50 flex-shrink-0"
						title="Delete comment"
					>
						{isDeleting ? (
							<Loader2 className="w-3.5 h-3.5 animate-spin" />
						) : (
							<Trash2 className="w-3.5 h-3.5" />
						)}
					</button>
				</div>
			</div>
		);
	}

	if (event.type === "suggestion_accepted") {
		return (
			<div className="flex items-start gap-2 text-sm">
				<Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
				<div className="flex-1 min-w-0">
					<p className="text-slate-400">
						Accepted {event.suggestionType}:{" "}
						<span className="text-green-400">{event.suggestionName}</span>
					</p>
					<p className="text-xs text-slate-500">{timeStr}</p>
				</div>
			</div>
		);
	}

	// suggestion_dismissed
	return (
		<div className="flex items-start gap-2 text-sm">
			<X className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
			<div className="flex-1 min-w-0">
				<p className="text-slate-500">
					Dismissed {event.suggestionType}: {event.suggestionName}
				</p>
				<p className="text-xs text-slate-500">{timeStr}</p>
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

interface CategorySelectorCategory {
	id: string;
	name: string;
	color: string | null;
}

function CategorySelectorModal({
	documentId,
	currentCategoryId,
	allCategories,
	onClose,
	onUpdate,
}: {
	documentId: string;
	currentCategoryId: string | null;
	allCategories: CategorySelectorCategory[];
	onClose: () => void;
	onUpdate: () => void;
}) {
	const [selectedId, setSelectedId] = useState<string | null>(
		currentCategoryId,
	);
	const [isSaving, setIsSaving] = useState(false);

	const handleSave = async () => {
		setIsSaving(true);
		try {
			const response = await fetch(`/api/documents/${documentId}/category`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ categoryId: selectedId }),
			});

			if (response.ok) {
				onUpdate();
			}
		} catch (error) {
			console.error("Failed to update category:", error);
		} finally {
			setIsSaving(false);
		}
	};

	const hasChanges = selectedId !== currentCategoryId;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-sm"
				onClick={onClose}
			/>

			{/* Modal */}
			<div className="relative bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-md mx-4">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-slate-700">
					<h2 className="text-lg font-semibold text-white flex items-center gap-2">
						<FolderOpen className="w-5 h-5" />
						Select Category
					</h2>
					<button
						onClick={onClose}
						className="p-1 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Content */}
				<div className="p-4 max-h-[60vh] overflow-y-auto">
					{allCategories.length === 0 ? (
						<p className="text-slate-400 text-center py-4">
							No categories available. Create categories from the Categories
							page.
						</p>
					) : (
						<div className="space-y-2">
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
								<span className="text-slate-400 italic">None</span>
							</button>

							{allCategories.map((category) => (
								<button
									key={category.id}
									onClick={() => setSelectedId(category.id)}
									className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
										selectedId === category.id
											? "bg-slate-600"
											: "bg-slate-700/50 hover:bg-slate-700"
									}`}
								>
									<div
										className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
											selectedId === category.id
												? "bg-cyan-500 border-cyan-500"
												: "border-slate-500"
										}`}
									>
										{selectedId === category.id && (
											<div className="w-2 h-2 bg-white rounded-full" />
										)}
									</div>
									<div
										className="w-4 h-4 rounded-full"
										style={{
											backgroundColor: category.color ?? "#4B5563",
										}}
									/>
									<span className="text-white flex-1 text-left">
										{category.name}
									</span>
								</button>
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
					<button
						onClick={handleSave}
						disabled={!hasChanges || isSaving}
						className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
					>
						{isSaving ? (
							<Loader2 className="w-4 h-4 animate-spin" />
						) : (
							<Check className="w-4 h-4" />
						)}
						Save
					</button>
				</div>
			</div>
		</div>
	);
}

interface CorrespondentSelectorCorrespondent {
	id: string;
	name: string;
}

function CorrespondentSelectorModal({
	documentId,
	currentCorrespondentId,
	allCorrespondents,
	onClose,
	onUpdate,
}: {
	documentId: string;
	currentCorrespondentId: string | null;
	allCorrespondents: CorrespondentSelectorCorrespondent[];
	onClose: () => void;
	onUpdate: () => void;
}) {
	const [selectedId, setSelectedId] = useState<string | null>(
		currentCorrespondentId,
	);
	const [isSaving, setIsSaving] = useState(false);

	const handleSave = async () => {
		setIsSaving(true);
		try {
			const response = await fetch(
				`/api/documents/${documentId}/correspondent`,
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ correspondentId: selectedId }),
				},
			);

			if (response.ok) {
				onUpdate();
			}
		} catch (error) {
			console.error("Failed to update correspondent:", error);
		} finally {
			setIsSaving(false);
		}
	};

	const hasChanges = selectedId !== currentCorrespondentId;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-sm"
				onClick={onClose}
			/>

			{/* Modal */}
			<div className="relative bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-md mx-4">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-slate-700">
					<h2 className="text-lg font-semibold text-white flex items-center gap-2">
						<User className="w-5 h-5" />
						Select Correspondent
					</h2>
					<button
						onClick={onClose}
						className="p-1 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Content */}
				<div className="p-4 max-h-[60vh] overflow-y-auto">
					{allCorrespondents.length === 0 ? (
						<p className="text-slate-400 text-center py-4">
							No correspondents available. Create correspondents from the
							dashboard.
						</p>
					) : (
						<div className="space-y-2">
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
								<span className="text-slate-400 italic">None</span>
							</button>

							{allCorrespondents.map((correspondent) => (
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
					<button
						onClick={handleSave}
						disabled={!hasChanges || isSaving}
						className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
					>
						{isSaving ? (
							<Loader2 className="w-4 h-4 animate-spin" />
						) : (
							<Check className="w-4 h-4" />
						)}
						Save
					</button>
				</div>
			</div>
		</div>
	);
}
