import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { useState, useEffect } from "react";
import {
  Trash2,
  RotateCcw,
  X,
  Loader2,
  ArrowLeft,
  FileText,
  Clock,
  AlertTriangle,
  Hash,
} from "lucide-react";
import { createDbFromHyperdrive, listDeletedDocuments, getTrashCount } from "@/db";

interface DeletedDocumentItem {
  id: string;
  title: string;
  archiveSerialNumber: number | null;
  deletedAt: string;
  daysUntilPermanentDeletion: number;
}

interface PaginatedDeletedDocuments {
  items: DeletedDocumentItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

const paginationMiddleware = createMiddleware({ type: "function" })
  .inputValidator((data: { cursor?: string }) => data)
  .server(({ next }) => next());

const getTrashDocuments = createServerFn({ method: "GET" })
  .middleware([paginationMiddleware])
  .handler(async ({ data }) => {
    const startTime = Date.now();
    const cursor = data?.cursor;
    const wideEvent: Record<string, unknown> = {
      function: "getTrashDocuments",
      timestamp: new Date().toISOString(),
      cursor,
    };

    try {
      const db = createDbFromHyperdrive(env.HYPERDRIVE);
      const result = await listDeletedDocuments(db, { cursor });

      wideEvent.trash = {
        count: result.items.length,
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

const getTrashStats = createServerFn({ method: "GET" }).handler(async () => {
  const db = createDbFromHyperdrive(env.HYPERDRIVE);
  const count = await getTrashCount(db);
  return { count };
});

export const Route = createFileRoute("/trash")({
  component: TrashPage,
  loader: async () => {
    const [trashResult, stats] = await Promise.all([
      getTrashDocuments({ data: {} }),
      getTrashStats(),
    ]);
    return { trashResult, stats };
  },
});

function TrashPage() {
  const { trashResult: initialResult, stats } = Route.useLoaderData();
  const router = useRouter();
  const [documents, setDocuments] = useState(initialResult?.items ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialResult?.nextCursor ?? null
  );
  const [hasMore, setHasMore] = useState(initialResult?.hasMore ?? false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [emptyingTrash, setEmptyingTrash] = useState(false);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);

  // Sync with loader data
  useEffect(() => {
    setDocuments(initialResult?.items ?? []);
    setNextCursor(initialResult?.nextCursor ?? null);
    setHasMore(initialResult?.hasMore ?? false);
  }, [initialResult]);

  const loadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result = await getTrashDocuments({ data: { cursor: nextCursor } });
      setDocuments((prev) => [...prev, ...result.items]);
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const restoreDocument = async (id: string) => {
    setRestoringId(id);
    try {
      const response = await fetch(`/api/trash/${id}`, { method: "POST" });
      if (response.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== id));
      }
    } catch (error) {
      console.error("Failed to restore document:", error);
    } finally {
      setRestoringId(null);
    }
  };

  const permanentlyDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/trash/${id}`, { method: "DELETE" });
      if (response.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== id));
        setDeleteConfirmId(null);
      }
    } catch (error) {
      console.error("Failed to delete document:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const emptyTrash = async () => {
    setEmptyingTrash(true);
    try {
      // Delete all documents one by one (could be optimized with bulk endpoint)
      for (const doc of documents) {
        await fetch(`/api/trash/${doc.id}`, { method: "DELETE" });
      }
      setDocuments([]);
      setShowEmptyConfirm(false);
      router.invalidate();
    } catch (error) {
      console.error("Failed to empty trash:", error);
    } finally {
      setEmptyingTrash(false);
    }
  };

  const formatDeletedDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-full">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/"
            search={{ upload: false, q: "" }}
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Documents
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trash2 className="w-8 h-8 text-red-400" />
              <div>
                <h1 className="text-2xl font-bold text-white">Trash</h1>
                <p className="text-slate-400">
                  {stats?.count ?? 0} item{(stats?.count ?? 0) !== 1 ? "s" : ""} in trash
                </p>
              </div>
            </div>
            {documents.length > 0 && (
              <button
                onClick={() => setShowEmptyConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Empty Trash
              </button>
            )}
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-200 font-medium">
              Items in trash are automatically deleted after 30 days
            </p>
            <p className="text-amber-200/70 text-sm mt-1">
              Restore items you want to keep, or permanently delete them to free
              up space immediately.
            </p>
          </div>
        </div>

        {/* Trash List */}
        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Deleted Documents</h2>
          </div>

          {documents.length === 0 ? (
            <div className="p-12 text-center">
              <Trash2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Trash is empty
              </h3>
              <p className="text-slate-400">
                Deleted documents will appear here for 30 days before being
                permanently removed.
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-700">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 flex items-center gap-4 hover:bg-slate-700/30 transition-colors"
                  >
                    {deleteConfirmId === doc.id ? (
                      <>
                        <div className="flex-1">
                          <p className="text-white">
                            Permanently delete "
                            <span className="font-medium">{doc.title}</span>"?
                          </p>
                          <p className="text-sm text-red-400">
                            This action cannot be undone.
                          </p>
                        </div>
                        <button
                          onClick={() => permanentlyDelete(doc.id)}
                          disabled={deletingId === doc.id}
                          className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 text-white text-sm font-medium rounded-lg"
                        >
                          {deletingId === doc.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Delete Forever"
                          )}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          disabled={deletingId === doc.id}
                          className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium rounded-lg"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <FileText className="w-10 h-10 text-slate-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">
                            {doc.title}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                            {doc.archiveSerialNumber && (
                              <span className="flex items-center gap-1">
                                <Hash className="w-3 h-3" />
                                ASN {doc.archiveSerialNumber}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Trash2 className="w-3 h-3" />
                              Deleted {formatDeletedDate(doc.deletedAt)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                              doc.daysUntilPermanentDeletion <= 7
                                ? "bg-red-500/20 text-red-400"
                                : doc.daysUntilPermanentDeletion <= 14
                                  ? "bg-amber-500/20 text-amber-400"
                                  : "bg-slate-700 text-slate-400"
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            {doc.daysUntilPermanentDeletion} day
                            {doc.daysUntilPermanentDeletion !== 1 ? "s" : ""} left
                          </span>
                        </div>
                        <button
                          onClick={() => restoreDocument(doc.id)}
                          disabled={restoringId === doc.id}
                          className="flex items-center gap-2 px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 disabled:bg-cyan-500/10 text-cyan-400 text-sm font-medium rounded-lg transition-colors"
                          title="Restore document"
                        >
                          {restoringId === doc.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                          Restore
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(doc.id)}
                          className="p-2 hover:bg-slate-600 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                          title="Delete permanently"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Load More Button */}
              {hasMore && (
                <div className="p-4 border-t border-slate-700 flex justify-center">
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
            </>
          )}
        </div>
      </div>

      {/* Empty Trash Confirmation Modal */}
      {showEmptyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !emptyingTrash && setShowEmptyConfirm(false)}
          />
          <div className="relative bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Empty Trash</h3>
                <p className="text-slate-400 text-sm">
                  {documents.length} item{documents.length !== 1 ? "s" : ""} will
                  be permanently deleted
                </p>
              </div>
            </div>
            <p className="text-slate-300 mb-6">
              This will permanently delete all items in the trash. This action
              cannot be undone and all files will be removed.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowEmptyConfirm(false)}
                disabled={emptyingTrash}
                className="px-4 py-2 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={emptyTrash}
                disabled={emptyingTrash}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 text-white font-medium rounded-lg transition-colors"
              >
                {emptyingTrash ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Empty Trash
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
