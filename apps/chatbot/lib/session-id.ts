// Session IDs become trace filenames (data/traces/<id>.json), so accept only a
// filename-safe charset. Anything else (e.g. "../") is rejected or replaced.
const SESSION_ID = /^[A-Za-z0-9_-]{8,80}$/;

export function isValidSessionId(id: unknown): id is string {
  return typeof id === 'string' && SESSION_ID.test(id);
}

export function newSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2)}`;
}
