import { Task, Frequency, TaskHistory, LimitPeriod } from '../types';
import { getStorage, setStorage } from './storageAdapter';
import { getCurrentUser } from './authService';

// Base key for Guest mode
const GUEST_STORAGE_KEY = 'cyclic_tasks_v1_guest';

export type { Task };

// --- Pure Logic Functions (Client Side) ---

const needsReset = (task: Task): boolean => {
  const last = new Date(task.lastUpdated);
  const now = new Date();
  const freq = task.frequency;

  // Reset time portion for fair comparison
  last.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (freq === Frequency.DAILY) {
    return today.getTime() > last.getTime();
  }

  if (freq === Frequency.WEEKLY) {
    const getWeek = (d: Date) => {
      const date = new Date(d.getTime());
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
      const week1 = new Date(date.getFullYear(), 0, 4);
      return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    };
    return getWeek(now) !== getWeek(last) || now.getFullYear() !== last.getFullYear();
  }

  if (freq === Frequency.MONTHLY) {
    return now.getMonth() !== last.getMonth() || now.getFullYear() !== last.getFullYear();
  }

  if (freq === Frequency.QUARTERLY) {
    const currentQ = Math.floor((now.getMonth() + 3) / 3);
    const lastQ = Math.floor((last.getMonth() + 3) / 3);
    return currentQ !== lastQ || now.getFullYear() !== last.getFullYear();
  }

  if (freq === Frequency.YEARLY) {
    return now.getFullYear() !== last.getFullYear();
  }

  if (freq === Frequency.CUSTOM && task.customInterval) {
    const diffTime = Math.abs(today.getTime() - last.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= task.customInterval;
  }

  return false;
};

export const checkRateLimit = (task: Task): { allowed: boolean; nextAvailable?: string } => {
  if (!task.limitConfig || !task.activityLog) return { allowed: true };

  const now = new Date();
  const { period, count } = task.limitConfig;
  let countInPeriod = 0;

  task.activityLog.forEach(timestamp => {
    const logDate = new Date(timestamp);
    if (period === LimitPeriod.DAILY) {
      if (logDate.toDateString() === now.toDateString()) countInPeriod++;
    } else if (period === LimitPeriod.WEEKLY) {
       const diffTime = Math.abs(now.getTime() - logDate.getTime());
       const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
       if (diffDays < 7 && now.getDay() >= logDate.getDay()) countInPeriod++;
    } else if (period === LimitPeriod.MONTHLY) {
      if (logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear()) countInPeriod++;
    }
  });

  if (countInPeriod >= count) {
    let nextText = '';
    if (period === LimitPeriod.DAILY) nextText = '明天';
    if (period === LimitPeriod.WEEKLY) nextText = '下周';
    if (period === LimitPeriod.MONTHLY) nextText = '下个月';
    return { allowed: false, nextAvailable: nextText };
  }

  return { allowed: true };
};

export const getDaysUntilDeadline = (task: Task): number | null => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); 
  
  if (task.frequency === Frequency.DAILY) return 0;

  if (task.frequency === Frequency.WEEKLY && task.deadlineDay) {
    const currentDay = now.getDay() === 0 ? 7 : now.getDay();
    let diff = task.deadlineDay - currentDay;
    if (diff < 0) diff += 7;
    return diff;
  }

  if (task.frequency === Frequency.MONTHLY && task.deadlineDay) {
    let targetYear = now.getFullYear();
    let targetMonth = now.getMonth();
    let targetDate = new Date(targetYear, targetMonth, task.deadlineDay);
    
    const maxDay = new Date(targetYear, targetMonth + 1, 0).getDate();
    if (task.deadlineDay > maxDay) targetDate = new Date(targetYear, targetMonth, maxDay);

    const diffTime = targetDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  if (task.frequency === Frequency.YEARLY && task.deadlineMonth && task.deadlineDay) {
    const targetDate = new Date(now.getFullYear(), task.deadlineMonth - 1, task.deadlineDay);
    const diffTime = targetDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  return null;
};

// --- Data Persistence Layer ---

/**
 * Loads tasks from API (if logged in) or LocalStorage (if guest).
 * Handles Cycle Resets on the client side for immediate feedback, 
 * although the Cron job also does this server-side.
 */
export const loadTasks = async (): Promise<Task[]> => {
  const user = getCurrentUser();
  let tasks: Task[] = [];

  if (user) {
    // Cloud Mode
    try {
        const res = await fetch(`/api/tasks?username=${user.username}`);
        if (res.ok) {
            const data = await res.json();
            tasks = data.tasks || [];
            // Sync settings to local for fast access
            if (data.webhookUrl) {
                setStorage('cyclic_webhook_url', data.webhookUrl);
            }
        }
    } catch (e) {
        console.error("Failed to load cloud tasks", e);
        // Fallback or empty? Better to return empty than confusing state, or cache.
        // For now, return empty array on failure
        return [];
    }
  } else {
    // Guest Mode
    tasks = getStorage(GUEST_STORAGE_KEY) || [];
  }
  
  if (!Array.isArray(tasks)) return [];

  const nowStr = new Date().toISOString();
  let hasChanges = false;

  // Client-side Check for Cycle Resets (Optimistic UI update)
  const updatedTasks = tasks.map((task: Task) => {
    if (!task.activityLog) task.activityLog = [];

    if (needsReset(task)) {
      hasChanges = true;
      const historyItem: TaskHistory = {
        date: task.lastUpdated,
        value: task.currentValue,
        completed: task.currentValue >= task.targetValue
      };
      
      return {
        ...task,
        history: [...(task.history || []), historyItem],
        currentValue: 0,
        lastUpdated: nowStr,
        activityLog: [],
        pushConfig: task.pushConfig ? { ...task.pushConfig, lastPushDate: undefined } : undefined
      };
    }
    return task;
  });

  if (hasChanges) {
    // We don't await this save to avoid blocking UI, fire and forget
    saveTasks(updatedTasks);
  }

  return updatedTasks;
};

export const saveTasks = async (tasks: Task[]) => {
  const user = getCurrentUser();
  
  if (user) {
    // Cloud Save
    try {
        await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username: user.username,
                tasks: tasks 
                // webhookUrl is synced separately or via settings page
            })
        });
    } catch (e) {
        console.error("Cloud save failed", e);
        // Queue for retry? (Out of scope for this version)
    }
  } else {
    // Guest Save
    setStorage(GUEST_STORAGE_KEY, tasks);
  }
};

export const saveSettings = async (webhookUrl: string) => {
    setStorage('cyclic_webhook_url', webhookUrl);
    const user = getCurrentUser();
    if (user) {
        try {
            await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user.username, webhookUrl })
            });
        } catch (e) {
            console.error("Settings sync failed", e);
        }
    }
};