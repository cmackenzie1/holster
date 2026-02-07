import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
	FileText,
	Home,
	Menu,
	Tag,
	Users,
	X,
	Settings,
	Upload,
	Trash2,
	Search,
} from "lucide-react";

function SearchBar({
	onSearch,
	initialValue = "",
	className = "",
}: {
	onSearch: (query: string) => void;
	initialValue?: string;
	className?: string;
}) {
	const [query, setQuery] = useState(initialValue);

	// Sync with external value changes
	useEffect(() => {
		setQuery(initialValue);
	}, [initialValue]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		onSearch(query);
	};

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.value;
		setQuery(newValue);
		// Auto-clear search when input is emptied
		if (newValue === "" && initialValue !== "") {
			onSearch("");
		}
	};

	const handleClear = () => {
		setQuery("");
		onSearch("");
	};

	return (
		<form onSubmit={handleSubmit} className={`relative ${className}`}>
			<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
			<input
				type="text"
				value={query}
				onChange={handleChange}
				placeholder="Search documents..."
				className="w-full pl-10 pr-8 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
			/>
			{query && (
				<button
					type="button"
					onClick={handleClear}
					className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
				>
					<X className="w-3 h-3" />
				</button>
			)}
		</form>
	);
}

function Sidebar({
	isOpen,
	onClose,
	onUploadClick,
	onSearch,
	searchQuery,
}: {
	isOpen?: boolean;
	onClose?: () => void;
	onUploadClick: () => void;
	onSearch: (query: string) => void;
	searchQuery: string;
}) {
	return (
		<aside
			className={`
        fixed top-0 left-0 h-full w-64 bg-slate-900 text-white shadow-2xl z-50
        transform transition-transform duration-300 ease-in-out flex flex-col
        lg:relative lg:translate-x-0 lg:shadow-none lg:z-auto
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
      `}
		>
			<div className="flex items-center justify-between p-4 border-b border-slate-700">
				<Link
					to="/"
					search={{ upload: false, q: "" }}
					className="flex items-center gap-2"
					onClick={onClose}
				>
					<FileText className="w-6 h-6 text-cyan-400" />
					<h2 className="text-lg font-bold">Paperless</h2>
				</Link>
				<button
					type="button"
					onClick={onClose}
					className="p-2 hover:bg-slate-800 rounded-lg transition-colors lg:hidden"
					aria-label="Close menu"
				>
					<X size={20} />
				</button>
			</div>

			{/* Search Bar */}
			<div className="p-3 border-b border-slate-700">
				<SearchBar
					onSearch={(q) => {
						onSearch(q);
						onClose?.();
					}}
					initialValue={searchQuery}
				/>
			</div>

			<nav className="flex-1 p-3 overflow-y-auto">
				<div className="space-y-1">
					<Link
						to="/"
						search={{ upload: false, q: "" }}
						onClick={onClose}
						className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 hover:text-white"
						activeProps={{
							className:
								"flex items-center gap-3 px-3 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors text-white",
						}}
						activeOptions={{ exact: true }}
					>
						<Home size={20} />
						<span className="font-medium">Dashboard</span>
					</Link>

					<Link
						to="/correspondents"
						onClick={onClose}
						className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 hover:text-white"
						activeProps={{
							className:
								"flex items-center gap-3 px-3 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors text-white",
						}}
					>
						<Users size={20} />
						<span className="font-medium">Correspondents</span>
					</Link>

					<Link
						to="/tags"
						onClick={onClose}
						className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 hover:text-white"
						activeProps={{
							className:
								"flex items-center gap-3 px-3 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors text-white",
						}}
					>
						<Tag size={20} />
						<span className="font-medium">Tags</span>
					</Link>
				</div>

				<div className="mt-6 pt-6 border-t border-slate-700 space-y-1">
					<button
						type="button"
						onClick={() => {
							onUploadClick();
							onClose?.();
						}}
						className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 hover:text-white"
					>
						<Upload size={20} />
						<span className="font-medium">Upload</span>
					</button>

					<Link
						to="/trash"
						onClick={onClose}
						className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 hover:text-white"
						activeProps={{
							className:
								"flex items-center gap-3 px-3 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors text-white",
						}}
					>
						<Trash2 size={20} />
						<span className="font-medium">Trash</span>
					</Link>

					<Link
						to="/"
						search={{ upload: false, q: "" }}
						onClick={onClose}
						className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 hover:text-white"
					>
						<Settings size={20} />
						<span className="font-medium">Settings</span>
					</Link>
				</div>
			</nav>
		</aside>
	);
}

export default function Header({ children }: { children?: React.ReactNode }) {
	const [isOpen, setIsOpen] = useState(false);
	const navigate = useNavigate();

	// Get current search query from the URL location (works on any route)
	const locationSearch = useRouterState({
		select: (s) => s.location.search,
	});
	const currentSearch = (locationSearch as { q?: string })?.q ?? "";

	const handleUploadClick = () => {
		navigate({ to: "/", search: { upload: true, q: currentSearch } });
	};

	const handleSearch = useCallback(
		(query: string) => {
			navigate({ to: "/", search: { upload: false, q: query } });
		},
		[navigate],
	);

	return (
		<div className="flex min-h-screen bg-slate-900">
			{/* Mobile backdrop */}
			{isOpen && (
				<div
					role="button"
					tabIndex={0}
					className="fixed inset-0 bg-black/50 z-40 lg:hidden"
					onClick={() => setIsOpen(false)}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							setIsOpen(false);
						}
					}}
					aria-label="Close menu"
				/>
			)}

			{/* Sidebar */}
			<Sidebar
				isOpen={isOpen}
				onClose={() => setIsOpen(false)}
				onUploadClick={handleUploadClick}
				onSearch={handleSearch}
				searchQuery={currentSearch}
			/>

			{/* Main content area */}
			<div className="flex-1 flex flex-col min-w-0">
				{/* Mobile header */}
				<header className="px-4 py-3 flex items-center gap-3 bg-slate-800 text-white shadow-lg border-b border-slate-700 lg:hidden">
					<button
						type="button"
						onClick={() => setIsOpen(true)}
						className="p-2 hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
						aria-label="Open menu"
					>
						<Menu size={24} />
					</button>
					<SearchBar
						onSearch={handleSearch}
						initialValue={currentSearch}
						className="flex-1"
					/>
				</header>

				{/* Page content */}
				<main className="flex-1">{children}</main>

				{/* Footer */}
				<footer className="py-4 px-6 text-center text-sm text-slate-500 border-t border-slate-800">
					Made with ☕ & 🌧️ in Seattle
				</footer>
			</div>
		</div>
	);
}
