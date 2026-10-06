const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin';
  createdAt: string;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: object;
  token?: string | null;
};

export async function apiRequest<T = unknown>(path: string, options: RequestOptions = {}) {
  const { method = 'GET', body, token } = options;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
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
