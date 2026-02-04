/**
 * Format bytes into a human-readable string (B, KB, MB, GB, TB).
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  // Use more decimal places for smaller units, fewer for larger
  const decimals = i < 2 ? 0 : i < 3 ? 1 : 2;

  return `${value.toFixed(decimals)} ${units[i]}`;
}
