// ═══════════════════════════════════════════════════════════════════════════
// API CLIENT — the only place in the app that calls `fetch`
//                          ARCHITECTURE.md §6.3 · API_CONTRACT.md §1.6, §2, §16
// ───────────────────────────────────────────────────────────────────────────
// ARCHITECTURE.md §10 forbids "a raw `fetch` outside `lib/api`". That rule is
// not about tidiness — it is the only way the guarantees below can be stated
// once instead of being re-litigated per screen:
//
//   · every request carries a correlation id, so a user-visible Reference
//     always resolves to a server log line (API_CONTRACT.md §7);
//   · every request carries an AbortSignal, and cancellation is silent (§16.5);
//   · every response is parsed through the envelope, so a component never sees
//     a raw `Response` and never has to ask whether `success` was present;
//   · a 401 `TOKEN_EXPIRED` refreshes exactly once and replays exactly once,
//     with concurrent 401s queued behind a single in-flight refresh (§8.4);
//   · every failure — transport, timeout, malformed body, refusal — arrives as
//     one shape, `ApiError`, so screens have one error path, not five.
//
// What this file deliberately does NOT do:
//
//   · It does not retry. Retry is policy, and policy that lives in the
//     transport cannot be varied per query. GET retries belong to TanStack
//     Query (`queryClient.ts`); mutations never auto-retry (§6.4).
//   · It does not render. It never toasts, never navigates, never reads a
//     store. The session-expiry surface subscribes to `onSessionExpired`.
//   · It does not hold the access token in storage. In memory only (ADR-007);
//     the refresh token is an httpOnly cookie this code cannot read by design.
// ═══════════════════════════════════════════════════════════════════════════

import { createApiError, isApiError, type ApiError, type ErrorCode } from './errors';
import { logApiError } from '../observability/logger';

/* ───────────────────────────────────────────────────────────────────────────
   Configuration
   ─────────────────────────────────────────────────────────────────────────── */

/** Trailing slash stripped so path joining is unambiguous at every call site. */
let activeApiBase = (import.meta.env['VITE_API_BASE_URL'] ?? '/api/v1').replace(/\/+$/, '');

export function getApiBaseUrl(): string {
  return activeApiBase;
}

export function setApiBaseUrl(url: string): void {
  activeApiBase = url.replace(/\/+$/, '');
}

/**
 * Client-side deadline.
 *
 * A request with no ceiling is indistinguishable from a hung one: the skeleton
 * stays forever and the user's only recourse is a reload, which loses their
 * work. 30s is long enough for a slow report on a factory LAN and short enough
 * that row 15 (timeout) fires while the user is still watching the screen.
 */
const DEFAULT_TIMEOUT_MS = 30_000;

/* ───────────────────────────────────────────────────────────────────────────
   Access token — in memory, never persisted

   ADR-007: the access token lives for 15 minutes and never touches
   localStorage, so an XSS payload cannot read it and a closed tab cannot leak
   it. Durability comes from the httpOnly refresh cookie instead.
   ─────────────────────────────────────────────────────────────────────────── */

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (typeof sessionStorage !== 'undefined') {
    if (token) {
      sessionStorage.setItem('tenant_access_token', token);
    } else {
      sessionStorage.removeItem('tenant_access_token');
    }
  }
  if (typeof localStorage !== 'undefined') {
    if (token) {
      localStorage.setItem('tenant_access_token', token);
    } else {
      localStorage.removeItem('tenant_access_token');
    }
  }
}

export function getAccessToken(path?: string): string | null {
  if (typeof window === 'undefined') {
    return accessToken;
  }

  const isPlatform =
    (Boolean(path) && (path!.startsWith('/platform') || path!.startsWith('platform') || path!.includes('/platform/'))) ||
    (typeof window !== 'undefined' && window.location.pathname.startsWith('/platform'));

  if (isPlatform) {
    const platformToken = typeof localStorage !== 'undefined' ? localStorage.getItem('platform_access_token') : null;
    return platformToken || null;
  }

  // Tenant / standard context: check in-memory first, then sessionStorage/localStorage fallback for page reload
  if (accessToken) return accessToken;
  if (typeof sessionStorage !== 'undefined' && typeof sessionStorage.getItem === 'function') {
    const impToken = sessionStorage.getItem('impersonation_token');
    if (impToken) return impToken;
    const sessionToken = sessionStorage.getItem('tenant_access_token');
    if (sessionToken) {
      accessToken = sessionToken;
      return sessionToken;
    }
  }
  if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
    const localToken = localStorage.getItem('tenant_access_token');
    if (localToken) {
      accessToken = localToken;
      return localToken;
    }
  }
  return null;
}

