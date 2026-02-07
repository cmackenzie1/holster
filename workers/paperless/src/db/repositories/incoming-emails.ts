import type { Database } from "../index";
import { incomingEmails } from "../schema";

/**
 * Record an incoming email in the audit log.
 */
export async function recordIncomingEmail(
	db: Database,
	params: {
		from: string;
		to: string;
		subject: string | null;
		rawEmailKey: string;
		rawEmailSize: bigint;
		status: "processed" | "failed" | "ignored";
		documentsCreated: number;
		errorMessage?: string;
	},
): Promise<void> {
	await db.insert(incomingEmails).values({
		from: params.from,
		to: params.to,
		subject: params.subject,
		rawEmailKey: params.rawEmailKey,
		rawEmailSize: params.rawEmailSize,
		status: params.status,
		documentsCreated: params.documentsCreated,
		errorMessage: params.errorMessage ?? null,
	});
}
