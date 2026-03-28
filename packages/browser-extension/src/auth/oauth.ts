export interface AuthState {
  token: string | null;
  username: string | null;
  scopes: string[];
}

interface ValidationResult {
  valid: boolean;
  username: string;
  scopes: string[];
}

const STORAGE_KEY_TOKEN = 'gn_auth_token';
const STORAGE_KEY_USERNAME = 'gn_auth_username';
const STORAGE_KEY_SCOPES = 'gn_auth_scopes';

export async function getAuthState(): Promise<AuthState> {
  const result = await chrome.storage.local.get([
    STORAGE_KEY_TOKEN,
    STORAGE_KEY_USERNAME,
    STORAGE_KEY_SCOPES,
  ]);

  return {
    token: (result[STORAGE_KEY_TOKEN] as string) ?? null,
    username: (result[STORAGE_KEY_USERNAME] as string) ?? null,
    scopes: (result[STORAGE_KEY_SCOPES] as string[]) ?? [],
  };
}

export async function validateToken(token: string): Promise<ValidationResult> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!response.ok) {
      return { valid: false, username: '', scopes: [] };
    }

    const data = await response.json();
    const scopeHeader = response.headers.get('x-oauth-scopes') ?? '';
    const scopes = scopeHeader
      ? scopeHeader.split(',').map((s: string) => s.trim())
      : [];

    return {
      valid: true,
      username: data.login as string,
      scopes,
    };
  } catch {
    return { valid: false, username: '', scopes: [] };
  }
}

export async function setToken(token: string): Promise<void> {
  const validation = await validateToken(token);

  if (!validation.valid) {
    throw new Error('Invalid GitHub token');
  }

  await chrome.storage.local.set({
    [STORAGE_KEY_TOKEN]: token,
    [STORAGE_KEY_USERNAME]: validation.username,
    [STORAGE_KEY_SCOPES]: validation.scopes,
  });
}

export async function clearToken(): Promise<void> {
  await chrome.storage.local.remove([
    STORAGE_KEY_TOKEN,
    STORAGE_KEY_USERNAME,
    STORAGE_KEY_SCOPES,
  ]);
}
