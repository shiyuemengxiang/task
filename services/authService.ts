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
        const isJson = contentType && contentType.includes("application/json");

        if (res.ok) {
            if (isJson) return await res.json();
            return { success: true, message: '操作成功' };
        } else {
            // Handle Errors
            if (isJson) {
                const data = await res.json();
                return {
                    success: false,
                    message: data.message || 'Unknown JSON Error',
                    errorType: data.errorType || 'UNKNOWN'
                };
            } else {
                // Handle non-JSON errors (like Vercel 500 HTML page or raw text)
                const text = await res.text();
                console.error("Non-JSON API Error:", text.substring(0, 200)); // Log first 200 chars

                if (res.status === 504) {
                     return { 
                         success: false, 
                         message: '连接超时 (504) - 数据库唤醒中或连接配置有误。请等待1分钟后再试。', 
                         errorType: 'NETWORK_ERROR' 
                     };
                }
                if (res.status === 500) {
                     // Check if it's the specific "FUNCTION_INVOCATION_FAILED" from Vercel logs
                     return { 
                         success: false, 
                         message: `服务器内部错误 (500)。请检查 Vercel Logs。可能原因：数据库连接字符串格式不兼容 (如 prisma+postgres)。`, 
                         errorType: 'DB_CONFIG_MISSING' 
                     };
                }
                return { 
                    success: false, 
                    message: `服务器错误 (${res.status}): ${text.substring(0, 50) || 'No content'}`, 
                    errorType: 'NETWORK_ERROR' 
                };
            }
        }
    } catch (e) {
        return { success: false, message: '解析响应失败', errorType: 'UNKNOWN' };
    }
};

// Wrapper for fetch with timeout
// 60 seconds timeout to accommodate database cold starts
const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 60000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { 
            ...options, 
            signal: controller.signal,
            credentials: 'include' 
        });
        clearTimeout(id);
        return response;
    } catch (error: any) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error('连接超时 (60秒) - 数据库可能正在唤醒。请检查 Vercel 的环境变量是否包含 DATABASE_URL 或 POSTGRES_URL。');
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