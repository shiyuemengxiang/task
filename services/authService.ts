import { getStorage, setStorage, removeStorage } from './storageAdapter';

const USERS_KEY = 'cyclic_users_db';
const CURRENT_USER_KEY = 'cyclic_current_user';

export interface User {
  username: string;
  password?: string; // In real app, this should be hashed. Storing plain text for demo only.
  nickname?: string;
  avatar?: string;
}

export const getCurrentUser = (): User | null => {
  return getStorage(CURRENT_USER_KEY);
};

export const register = (username: string, password: string): { success: boolean; message: string } => {
  const users = getStorage(USERS_KEY) || {};
  
  if (users[username]) {
    return { success: false, message: '用户名已存在' };
  }

  const newUser: User = { username, password };
  users[username] = newUser;
  setStorage(USERS_KEY, users);
  
  // Auto login after register
  setStorage(CURRENT_USER_KEY, { username });
  
  return { success: true, message: '注册成功' };
};

export const login = (username: string, password: string): { success: boolean; message: string } => {
  const users = getStorage(USERS_KEY) || {};
  const user = users[username];

  if (!user || user.password !== password) {
    return { success: false, message: '用户名或密码错误' };
  }

  setStorage(CURRENT_USER_KEY, { username: user.username });
  return { success: true, message: '登录成功' };
};

export const logout = () => {
  removeStorage(CURRENT_USER_KEY);
};

export const isLoggedIn = (): boolean => {
  return !!getStorage(CURRENT_USER_KEY);
};