/* ───────────────────────────────────────────────────────────────────────────
   Session-expiry notification

   §8.1 row 10: expiry is a modal re-auth prompt that PRESERVES unsaved form
   state — "silently discarding a half-typed production entry is a defect, not
   a nuisance". So this file cannot navigate or clear state; it announces, and
   the surface that owns the unsaved work decides what to do.
   ─────────────────────────────────────────────────────────────────────────── */

type SessionExpiredListener = (error: ApiError) => void;
const sessionListeners = new Set<SessionExpiredListener>();

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

function announceSessionExpired(error: ApiError): void {
  accessToken = null;
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('tenant_access_token');
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('tenant_access_token');
  }
  for (const listener of sessionListeners) listener(error);
}

/* ───────────────────────────────────────────────────────────────────────────
   Correlation and idempotency ids

   Not `crypto.randomUUID()`: it is undefined on insecure origins, and factory
   floor tablets reach this app over plain HTTP on the local network. A weaker
   id that always exists beats a strong one that throws during error handling.
   ─────────────────────────────────────────────────────────────────────────── */

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random()
    .toString(16)
    .slice(2, 10)}`;
}

/**
 * An idempotency key for one user **intent** (§6.2) — generated when a form
 * opens or a submit is first pressed, **not** per HTTP attempt. Every retry of
 * that intent must reuse the same key, which is why this is exported rather
 * than generated inside `request()`: the transport cannot know that two calls
 * are the same intent, but the caller always does.
 */
export function newIdempotencyKey(): string {
  return randomId();
}

/* ───────────────────────────────────────────────────────────────────────────
   The envelope

   API_CONTRACT.md §2: every response is one of three shapes, and "a raw array
   is never returned at the top level". The parser trusts that contract but
   verifies it — a proxy, a captive portal or a misconfigured error page will
   happily return 200 with HTML, and MALFORMED_RESPONSE exists to name that
   precisely instead of surfacing "Unexpected token < in JSON".
   ─────────────────────────────────────────────────────────────────────────── */

export interface ResponseMeta {
  correlation_id?: string;
  pagination?: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_more: boolean;
  };
  applied?: { filters?: Record<string, unknown>; sort?: string; search?: string };
  /** §15.2 — rendered wherever an aggregate is shown (§16.11). */
  freshness?: { generated_at: string; stale: boolean; age_seconds?: number };
  /** §8.5 — a change triggers a refetch of /auth/me, never a forced logout. */
  perm_version?: string;
  /** §6.3 — a replayed idempotent write. Row 16 renders this as plain success. */
  idempotent_replay?: boolean;
  warnings?: string[];
}

/** What every call returns. `meta` is always an object, never absent (§2.1). */
export interface ApiResult<T> {
  data: T;
  meta: ResponseMeta;
  /** Response `ETag`, for a follow-up `If-Match` write (§11). */
  etag?: string | undefined;
}

interface RawEnvelope {
  success?: unknown;
  data?: unknown;
  meta?: unknown;
  error?: {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    fields?: unknown;
    retryable?: unknown;
    correlation_id?: unknown;
  };
}

/* ───────────────────────────────────────────────────────────────────────────
   Request options
   ─────────────────────────────────────────────────────────────────────────── */

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RequestOptions {
  /** Query string values. `undefined` and `null` are dropped; arrays repeat. */
  params?: Record<string, string | number | boolean | null | undefined | readonly string[]>;
  /** JSON body. Omitted entirely for GET. */
  body?: unknown;
  /** From TanStack Query's `queryFn` — cancels on unmount and key change. */
  signal?: AbortSignal | undefined;
  /** Per-intent key (§6.2). Required by the server on money/stock writes. */
  idempotencyKey?: string | undefined;
  /** Optimistic-lock version from a previous `ApiResult.etag` (§11). */
  ifMatch?: string | undefined;
  /** Override the 30s deadline for a known-slow export. */
  timeoutMs?: number | undefined;
  /** Escape hatch for the auth endpoints, which must not send a stale token. */
  skipAuth?: boolean | undefined;
  headers?: Record<string, string> | undefined;
}

function buildUrl(path: string, params: RequestOptions['params']): string {
  const cleanPath = path.replace(/^\/?(index\.php\/)?api\/v1/, '').replace(/^\/?api\/v1/, '');
  const url = `${activeApiBase}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`;
  if (!params) return url;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    /* An absent filter and an empty filter are different things (§1.5). A
       `null` here means "the caller has no value", so the key is omitted
       rather than sent as the string "null" and rejected by §5.6. */
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, item);
    } else {
      search.append(key, String(value));
    }
  }

  const query = search.toString();
  return query ? `${url}?${query}` : url;
}

/* ───────────────────────────────────────────────────────────────────────────
   Error construction

   The status→code fallback only runs when the server did not send a code,
   which by §2.3 ("returning an error body without `code`" is forbidden) means
   the response did not come from our API: a gateway 502, an nginx 413, a
   captive portal. Mapping to the right designed state is better than showing
   INTERNAL_ERROR for a proxy timeout the user could actually retry.
   ─────────────────────────────────────────────────────────────────────────── */

function fallbackCodeForStatus(status: number): ErrorCode {
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 408) return 'REQUEST_TIMEOUT';
  if (status === 409) return 'INVALID_STATE';
  if (status === 410) return 'RESOURCE_GONE';
  if (status === 413) return 'PAYLOAD_TOO_LARGE';
  if (status === 422) return 'VALIDATION_FAILED';
  if (status === 428) return 'PRECONDITION_REQUIRED';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503) return 'SERVICE_UNAVAILABLE';
  if (status === 504) return 'UPSTREAM_TIMEOUT';
  if (status === 502) return 'UPSTREAM_FAILED';
  return 'INTERNAL_ERROR';
}

/**
 * `retryable` is the server's word (`errors.ts` rule 2) and is taken verbatim
 * when present. This default only covers the no-envelope case above, where the
 * safe reading is "transport-shaped failures may be retried, refusals may not".
 */
function defaultRetryable(status: number): boolean {
  return status >= 500 || status === 408 || status === 429 || status === 0;
}

function toStringRecord(value: unknown): Record<string, string[]> | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  return value as Record<string, string[]>;
}

function errorFromEnvelope(
  status: number,
  envelope: RawEnvelope,
  correlationId?: string
): ApiError {
  const raw = envelope.error;
  const code =
    typeof raw?.code === 'string' ? (raw.code as ErrorCode) : fallbackCodeForStatus(status);

  return createApiError(code, {
    status,
    /* The server message is already safe and already translated per
       `Accept-Language` (§2.3), so it is displayed as-is. When it is missing
       the StateView registry supplies designed copy for the code — which is
       better than a raw status line either way. */
    ...(typeof raw?.message === 'string' && raw.message.length > 0 && { message: raw.message }),
    ...(typeof raw?.details === 'object' &&
      raw.details !== null && { details: raw.details as Record<string, unknown> }),
    ...(toStringRecord(raw?.fields) !== undefined && { fields: toStringRecord(raw?.fields) }),
    retryable: typeof raw?.retryable === 'boolean' ? raw.retryable : defaultRetryable(status),
    ...((typeof raw?.correlation_id === 'string' ? raw.correlation_id : correlationId) !==
      undefined && {
      correlationId: typeof raw?.correlation_id === 'string' ? raw.correlation_id : correlationId,
    }),
  });
}

/* ───────────────────────────────────────────────────────────────────────────
   Signal composition

   Three things can end a request: the caller's signal (unmount, key change),
   our own timeout, and completion. `AbortSignal.any` composes the first two
   without either cancelling the other's cleanup — but the two outcomes are NOT
   interchangeable, so the timeout sets a flag. A caller-cancelled request is
   silent (row 19); a timed-out one is row 15 and must be visible.
   ─────────────────────────────────────────────────────────────────────────── */

interface Deadline {
  signal: AbortSignal;
  didTimeout: () => boolean;
  dispose: () => void;
}

function createDeadline(callerSignal: AbortSignal | undefined, timeoutMs: number): Deadline {
  const timeoutController = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, timeoutMs);

  const signal = callerSignal
    ? AbortSignal.any([callerSignal, timeoutController.signal])
    : timeoutController.signal;

  return {
    signal,
    didTimeout: () => timedOut,
    dispose: () => clearTimeout(timer),
  };
}

/* ───────────────────────────────────────────────────────────────────────────
   Token refresh — exactly one in flight

   §8.2: "Exactly one in-flight refresh per client. Concurrent 401s queue
   behind it and replay after it resolves." A dashboard fires six queries at
   once; six parallel refreshes would rotate the token family six times and
   trip REFRESH_REUSED, logging the user out for being efficient. The shared
   promise is the whole mechanism.
   ─────────────────────────────────────────────────────────────────────────── */

let refreshInFlight: Promise<boolean> | null = null;

async function performRefresh(): Promise<boolean> {
  try {
    const response = await fetch(`${activeApiBase}/auth/refresh`, {
      method: 'POST',
      /* The httpOnly refresh cookie IS the credential (§8.2) — there is no
         body, and `credentials: 'include'` is what sends it. */
      credentials: 'include',
      headers: { Accept: 'application/json', 'X-Correlation-Id': randomId() },
    });

    if (!response.ok) return false;

    const envelope = (await response.json()) as RawEnvelope;
    const data = envelope.data as { access_token?: unknown } | undefined;
    if (typeof data?.access_token !== 'string') return false;

    accessToken = data.access_token;
    return true;
  } catch {
    /* Network failure during refresh is indistinguishable from a rejected
       refresh from here. Both mean "we cannot authenticate this request", and
       the caller turns that into the session-expiry surface. */
    return false;
  }
}

export function refreshOnce(): Promise<boolean> {
  refreshInFlight ??= performRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export function refreshSession(): Promise<ApiResult<{ access_token: string }>> {
  return api.post<{ access_token: string }>('/auth/refresh', {});
}

/* ───────────────────────────────────────────────────────────────────────────
   The single request path
   ─────────────────────────────────────────────────────────────────────────── */

async function execute<T>(
  method: Method,
  path: string,
  options: RequestOptions,
  correlationId: string,
  isReplay: boolean
): Promise<ApiResult<T>> {
  const deadline = createDeadline(options.signal, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let currentLocale = 'en';
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ui.locale') : null;
    if (stored === 'bn' || stored === 'en') {
      currentLocale = stored;
    }
  } catch {
    // Safari private mode or SSR guard
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': currentLocale,
    'X-App-Locale': currentLocale,
    'X-Correlation-Id': correlationId,
    ...options.headers,
  };

  const token = getAccessToken(path);
  if (token && options.skipAuth !== true) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Authorization'] = `Bearer ${token}`;
  }
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }
  if (options.ifMatch) {
    headers['If-Match'] = options.ifMatch;
  }

  // Auto-propagate custom storefront domain context to backend if on a custom host
  if (typeof window !== 'undefined' && window.location && !headers['X-Storefront-Domain']) {
    const host = window.location.hostname.toLowerCase().split(':')[0] ?? '';
    if (
      host &&
      !['localhost', '127.0.0.1'].includes(host) &&
      !host.startsWith('admin.') &&
      !host.startsWith('platform.') &&
      !host.startsWith('app.') &&
      !host.startsWith('erp.')
    ) {
      headers['X-Storefront-Domain'] = host;
    }
  }

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const hasBody = method !== 'GET' && options.body !== undefined;
  if (hasBody && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.params), {
      method,
      headers,
      credentials: 'include',
      signal: deadline.signal,
      ...(hasBody && {
        body: isFormData ? (options.body as FormData) : JSON.stringify(options.body),
      }),
    });
  } catch (cause) {
    /* Order matters. An abort raised by our own timer is row 15 and must be
       shown; an abort raised by the caller's signal is row 19 and must be
       silent. Both arrive here as the same DOMException. */
    if (deadline.didTimeout()) {
      throw fail(
        createApiError('REQUEST_TIMEOUT', {
          message: 'This request took too long to complete.',
          retryable: true,
          correlationId,
        })
      );
    }
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      /* Not logged and not reported. Navigating away is not a failure. */
      throw createApiError('REQUEST_CANCELLED', { message: 'Request cancelled.' });
    }
    if (!navigator.onLine) {
      throw fail(
        createApiError('NETWORK_OFFLINE', {
          message: 'Your device is offline. This will work again once you reconnect.',
          retryable: true,
          correlationId,
        })
      );
    }
    throw fail(
      createApiError('UPSTREAM_FAILED', {
        status: 502,
        message: 'We couldn’t reach the server.',
        retryable: true,
        correlationId,
      })
    );
  } finally {
    deadline.dispose();
  }

  /* The server's id wins: middleware adopts ours or generates its own (§7),
     and the one in the server's logs is the one support will search for. */
  const serverCorrelationId = response.headers.get('X-Correlation-Id') ?? correlationId;

  /* 204, and a 205/304 with no body. There is nothing to parse, and calling
     .json() would throw on the empty string. */
  if (response.status === 204 || response.headers.get('Content-Length') === '0') {
    return { data: undefined as T, meta: { correlation_id: serverCorrelationId } };
  }

  let envelope: RawEnvelope;
  try {
    const text = await response.text();
    // Resilient fallback: if web server rewrite served HTML (e.g. index.html) instead of API JSON,
    // automatically fallback to /index.php/api/v1
    if (!isReplay && activeApiBase === '/api/v1' && (text.includes('<!DOCTYPE') || text.includes('<html') || response.headers.get('content-type')?.includes('text/html'))) {
      activeApiBase = '/index.php/api/v1';
      return execute<T>(method, path, options, correlationId, true);
    }
    envelope = JSON.parse(text) as RawEnvelope;
  } catch {
    if (!isReplay && activeApiBase === '/api/v1') {
      activeApiBase = '/index.php/api/v1';
      return execute<T>(method, path, options, correlationId, true);
    }
    /* A body that is not JSON did not come from this API. Naming it
       MALFORMED_RESPONSE keeps the real cause (a proxy, a login portal, an
       HTML error page) visible in the log instead of disguising it as a
       server bug the backend team will hunt for and never find. */
    throw fail(
      createApiError('MALFORMED_RESPONSE', {
        status: response.status,
        message: 'The server returned a response we couldn’t read.',
        retryable: response.status >= 500,
        correlationId: serverCorrelationId,
      })
    );
  }

  if (!response.ok) {
    const error = errorFromEnvelope(response.status, envelope, serverCorrelationId);

    /* §8.4, the binding 401 protocol. TOKEN_EXPIRED is the only 401 that gets
       a refresh; every other 401 code means the session is genuinely over and
       retrying would just spend another round trip to learn that again.
       `isReplay` is the loop guard: refresh once, replay once, never more. */
    if (response.status === 401 && error.code === 'TOKEN_EXPIRED' && !isReplay) {
      const refreshed = await refreshOnce();
      if (refreshed) {
        return execute<T>(method, path, options, correlationId, true);
      }
      announceSessionExpired(error);
      throw fail(error);
    }
    if (response.status === 401) {
      announceSessionExpired(error);
      throw fail(error);
    }

    throw fail(error);
  }

  /* §2: `success: false` with a 2xx is forbidden by the contract, so if it
     happens the response cannot be trusted as data either. Treated as a
     protocol violation rather than quietly rendered as an empty screen. */
  if (envelope.success === false) {
    throw fail(errorFromEnvelope(response.status, envelope, serverCorrelationId));
  }

  const meta: ResponseMeta =
    typeof envelope.meta === 'object' && envelope.meta !== null
      ? (envelope.meta as ResponseMeta)
      : { correlation_id: serverCorrelationId };

  const etag = response.headers.get('ETag');

  return {
    data: envelope.data as T,
    meta,
    ...(etag !== null && { etag }),
  };
}

/**
 * Log and return, so every throw site reads `throw fail(err)`.
 *
 * Centralising it here is what makes §8.5 rule 2 structurally true: there is
 * no path out of this module that skips the log. `logApiError` already drops
 * `REQUEST_CANCELLED`, which is why the cancellation throw above bypasses this
 * helper entirely rather than relying on that filter.
 */
function fail(error: ApiError): ApiError {
  logApiError(error);
  return error;
}

async function request<T>(
  method: Method,
  path: string,
  options: RequestOptions = {}
): Promise<ApiResult<T>> {
  try {
    return await execute<T>(method, path, options, randomId(), false);
  } catch (cause) {
    /* Everything leaving this module is an ApiError. A component that receives
       a raw TypeError has no designed state for it (§16.9), so anything
       unexpected is normalised — and normalising here rather than in fifteen
       screens is the point of the seam. */
    if (isApiError(cause)) throw cause;
    throw fail(
      createApiError('INTERNAL_ERROR', {
        status: 500,
        retryable: true,
      })
    );
  }
}

/* ───────────────────────────────────────────────────────────────────────────
   Public surface

   Verb helpers rather than one `request()` export, so the read/write
   distinction is visible at the call site — that is where the retry policy,
   the idempotency requirement and the transaction boundary all diverge.
   ─────────────────────────────────────────────────────────────────────────── */

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'body' | 'idempotencyKey'>) =>
    request<T>('GET', path, options),

  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('POST', path, { ...options, body }),

  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('PATCH', path, { ...options, body }),

  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('PUT', path, { ...options, body }),

  delete: <T>(path: string, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('DELETE', path, options),
} as const;
