export function toUserMessage(error: unknown): string {
  if (error instanceof Error) {
    const normalized = error.message.toLowerCase();

    if (normalized.includes("auth/invalid-credential")) {
      return "Email or password is incorrect.";
    }
    if (normalized.includes("auth/too-many-requests")) {
      return "Too many login attempts. Please try again later.";
    }
    if (normalized.includes("permission-denied")) {
      return "You do not have permission to access this data.";
    }
    if (normalized.includes("failed to fetch") || normalized.includes("network")) {
      return "Network error. Check your connection and try again.";
    }
    return error.message;
  }

  return "Something went wrong. Please try again.";
}
