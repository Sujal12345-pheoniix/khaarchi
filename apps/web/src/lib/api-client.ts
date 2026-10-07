// 1. Get raw base URL or fallback to local development
const RAW_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

// 2. Strip any trailing slashes (e.g. "https://khaarchi.onrender.com/" -> "https://khaarchi.onrender.com")
let cleanBase = RAW_URL.replace(/\/+$/, '');

// 3. Automatically ensure "/api/v1" is present at the end
if (!cleanBase.endsWith('/api/v1')) {
  cleanBase = `${cleanBase}/api/v1`;
}

export const API_BASE_URL = cleanBase;

export async function apiClient<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Ensure endpoint always starts with a single slash
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;

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
