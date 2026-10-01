import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;

if (getApps().length === 0) initializeApp({ projectId });

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

  try {
    const decoded = await getAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    throw new HttpError(401, "Invalid or expired session. Please sign in again.");
  }
}
