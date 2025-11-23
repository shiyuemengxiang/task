import { getStorage, setStorage, removeStorage } from './storageAdapter';

const CURRENT_USER_KEY = 'cyclic_current_user';

export interface User {
  username: string;
  password?: string; // Kept for interface compatibility, but not stored locally
  webhookUrl?: string;
}

export const getCurrentUser = (): User | null => {
  return getStorage(CURRENT_USER_KEY);
};

export const register = async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'register', username, password })
    });
    const data = await res.json();
    
    if (data.success) {
      setStorage(CURRENT_USER_KEY, { username });
    }
    return data;
  } catch (e) {
    console.error(e);
    // Fallback for offline/guest logic if API fails? No, for registration we need API.
    return { success: false, message: '注册失败: 网络错误或服务不可用' };
  }
};

export const login = async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', username, password })
    });
    const data = await res.json();
    
    if (data.success) {
      setStorage(CURRENT_USER_KEY, { username });
    }
    return data;
  } catch (e) {
    console.error(e);
    return { success: false, message: '登录失败: 网络错误' };
  }
};

export const logout = () => {
  removeStorage(CURRENT_USER_KEY);
  // Optional: Clear local tasks cache if needed, but keeping them allows "Guest" usage to potentially see stale data or empty.
  // Better to reload page or clear state in App.
};

export const isLoggedIn = (): boolean => {
  return !!getStorage(CURRENT_USER_KEY);
};