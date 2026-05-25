export const LINK_COOKIE_NAME = 'link_user_id';
export const LINK_COOKIE_MAX_AGE_MS = 5 * 60 * 1000;

export function extractLinkUserId(req: any): string | null {
  const raw: string | undefined = req?.headers?.cookie;
  if (!raw) return null;
  const parts = raw.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const name = trimmed.slice(0, eq).trim();
    if (name === LINK_COOKIE_NAME) {
      const value = trimmed.slice(eq + 1).trim();
      try {
        return decodeURIComponent(value) || null;
      } catch {
        return value || null;
      }
    }
  }
  return null;
}

export function buildLinkCookieHeader(userId: string): string {
  const expires = new Date(Date.now() + LINK_COOKIE_MAX_AGE_MS).toUTCString();
  return [
    `${LINK_COOKIE_NAME}=${encodeURIComponent(userId)}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Expires=${expires}`,
  ].join('; ');
}

export function buildClearLinkCookieHeader(): string {
  return [
    `${LINK_COOKIE_NAME}=`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
  ].join('; ');
}
