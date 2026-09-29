/**
 * FITXAI Mobile - API Client
 */

let authToken: string | null = null;
let apiBaseUrl = 'http://localhost:4000/api/v1';

export function setApiBaseUrl(url: string) {
  apiBaseUrl = url;
}

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  record?: any;
  error?: string;
  message?: string;
  [key: string]: any;
}

export async function mobileRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const url = `${apiBaseUrl}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const json = await res.json().catch(() => ({
      success: false,
      error: `Error de servidor HTTP ${res.status}`,
    }));

    return json;
  } catch (err: any) {
    return {
      success: false,
      error: 'Error de conexión: No se pudo contactar con el servidor. Comprueba tu conexión a Internet.',
    };
  }
}
