import { createRemoteJWKSet, jwtVerify } from "jose";

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;

// Google's public signing keys for Firebase ID tokens (cached and rotated by jose).
const jwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Verifies the Firebase ID token in the Authorization header and returns the user. */
export async function authenticate(
  header: string | undefined,
): Promise<{ uid: string; email: string | null }> {
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpError(401, "Missing authorization token.");
  if (!projectId) throw new Error("Missing FIREBASE_PROJECT_ID / VITE_FIREBASE_PROJECT_ID.");

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    if (!payload.sub) throw new Error("no subject");
    return {
      uid: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
    };
  } catch {
    throw new HttpError(401, "Invalid or expired session. Please sign in again.");
  }
}
