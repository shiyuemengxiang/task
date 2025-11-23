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
                console.error("Non-JSON API Error:", text.slice(0, 500)); 

                // Check for common Vercel error codes/messages
                if (res.status === 504) {
                     return { 
                         success: false, 
                         message: '连接超时 (504) - 数据库可能正在休眠，请1分钟后重试。', 
                         errorType: 'NETWORK_ERROR' 
                     };
                }
                
                if (text.includes("FUNCTION_INVOCATION_FAILED")) {
                    return {
                        success: false,
                        message: "Server Error: FUNCTION_INVOCATION_FAILED. 可能是数据库连接串格式不兼容或依赖缺失。",
                        errorType: 'DB_CONFIG_MISSING'
                    };
                }

                let cleanMsg = text.slice(0, 200);
                // Try to extract useful info from Vercel error page title
                const titleMatch = text.match(/<title>(.*?)<\/title>/);
                if (titleMatch) cleanMsg = titleMatch[1];

                return { 
                    success: false, 
                    message: `服务器错误 (${res.status}): ${cleanMsg}`, 
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