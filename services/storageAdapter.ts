/**
 * Storage Adapter
 * 
 * This file acts as a bridge. 
 * In the current Web environment, it uses localStorage.
 * To migrate to WeChat Mini Program, simplify replace the implementation below with wx.setStorageSync / wx.getStorageSync.
 */

export const getStorage = (key: string): any => {
    try {
        // Web Implementation
        const item = localStorage.getItem(key);
        if (!item) return null;
        
        // Attempt to parse JSON, if it fails, return string
        try {
            return JSON.parse(item);
        } catch {
            return item;
        }
    } catch (e) {
        console.error("Storage Get Error", e);
        return null;
    }
};

export const setStorage = (key: string, value: any): void => {
    try {
        // Web Implementation
        const valToStore = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, valToStore);
    } catch (e) {
        console.error("Storage Set Error", e);
    }
};

export const removeStorage = (key: string): void => {
    localStorage.removeItem(key);
};
