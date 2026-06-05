export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const AUTH_TOKEN_KEY = "expiraAuthToken";
export const AUTH_USER_EMAIL_KEY = "expiraUserEmail";

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthSession(token, email) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);

  if (email) {
    localStorage.setItem(AUTH_USER_EMAIL_KEY, email);
  }
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_EMAIL_KEY);
}

export function authHeaders(headers = {}) {
  const token = getAuthToken();

  return {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function handleUnauthorized(response) {
  if (response.status !== 401 && response.status !== 403) {
    return;
  }

  clearAuthSession();

  if (window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
}
