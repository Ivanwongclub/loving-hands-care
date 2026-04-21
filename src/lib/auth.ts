// Mock auth module — real Supabase wiring lands in S1-B.
// For now this is just an in-memory + localStorage flag.

const KEY = "hms.auth";

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "1";
}

export function signIn() {
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, "1");
}

export function signOut() {
  if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
}
