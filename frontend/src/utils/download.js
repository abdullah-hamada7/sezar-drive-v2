import { http } from '../services/http.service';

export async function downloadApiFile({ endpoint, filename }) {
  let token = http.getAccessToken?.();
  if (!token) {
    const refreshed = await http.tryRefresh?.();
    if (refreshed) token = http.getAccessToken?.();
  }

  const response = await fetch(`/api/v1${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    const message = error?.error?.message || error?.message || response.statusText;
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
