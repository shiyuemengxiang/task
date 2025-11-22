import { Task, Frequency, TaskHistory, LimitPeriod } from '../types';
import { getStorage, setStorage } from './storageAdapter';
import { getCurrentUser } from './authService';

// Base key
const BASE_STORAGE_KEY = 'cyclic_tasks_v1';

// Helper to get dynamic key based on current user
const getStorageKey = () => {
  const user = getCurrentUser();
  if (user && user.username) {
    return `${BASE_STORAGE_KEY}_${user.username}`;
  }
  return `${BASE_STORAGE_KEY}_guest`; // Default for guest/demo mode
};

export type { Task };

/**
 * Determines if a date is in a different cycle than the reference date
 */
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
    // Check if different ISO week or year
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

/**
 * Check if the task is currently rate limited (e.g., "Done for today")
 */
export const checkRateLimit = (task: Task): { allowed: boolean; nextAvailable?: string } => {
  if (!task.limitConfig || !task.activityLog) return { allowed: true };

  const now = new Date();
  const { period, count } = task.limitConfig;

  let countInPeriod = 0;

  // Filter logs based on period
  task.activityLog.forEach(timestamp => {
    const logDate = new Date(timestamp);
    
    if (period === LimitPeriod.DAILY) {
      if (logDate.toDateString() === now.toDateString()) {
        countInPeriod++;
      }
    } else if (period === LimitPeriod.WEEKLY) {
       // Simple check: same week
       const diffTime = Math.abs(now.getTime() - logDate.getTime());
       const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
       if (diffDays < 7 && now.getDay() >= logDate.getDay()) { // Rough estimation or same ISO week
           countInPeriod++;
       }
    } else if (period === LimitPeriod.MONTHLY) {
      if (logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear()) {
        countInPeriod++;
      }
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
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Clear time
  
  if (task.frequency === Frequency.DAILY) return 0;

  if (task.frequency === Frequency.WEEKLY && task.deadlineDay) {
    // 1 = Mon, 7 = Sun
    const currentDay = now.getDay() === 0 ? 7 : now.getDay();
    let diff = task.deadlineDay - currentDay;
    if (diff < 0) diff += 7;
    return diff;
  }

  if (task.frequency === Frequency.MONTHLY && task.deadlineDay) {
    let targetYear = now.getFullYear();
    let targetMonth = now.getMonth();
    
    let targetDate = new Date(targetYear, targetMonth, task.deadlineDay);
    
    // Handle month overflow (e.g. 31st)
    const maxDay = new Date(targetYear, targetMonth + 1, 0).getDate();
    if (task.deadlineDay > maxDay) {
        targetDate = new Date(targetYear, targetMonth, maxDay);
    }

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

export const loadTasks = (): Task[] => {
  try {
    const key = getStorageKey();
    const tasks = getStorage(key);
    
    // If no tasks for this user yet, return empty array
    if (!tasks || !Array.isArray(tasks)) return [];
    
    const nowStr = new Date().toISOString();

    // Check for cycle resets on load
    const updatedTasks = tasks.map((task: Task) => {
      // Migration: ensure activityLog exists
      if (!task.activityLog) task.activityLog = [];

      if (needsReset(task)) {
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
          activityLog: [], // Reset current cycle logs
          pushConfig: task.pushConfig ? { ...task.pushConfig, lastPushDate: undefined } : undefined
        };
      }
      return task;
    });

    // Save if we modified anything
    saveTasks(updatedTasks);
    return updatedTasks;
  } catch (e) {
    console.error("Failed to load tasks", e);
    return [];
  }
};

export const saveTasks = (tasks: Task[]) => {
  const key = getStorageKey();
  setStorage(key, tasks);
};