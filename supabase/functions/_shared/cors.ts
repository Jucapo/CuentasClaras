// CORS for the browser app: only the origins listed in ALLOWED_ORIGINS (production and localhost).

const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type';
const ALLOWED_METHODS = 'POST, OPTIONS';
const PREFLIGHT_MAX_AGE_SECONDS = '86400';

/** Origins from the comma-separated ALLOWED_ORIGINS secret. */
export function allowedOrigins(): readonly string[] {
  return (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/** Whether a browser on this origin may call the function. */
export function isAllowedOrigin(origin: string): boolean {
  return allowedOrigins().includes(origin);
}

/** CORS headers for a response; an origin that is not allowed gets none. */
export function corsHeaders(origin: string | null): Record<string, string> {
  if (origin === null || !isAllowedOrigin(origin)) {
    return { Vary: 'Origin' };
  }
  return {
    Vary: 'Origin',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Max-Age': PREFLIGHT_MAX_AGE_SECONDS,
  };
}
