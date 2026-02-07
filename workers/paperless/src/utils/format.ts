/**
 * Format bytes into a human-readable string (B, KB, MB, GB, TB).
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";

	const units = ["B", "KB", "MB", "GB", "TB"];
	const k = 1024;
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	const value = bytes / k ** i;

	// Use more decimal places for smaller units, fewer for larger
	const decimals = i < 2 ? 0 : i < 3 ? 1 : 2;

	return `${value.toFixed(decimals)} ${units[i]}`;
}

/**
 * Generate a deterministic hex color from a string.
 * Uses a simple hash to pick a hue, with fixed saturation and lightness for pleasant colors.
 */
export function generateColorFromString(str: string): string {
	if (!str.trim()) return "#3b82f6";

	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}

	const hue = Math.abs(hash) % 360;
	const saturation = 65 + (Math.abs(hash >> 8) % 20);
	const lightness = 45 + (Math.abs(hash >> 16) % 15);

	const sNorm = saturation / 100;
	const lNorm = lightness / 100;
	const a = sNorm * Math.min(lNorm, 1 - lNorm);
	const f = (n: number) => {
		const k = (n + hue / 30) % 12;
		const color = lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
		return Math.round(255 * color)
			.toString(16)
			.padStart(2, "0");
	};
	return `#${f(0)}${f(8)}${f(4)}`;
}
