import { getItem, KEYS, setItem } from '@/lib/storage';

export interface Account {
  id: string;
  name: string;
  createdAt: string;
  lastActiveAt: string;
}

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 20;

function createId() {
  return `acct-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

export function normalizeAccountName(name: string) {
  return name.trim();
}

export function validateAccountName(name: string, accounts = getAccounts()): string {
  const normalized = normalizeAccountName(name);

  if (normalized.length < MIN_NAME_LENGTH || normalized.length > MAX_NAME_LENGTH) {
    return '账户名需要在 2-20 个字符之间。';
  }

  const exists = accounts.some(account => account.name.toLowerCase() === normalized.toLowerCase());
  if (exists) return '这个账户名已经存在。';

  return '';
}

export function getAccounts(): Account[] {
  return getItem<Account[]>(KEYS.ACCOUNTS, []);
}

export function getActiveAccountId(): string | null {
  return getItem<string | null>(KEYS.ACTIVE_ACCOUNT_ID, null);
}

export function getActiveAccount(): Account | null {
  const activeId = getActiveAccountId();
  if (!activeId) return null;
  return getAccounts().find(account => account.id === activeId) || null;
}

export function setActiveAccount(id: string): Account | null {
  const now = new Date().toISOString();
  const accounts = getAccounts();
  const account = accounts.find(item => item.id === id);
  if (!account) return null;

  const updated = accounts.map(item => item.id === id ? { ...item, lastActiveAt: now } : item);
  setItem(KEYS.ACCOUNTS, updated);
  setItem(KEYS.ACTIVE_ACCOUNT_ID, id);
  return { ...account, lastActiveAt: now };
}

export function clearActiveAccount() {
  setItem(KEYS.ACTIVE_ACCOUNT_ID, null);
}

export function createAccount(name: string): Account {
  const accounts = getAccounts();
  const normalized = normalizeAccountName(name);
  const error = validateAccountName(normalized, accounts);
  if (error) throw new Error(error);

  const now = new Date().toISOString();
  const account: Account = {
    id: createId(),
    name: normalized,
    createdAt: now,
    lastActiveAt: now,
  };

  setItem(KEYS.ACCOUNTS, [...accounts, account]);
  setItem(KEYS.ACTIVE_ACCOUNT_ID, account.id);
  return account;
}

export function getScopedKey(baseKey: string): string {
  const activeId = getActiveAccountId();
  return `fla:${activeId || 'no-active-account'}:${baseKey}`;
}
