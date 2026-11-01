import { API_BASE_URL } from "./config.js";
import { normalizeEmail } from "./validators.js";

const USERS_KEY = "cfc_users";
const SESSION_KEY = "cfc_session";

function parseJson(storage, key, fallback) {
  const value = storage.getItem(key);
  if (value === null) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Saved account data "${key}" is invalid. Clear this site's saved data to continue.`, { cause: error });
  }
}

function getUsers() {
  const users = parseJson(window.localStorage, USERS_KEY, []);
  if (!Array.isArray(users)) return [];
  return users;
}

function cacheLocalUser(user) {
  try {
    const users = getUsers();
    const idx = users.findIndex((u) => u.email === user.email);
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...user };
    } else {
      users.push(user);
    }
    window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    // Ignore localStorage caching failures
  }
}

function getCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error("Browser Web Crypto is unavailable. Use localhost or HTTPS to continue.");
  }
  return globalThis.crypto;
}

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password, salt) {
  const cryptoApi = getCrypto();
  const saltBytes = Uint8Array.from(salt.match(/.{2}/g), (byte) => Number.parseInt(byte, 16));
  const passwordBytes = new TextEncoder().encode(password);
  const input = new Uint8Array(saltBytes.length + passwordBytes.length);
  input.set(saltBytes);
  input.set(passwordBytes, saltBytes.length);
  return toHex(new Uint8Array(await cryptoApi.subtle.digest("SHA-256", input)));
}

function getCandidateAuthUrls(path) {
  const urls = [];
  if (API_BASE_URL) {
    urls.push(`${API_BASE_URL}${path}`);
  }
  if (typeof window !== "undefined") {
    const isVercel = window.location.hostname.endsWith("vercel.app");
    if (!isVercel && window.location.port !== "8000") {
      urls.push(`http://127.0.0.1:8000${path}`);
      urls.push(`http://localhost:8000${path}`);
    }
    urls.push(path);
  } else {
    urls.push(path);
  }
  return Array.from(new Set(urls));
}

async function postAuth(path, payload) {
  const urls = getCandidateAuthUrls(path);
  let lastError = null;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      // 501 indicates reaching static python http.server, proceed to next candidate (port 8000)
      if (response.status === 501 && i < urls.length - 1) {
        continue;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = data.detail || (response.status === 401 ? "Email or password is incorrect." : "Authentication failed.");
        const error = new Error(message);
        if (response.status === 401) error.code = "INVALID_CREDENTIALS";
        if (response.status === 400 && message.toLowerCase().includes("already exists")) error.code = "EMAIL_EXISTS";
        throw error;
      }

      return data.user;
    } catch (err) {
      lastError = err;
      if (err.code === "INVALID_CREDENTIALS" || err.code === "EMAIL_EXISTS") {
        throw err;
      }
      if (i < urls.length - 1) continue;
      throw err;
    }
  }

  throw lastError || new Error("Could not connect to authentication service.");
}

export async function signUp({ name, email, password }) {
  const normalizedEmail = normalizeEmail(email);

  try {
    const user = await postAuth("/api/auth/signup", {
      name: name.trim(),
      email: normalizedEmail,
      password
    });
    saveUserSession(user);
    cacheLocalUser(user);
    return publicUser(user);
  } catch (apiError) {
    if (apiError.code === "EMAIL_EXISTS") throw apiError;

    // Fallback to local accounts if backend is completely unavailable
    const users = getUsers();
    if (users.some((user) => user.email === normalizedEmail)) {
      const error = new Error("An account with this email already exists. Sign in instead.");
      error.code = "EMAIL_EXISTS";
      throw error;
    }

    const salt = toHex(getCrypto().getRandomValues(new Uint8Array(16)));
    const localUser = {
      id: toHex(getCrypto().getRandomValues(new Uint8Array(16))),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await hashPassword(password, salt),
      salt,
      createdAt: new Date().toISOString()
    };
    users.push(localUser);
    window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
    saveUserSession(localUser);
    return publicUser(localUser);
  }
}

export async function signIn({ email, password }) {
  const normalizedEmail = normalizeEmail(email);

  try {
    const user = await postAuth("/api/auth/login", {
      email: normalizedEmail,
      password
    });
    saveUserSession(user);
    cacheLocalUser(user);
    return publicUser(user);
  } catch (apiError) {
    if (apiError.code === "INVALID_CREDENTIALS") throw apiError;

    // Fallback to local accounts if backend is unreachable
    const users = getUsers();
    const localUser = users.find((candidate) => candidate.email === normalizedEmail);
    if (localUser && localUser.passwordHash && localUser.salt) {
      const valid = (await hashPassword(password, localUser.salt)) === localUser.passwordHash;
      if (valid) {
        saveUserSession(localUser);
        return publicUser(localUser);
      }
    }

    throw apiError;
  }
}

function publicUser(user) {
  return { id: String(user.id), name: user.name, email: user.email };
}

function saveUserSession(user) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify({
    userId: String(user.id),
    name: user.name,
    email: user.email
  }));
}

export function getSession() {
  const session = parseJson(window.localStorage, SESSION_KEY, null);
  if (session === null) return null;
  if (!session || typeof session.userId !== "string" || typeof session.name !== "string" || typeof session.email !== "string") {
    return null;
  }
  return { id: session.userId, name: session.name, email: session.email };
}

export function signOut() {
  window.localStorage.removeItem(SESSION_KEY);
}

export function requireAuth() {
  const user = getSession();
  if (!user) {
    window.location.replace("index.html#account-access");
    return null;
  }
  return user;
}

export function redirectIfSignedIn() {
  if (getSession()) window.location.replace("dashboard.html");
}
