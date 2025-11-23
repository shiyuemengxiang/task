import { getStorage, setStorage, removeStorage } from './storageAdapter';

const CURRENT_USER_KEY = 'cyclic_current_user';

export interface User {
  username: string;
  password?: string;
  webhookUrl?: string;
}

export const getCurrentUser = (): User | null => {
  return getStorage(CURRENT_USER_KEY);
};

// Helper to safely parse response
const handleAuthResponse = async (res: Response): Promise<{ success: boolean; message: string }> => {
    try {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const data = await res.json();
            // Ensure we return a message even if the API didn't provide one
            if (!data.success && !data.message) {
                return { success: false, message: '操作失败 (服务器未返回具体原因)' };
            }
            return data;
        } else {
            // Handle non-JSON responses (e.g., Vercel 500 HTML page or 404)
            // If the status is 200 but not JSON, something is very wrong (e.g. redirected to login page)
            if (res.status === 200) {
                 return { success: false, message: '响应格式错误 (可能是 Vercel 认证拦截)' };
            }
            return { success: false, message: `服务连接错误 (状态码: ${res.status})` };
        }
    } catch (e) {
        return { success: false, message: '解析响应失败' };
    }
};

// Wrapper for fetch with timeout
const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { 
            ...options, 
            signal: controller.signal,
            // Important for Vercel Deployment Protection
            credentials: 'include' 
        });
        clearTimeout(id);
        return response;
    } catch (error: any) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error('请求超时，请检查网络或稍后重试');
        }
        throw error;
    }
};

export const register = async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
  try {
    const res = await fetchWithTimeout('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'register', username, password })
    });
    
    const data = await handleAuthResponse(res);
    
    if (data.success) {
      setStorage(CURRENT_USER_KEY, { username });
    }
    return data;
  } catch (e: any) {
    console.error("Register Error", e);
    return { success: false, message: e.message || '网络请求失败，请检查网络连接' };
  }
};

export const login = async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
  try {
    const res = await fetchWithTimeout('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', username, password })
    });
    
    const data = await handleAuthResponse(res);
    
    if (data.success) {
      setStorage(CURRENT_USER_KEY, { username });
    }
    return data;
  } catch (e: any) {
    console.error("Login Error", e);
    return { success: false, message: e.message || '网络请求失败，请检查网络连接' };
  }
};

export const logout = () => {
  removeStorage(CURRENT_USER_KEY);
};

export const isLoggedIn = (): boolean => {
  return !!getStorage(CURRENT_USER_KEY);
};