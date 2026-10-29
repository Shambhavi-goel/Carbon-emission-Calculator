// ─── walletService.js ─────────────────────────────────────────────────────────
// Manages wallet persistence in localStorage using the cfc_users store.
// Stores the wallet object inside each user record for atomic reads/writes.

const USERS_KEY = "cfc_users";
const MAX_TRANSACTIONS = 50;

// ── Private helpers ────────────────────────────────────────────────────────────

function readUsers() {
  const raw = window.localStorage.getItem(USERS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); }
  catch { return []; }
}

function writeUsers(users) {
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function makeTransactionId() {
  return globalThis.crypto?.randomUUID?.() ??
    `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Return a fresh, empty wallet object */
function emptyWallet() {
  return {
    balance: 0,
    lifetimeEarned: 0,
    currentStreak: 0,
    lastActiveDate: null,
    transactions: []
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Return the wallet for a given userId, creating it if it doesn't exist yet.
 * @param {string} userId
 * @returns {{ balance: number, lifetimeEarned: number, currentStreak: number, lastActiveDate: string|null, transactions: object[] }}
 */
export function getWallet(userId) {
  const users = readUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return emptyWallet();
  return user.wallet ?? emptyWallet();
}

/**
 * Credit Eco-Points to a user's wallet.
 *
 * @param {string} userId
 * @param {{ points: number, type: string, material?: string, weightKg?: number, description: string, breakdown?: string[] }} tx
 * @returns {{ wallet: object, isFirstToday: boolean }}
 */
export function creditWallet(userId, { points, type, material, weightKg, description, breakdown = [] }) {
  const users = readUsers();
  const userIndex = users.findIndex((u) => u.id === userId);
  if (userIndex < 0) throw new Error("User not found; cannot credit wallet.");

  const user = users[userIndex];
  const wallet = user.wallet ?? emptyWallet();

  // ── Streak logic ───────────────────────────────────────────────────────────
  const today = todayISO();
  const isFirstToday = wallet.lastActiveDate !== today;
  if (isFirstToday) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const wasYesterday = wallet.lastActiveDate === yesterday.toISOString().slice(0, 10);
    wallet.currentStreak = wasYesterday ? (wallet.currentStreak ?? 0) + 1 : 1;
    wallet.lastActiveDate = today;
  }

  // ── Balance update ─────────────────────────────────────────────────────────
  wallet.balance = (wallet.balance ?? 0) + points;
  wallet.lifetimeEarned = (wallet.lifetimeEarned ?? 0) + points;

  // ── Transaction log ────────────────────────────────────────────────────────
  const record = {
    id: makeTransactionId(),
    timestamp: new Date().toISOString(),
    type,
    points,
    ...(material ? { material } : {}),
    ...(typeof weightKg === "number" ? { weightKg } : {}),
    description,
    breakdown
  };
  wallet.transactions = [record, ...(wallet.transactions ?? [])].slice(0, MAX_TRANSACTIONS);

  // ── Persist ────────────────────────────────────────────────────────────────
  users[userIndex] = { ...user, wallet };
  writeUsers(users);

  return { wallet, isFirstToday };
}

/**
 * Check whether today is the user's first activity day
 * (useful before calling calculateReward to pass isFirstToday correctly).
 */
export function isFirstActivityToday(userId) {
  const wallet = getWallet(userId);
  return wallet.lastActiveDate !== todayISO();
}

