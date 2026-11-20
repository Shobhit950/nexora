import axios, { CanceledError, isAxiosError } from 'axios';

declare module 'axios' {
  interface AxiosRequestConfig {
    requiresAuth?: boolean;
    authGeneration?: number;
    authRetried?: boolean;
  }
}

export type User = { id: string; name: string; email: string };
type Credentials = { email: string; password: string };

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '/' : 'http://localhost:8000'),
  withCredentials: true,
  timeout: 15_000,
});

let session: { accessToken: string | null; user: User | null } = { accessToken: null, user: null };
let generation = 0;
let refreshing: Promise<string | null> | null = null;
let restoring: Promise<User | null> | null = null;
let loggingOut = false;
const sessionListeners = new Set<() => void>();

export function readSession() {
  return session;
}

export function subscribeSession(listener: () => void) {
  sessionListeners.add(listener);
  return () => { sessionListeners.delete(listener); };
}

function setSession(token: string | null, user = token ? session.user : null) {
  if (session.accessToken === token && session.user === user) return;
  session = { accessToken: token, user };
  sessionListeners.forEach(listener => listener());
}

function refreshAccessToken() {
  if (loggingOut) return Promise.resolve(null);
  if (refreshing) return refreshing;

  refreshing = api.post<{ accessToken: string }>('/api/auth/refresh')
    .then(({ data }) => {
      setSession(data.accessToken);
      return data.accessToken;
    })
    .catch(error => {
      if (!isAxiosError(error) || error.response?.status !== 401) throw error;
      setSession(null);
      return null;
    })
    .finally(() => { refreshing = null; });

  return refreshing;
}

api.interceptors.request.use(config => {
  if (!config.requiresAuth) return config;
  config.authGeneration ??= generation;

  if (config.authGeneration !== generation || loggingOut) {
    throw new CanceledError('Authentication state changed');
  }

  if (session.accessToken) config.headers.set('Authorization', `Bearer ${session.accessToken}`);
  else config.headers.delete('Authorization');
  return config;
});

api.interceptors.response.use(undefined, async (error: unknown) => {
  if (!isAxiosError(error)) throw error;
  const config = error.config;
  const { accessToken } = session;
  if (error.response?.status !== 401 || !config?.requiresAuth ||
      config.authGeneration !== generation || loggingOut || !accessToken) {
    throw error;
  }

  const sentToken = config.headers.get('Authorization');
  if (!sentToken) throw error;

  const usedCurrentToken = sentToken === `Bearer ${accessToken}`;
  if (config.authRetried) {
    if (usedCurrentToken) setSession(null);
    throw error;
  }

  // A late 401 can arrive after another request has already rotated the token.
  config.authRetried = true;
  if (usedCurrentToken && !await refreshAccessToken()) throw error;
  return api.request(config);
});

export function signup(input: Credentials & { name: string }) {
  return api.post<User>('/api/auth/signup', input);
}

export async function login(credentials: Credentials) {
  const { data: { accessToken: token, id, name, email } } =
    await api.post<User & { accessToken: string }>('/api/auth/login', credentials);
  generation++;
  setSession(token, { id, name, email });
}

export function restoreSession() {
  if (!restoring) {
    restoring = (async () => {
      if (!(session.accessToken ?? await refreshAccessToken())) return null;
      const sessionGeneration = generation;
      try {
        const { data } = await api.get<User>('/api/auth/me', { requiresAuth: true });
        if (sessionGeneration === generation) setSession(session.accessToken, data);
        return data;
      } catch (error) {
        if (sessionGeneration === generation) setSession(null);
        throw error;
      }
    })().finally(() => { restoring = null; });
  }

  return restoring;
}

export async function logout() {
  loggingOut = true;
  try {
    // Let any in-flight refresh finish updating the cookie before revoking it.
    if (refreshing) await refreshing.catch(() => {});
    await api.post('/api/auth/logout');
    generation++;
    setSession(null);
  } finally {
    loggingOut = false;
  }
}

export function authError(error: unknown, fallback: string) {
  const response = isAxiosError<{ error?: unknown; fields?: unknown }>(error) ? error.response : undefined;
  if (!response) return { message: fallback, fields: [] };

  const { error: message, fields } = response.data ?? {};
  return {
    message: response.status < 500 && typeof message === 'string' ? message : fallback,
    fields: Array.isArray(fields) ? fields.filter(
      (field): field is 'name' | 'email' | 'password' =>
        field === 'name' || field === 'email' || field === 'password',
    ) : [],
  };
}
