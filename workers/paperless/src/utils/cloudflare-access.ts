/**
 * Cloudflare Access JWT verification utility.
 *
 * Verifies the CF_Authorization cookie against Cloudflare Access.
 */

const CERTS_URL = "https://eragon.cloudflareaccess.com/cdn-cgi/access/certs";
const AUDIENCE =
	"c9ed339848e406c48d16ecb95e38ff69ec7e36045b0bba7ad97a1dc0a5d4d5ee";

interface JWK {
	kty: string;
	use: string;
	kid: string;
	n: string;
	e: string;
	alg: string;
}

interface JWKS {
	keys: JWK[];
	public_cert: { kid: string; cert: string };
	public_certs: Array<{ kid: string; cert: string }>;
}

interface JWTHeader {
	alg: string;
	kid: string;
	typ: string;
}

interface JWTPayload {
	aud: string[];
	email: string;
	exp: number;
	iat: number;
	nbf: number;
	iss: string;
	type: string;
	identity_nonce: string;
	sub: string;
	country: string;
}

// Cache for JWKS to avoid fetching on every request
let jwksCache: JWKS | null = null;
let jwksCacheTime = 0;
const JWKS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetch the JWKS from Cloudflare Access.
 */
async function getJWKS(): Promise<JWKS> {
	const now = Date.now();
	if (jwksCache && now - jwksCacheTime < JWKS_CACHE_TTL) {
		return jwksCache;
	}

	const response = await fetch(CERTS_URL);
	if (!response.ok) {
		throw new Error(`Failed to fetch JWKS: ${response.status}`);
	}

	jwksCache = await response.json();
	jwksCacheTime = now;
	return jwksCache!;
}

/**
 * Base64URL decode a string.
 */
function base64UrlDecode(str: string): Uint8Array {
	// Add padding if needed
	const padding = "=".repeat((4 - (str.length % 4)) % 4);
	const base64 = (str + padding).replace(/-/g, "+").replace(/_/g, "/");
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/**
 * Import a JWK as a CryptoKey for verification.
 */
async function importJWK(jwk: JWK): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		"jwk",
		{
			kty: jwk.kty,
			n: jwk.n,
			e: jwk.e,
			alg: jwk.alg,
			use: "sig",
		},
		{
			name: "RSASSA-PKCS1-v1_5",
			hash: { name: "SHA-256" },
		},
		false,
		["verify"],
	);
}

/**
 * Parse a JWT without verification.
 */
function parseJWT(token: string): {
	header: JWTHeader;
	payload: JWTPayload;
	signature: Uint8Array;
	signedData: string;
} {
	const parts = token.split(".");
	if (parts.length !== 3) {
		throw new Error("Invalid JWT format");
	}

	const [headerB64, payloadB64, signatureB64] = parts;
	const header = JSON.parse(
		new TextDecoder().decode(base64UrlDecode(headerB64)),
	) as JWTHeader;
	const payload = JSON.parse(
		new TextDecoder().decode(base64UrlDecode(payloadB64)),
	) as JWTPayload;
	const signature = base64UrlDecode(signatureB64);
	const signedData = `${headerB64}.${payloadB64}`;

	return { header, payload, signature, signedData };
}

/**
 * Verify the JWT signature.
 */
async function verifySignature(
	signedData: string,
	signature: Uint8Array,
	key: CryptoKey,
): Promise<boolean> {
	const data = new TextEncoder().encode(signedData);
	return crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, data);
}

/**
 * Extract the CF_Authorization cookie from the Cookie header.
 */
function extractToken(cookieHeader: string | null): string | null {
	if (!cookieHeader) return null;

	const cookies = cookieHeader.split(";").map((c) => c.trim());
	for (const cookie of cookies) {
		if (cookie.startsWith("CF_Authorization=")) {
			return cookie.slice("CF_Authorization=".length);
		}
	}
	return null;
}

export interface VerifyResult {
	valid: boolean;
	payload?: JWTPayload;
	error?: string;
}

/**
 * Verify a Cloudflare Access JWT from the request.
 *
 * @param request - The incoming request
 * @returns Verification result with payload if valid
 */
export async function verifyCloudflareAccess(
	request: Request,
): Promise<VerifyResult> {
	try {
		const cookieHeader = request.headers.get("Cookie");
		const token = extractToken(cookieHeader);

		if (!token) {
			return { valid: false, error: "No CF_Authorization cookie found" };
		}

		// Parse the JWT
		const { header, payload, signature, signedData } = parseJWT(token);

		// Verify the algorithm
		if (header.alg !== "RS256") {
			return { valid: false, error: `Unsupported algorithm: ${header.alg}` };
		}

		// Check expiration
		const now = Math.floor(Date.now() / 1000);
		if (payload.exp < now) {
			return { valid: false, error: "Token expired" };
		}

		// Check not before
		if (payload.nbf > now) {
			return { valid: false, error: "Token not yet valid" };
		}

		// Check audience
		if (!payload.aud.includes(AUDIENCE)) {
			return { valid: false, error: "Invalid audience" };
		}

		// Fetch JWKS and find the matching key
		const jwks = await getJWKS();
		const jwk = jwks.keys.find((k) => k.kid === header.kid);

		if (!jwk) {
			return { valid: false, error: `Key not found: ${header.kid}` };
		}

		// Import the key and verify the signature
		const key = await importJWK(jwk);
		const valid = await verifySignature(signedData, signature, key);

		if (!valid) {
			return { valid: false, error: "Invalid signature" };
		}

		return { valid: true, payload };
	} catch (error) {
		return {
			valid: false,
			error: error instanceof Error ? error.message : "Verification failed",
		};
	}
}
