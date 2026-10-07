function getBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!envUrl) {
    // If running in browser and no NEXT_PUBLIC_API_URL was supplied, use relative path so Next.js rewrites handle it
    if (typeof window !== 'undefined') {
      return '/api/v1';
    }
    return 'http://localhost:4000/api/v1';
  }

  // Strip trailing slashes
  let clean = envUrl.trim().replace(/\/+$/, '');
  if (!clean || clean === '/') {
    return '/api/v1';
  }

  // Ensure /api/v1 suffix if not already present
  if (!clean.endsWith('/api/v1')) {
    clean = `${clean}/api/v1`;
  }
  return clean;
}

export const API_BASE_URL = getBaseUrl();

export async function apiClient<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Ensure endpoint always starts with a single slash
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Combine base URL and endpoint
  const rawUrl = `${getBaseUrl()}${cleanEndpoint}`;

  // Collapse any duplicate slashes after protocol and at path start:
  // e.g. "https://domain.com//api/v1" -> "https://domain.com/api/v1"
  // e.g. "//api/v1/auth/login" -> "/api/v1/auth/login"
  const url = rawUrl.replace(/([^:]\/)\/+/g, '$1').replace(/^\/{2,}/, '/');

  // Read auth token from localStorage if in browser environment
  let token: string | null = null;
  if (typeof window !== 'undefined') {
    token =
      localStorage.getItem('auth_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('accessToken') ||
      localStorage.getItem('homeexpense_token');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized (session expired or invalid token)
  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('token');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('homeexpense_token');
      if (
        !window.location.pathname.startsWith('/login') &&
        !window.location.pathname.startsWith('/register')
      ) {
        window.location.href = '/login';
      }
    }
    throw new Error('Your session has expired or you are unauthorized. Please sign in.');
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage =
      data?.message ||
      data?.error ||
      `Request failed with status ${response.status}`;
    throw new Error(
      Array.isArray(errorMessage) ? errorMessage.join(', ') : errorMessage
    );
  }

  return data as T;
}
