import { API_BASE } from "./config.js";
import { getToken } from "./auth/keychain.js";
import { refreshAccessToken } from "./auth/refresh.js";
import { authError, serverError } from "./errors.js";

interface FetchOptions extends RequestInit {
  noAuth?: boolean;
}

/**
 * Authenticated fetch wrapper.
 * - Auto-attaches Bearer token
 * - On 401: attempts token refresh + single retry
 * - Throws CurationError for auth and server failures
 */
export async function apiFetch(
  path: string,
  options: FetchOptions = {}
): Promise<Response> {
  const url = `${API_BASE}${path}`;
  const { noAuth, ...fetchOpts } = options;

  if (!noAuth) {
    const token = await getToken("access_token");
    if (!token) {
      throw authError();
    }
    fetchOpts.headers = {
      ...fetchOpts.headers,
      Authorization: `Bearer ${token}`,
      "X-Curation-Client": "cli",
    };
  }

  let resp: Response;
  try {
    resp = await fetch(url, fetchOpts);
  } catch (err) {
    throw serverError(
      `Network error: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // 401 → try refresh once
  if (resp.status === 401 && !noAuth) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      throw authError("Session expired. Run: curation auth login");
    }

    fetchOpts.headers = {
      ...fetchOpts.headers,
      Authorization: `Bearer ${newToken}`,
    };

    try {
      resp = await fetch(url, fetchOpts);
    } catch (err) {
      throw serverError(
        `Network error on retry: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (resp.status === 401) {
      throw authError("Session expired after refresh. Run: curation auth login");
    }
  }

  if (resp.status >= 500) {
    throw serverError(`Server error: HTTP ${resp.status}`);
  }

  return resp;
}
