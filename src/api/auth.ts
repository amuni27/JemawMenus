import { delay, uuid, getData, setData } from './_utils';
import { createTenant, getTenantByIdSync } from './tenant';

interface Credentials {
  email: string;
  password: string;
  name?: string; // restaurant name provided during register
  address?: string;
  phone?: string;
}

interface Session {
  token: string;
  tenantId: string;
  tenantSlug: string;
  email: string;
}

const STORAGE_KEY = 'mock_users';

type UserRecord = {
  id: string;
  email: string;
  password: string;
  tenantId: string;
};

function loadUsers(): UserRecord[] {
  return getData<UserRecord[]>(STORAGE_KEY, []);
}

function saveUsers(users: UserRecord[]) {
  setData(STORAGE_KEY, users);
}

export async function login({ email, password }: Credentials): Promise<Session> {
  await delay();
  const users = loadUsers();
  const user = users.find((u) => u.email === email && u.password === password);
  if (!user) {
    throw new Error('Invalid credentials');
  }
  const tenant = getTenantByIdSync(user.tenantId);
  return {
    token: uuid(),
    tenantId: user.tenantId,
    tenantSlug: tenant?.slug || '',
    email: user.email,
  };
}

export async function register({ email, password, name, address, phone }: Credentials): Promise<Session> {
  await delay();
  const users = loadUsers();
  if (users.some((u) => u.email === email)) {
    throw new Error('User already exists');
  }
  const tenantId = name ? createTenant(name, address, phone).id : uuid();
  const newUser: UserRecord = { id: uuid(), email, password, tenantId };
  users.push(newUser);
  saveUsers(users);
  return {
    token: uuid(),
    tenantId,
    email,
  };
}

export async function logout(): Promise<void> {
  await delay(200);
  return;
}
