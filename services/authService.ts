import { getStorage, setStorage, removeStorage } from './storageAdapter';

const CURRENT_USER_KEY = 'cyclic_current_user';

export interface User {
  username: string;
  password?: string;
  webhookUrl?: string;
}

export interface AuthResult {
    success: boolean;
    message: string;
    errorType?: 'DB_NOT_INIT' | 'NETWORK_ERROR' | 'UNKNOWN' | 'DB_CONFIG_MISSING';
}

export const getCurrentUser = (): User | null => {
  return getStorage(CURRENT_USER_KEY);
};

// Helper to safely parse response
const handleAuthResponse = async (res: Response): Promise<AuthResult> => {
    try {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const data = await res.json();
            // Ensure we return a message even if the API didn't provide one
            if (!data.success && !data.message) {
                return { 
                    success: false, 
                    message: '操作失败 (服务器未返回具体原因)',
                    errorType: data.errorType || 'UNKNOWN'
                };
            }
            return data;
        } else {
            // Handle non-JSON responses (e.g., Vercel 500 HTML page or 404)
            if (res.status === 504) {
                 return { 
                     success: false, 
                     message: '服务器网关超时 (504) - 数据库响应过慢或未连接。请检查 Vercel Storage 配置。', 
                     errorType: 'NETWORK_ERROR' 
                 };
            }
            if (res.status === 500) {
                 return { 
                     success: false, 
                     message: '服务器内部错误 (500) - 请检查 Vercel 环境变量 POSTGRES_URL 是否已自动注入', 
                     errorType: 'DB_CONFIG_MISSING' 
                 };
            }
            return { success: false, message: `服务连接错误 (状态码: ${res.status})`, errorType: 'NETWORK_ERROR' };
        }
    } catch (e) {
        return { success: false, message: '解析响应失败', errorType: 'UNKNOWN' };
    }
};

// Wrapper for fetch with timeout
// Increased to 60s to allow for cold starts (database wake up) and slow networks
const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 60000) => {
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
            throw new Error('连接超时 (60秒) - 请检查网络或 Vercel 后台数据库状态 (POSTGRES_URL)');
        }
        throw error;
    }
};

export const register = async (username: string, password: string): Promise<AuthResult> => {
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
    return { success: false, message: e.message || '网络请求失败，请检查网络连接', errorType: 'NETWORK_ERROR' };
  }
};

export const login = async (username: string, password: string): Promise<AuthResult> => {
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
    return { success: false, message: e.message || '网络请求失败，请检查网络连接', errorType: 'NETWORK_ERROR' };
  }
};

export const logout = () => {
  removeStorage(CURRENT_USER_KEY);
};

export const isLoggedIn = (): boolean => {
  return !!getStorage(CURRENT_USER_KEY);
};