import { delay, uuid, getData, setData } from './_utils';

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




export async function logout(): Promise<void> {
  await delay(200);
  return;
}
