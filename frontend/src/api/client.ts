/**
 * API Client para FITXAI Web Panel
 */

const API_BASE = '/api/v1';

export function getStoredToken(): string | null {
  return localStorage.getItem('fitxai_token');
}

export function setStoredToken(token: string): void {
  localStorage.setItem('fitxai_token', token);
}

export function clearStoredToken(): void {
  localStorage.removeItem('fitxai_token');
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string; [key: string]: any }> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (res.status === 401 && !endpoint.includes('/auth/login')) {
      clearStoredToken();
      window.location.reload();
      return { success: false, error: 'Sesión expirada' };
    }

    const json = await res.json().catch(() => ({ success: false, error: 'Error de respuesta' }));
    return json;
  } catch (err: any) {
    return { success: false, error: err.message || 'Error de conexión con el servidor' };
  }
}

export async function downloadFile(endpoint: string, defaultFilename: string) {
  const token = getStoredToken();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error('Error al descargar archivo');
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function openPdfView(endpoint: string) {
  const token = getStoredToken();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const html = await res.text();
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

