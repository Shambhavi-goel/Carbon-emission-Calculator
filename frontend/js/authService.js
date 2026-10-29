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
  if (!Array.isArray(users) || users.some((user) =>
    !user || typeof user.id !== "string" || typeof user.name !== "string" ||
    typeof user.email !== "string" || typeof user.passwordHash !== "string" ||
    !/^[\da-f]{64}$/i.test(user.passwordHash) || typeof user.salt !== "string" ||
    !/^[\da-f]{32}$/i.test(user.salt) || typeof user.createdAt !== "string"
  )) {
    throw new Error("Saved accounts are not in the expected format. Clear this site's saved data to continue.");
  }
  return users;
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

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = getCrypto().getRandomValues(new Uint8Array(16));
  return toHex(bytes);
}

export async function signUp({ name, email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const users = getUsers();
  if (users.some((user) => user.email === normalizedEmail)) {
    const error = new Error("An account with this email already exists. Sign in instead.");
    error.code = "EMAIL_EXISTS";
    throw error;
  }
  const salt = toHex(getCrypto().getRandomValues(new Uint8Array(16)));
  const user = {
    id: createId(),
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: await hashPassword(password, salt),
    salt,
    createdAt: new Date().toISOString(),
    wallet: {
      balance: 0,
      lifetimeEarned: 0,
      currentStreak: 0,
      lastActiveDate: null,
      transactions: []
    }
  };
  users.push(user);
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  saveUserSession(user);
  return publicUser(user);
}

export async function signIn({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const user = getUsers().find((candidate) => candidate.email === normalizedEmail);
  const valid = user && await hashPassword(password, user.salt) === user.passwordHash;
  if (!valid) {
    const error = new Error("Email or password is incorrect.");
    error.code = "INVALID_CREDENTIALS";
    throw error;
  }
  saveUserSession(user);
  return publicUser(user);
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

function saveUserSession(user) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify({
    userId: user.id,
    name: user.name,
    email: user.email
  }));
}

export function getSession() {
  const session = parseJson(window.localStorage, SESSION_KEY, null);
  if (session === null) return null;
  if (!session || typeof session.userId !== "string" || typeof session.name !== "string" || typeof session.email !== "string") {
    throw new Error("Saved session is invalid. Clear this site's saved data to continue.");
  }
  const user = getUsers().find((candidate) => candidate.id === session.userId && candidate.email === session.email);
  return user ? publicUser(user) : null;
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
