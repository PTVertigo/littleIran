export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin';
  createdAt: string;
};

export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: object;
};

const CSRF_COOKIE = 'csrf_token';

// The server sets this cookie on any GET; state-changing requests must echo it in a header
function csrfToken() {
  return document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${CSRF_COOKIE}=`))
    ?.slice(CSRF_COOKIE.length + 1);
}

// The session cookie is HttpOnly and same-origin, so fetch sends it without any help from here
export async function apiRequest<T = unknown>(path: string, options: RequestOptions = {}) {
  const { method = 'GET', body } = options;
  const csrf = method === 'GET' ? undefined : csrfToken();

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: {
        ...(body && { 'Content-Type': 'application/json' }),
        ...(csrf && { 'X-CSRF-Token': csrf }),
      },
      body: body && JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }

  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fieldErrors: Record<string, string> = data.errors ?? {};
    const message =
      data.error ?? Object.values(fieldErrors)[0] ?? 'Something went wrong. Please try again.';
    throw new ApiError(response.status, message, fieldErrors);
  }
  return data as T;
}
