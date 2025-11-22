import { Task, getDaysUntilDeadline } from './taskManager';
import { Task as TaskType } from '../types';
import { getStorage } from './storageAdapter';

/**
 * Sends a webhook request.
 * Supports {title} and {body} placeholders in the URL.
 */
export const sendWebhook = async (webhookUrl: string, title: string, body: string) => {
  try {
    // Replace placeholders if they exist
    let finalUrl = webhookUrl
      .replace('{title}', encodeURIComponent(title))
      .replace('{body}', encodeURIComponent(body));

    // If placeholders are missing, append as query params (simple fallback)
    if (!webhookUrl.includes('{title}')) {
        const separator = finalUrl.includes('?') ? '&' : '?';
        finalUrl = `${finalUrl}${separator}title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    }

    await fetch(finalUrl);
    console.log(`Push notification sent for: ${title}`);
    return true;
  } catch (error) {
    console.error("Failed to send webhook", error);
    return false;
  }
};

/**
 * Checks tasks and sends notifications if conditions are met.
 * Returns a list of updated tasks (with updated lastPushDate).
 */
export const checkAndNotifyTasks = async (tasks: TaskType[], webhookUrl?: string): Promise<TaskType[]> => {
  // Use Adapter to get URL if not passed explicitly
  const urlToUse = webhookUrl || getStorage('cyclic_webhook_url');
  
  if (!urlToUse || typeof urlToUse !== 'string') return tasks;

  const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  let hasUpdates = false;

  const updatedTasks = await Promise.all(tasks.map(async (task) => {
    // 1. Check if push is enabled
    if (!task.pushConfig || !task.pushConfig.enabled) return task;

    // 2. Check if already completed
    if (task.currentValue >= task.targetValue) return task;

    // 3. Check if already pushed today
    if (task.pushConfig.lastPushDate === todayStr) return task;

    // 4. Calculate Deadline
    const daysUntil = getDaysUntilDeadline(task);
    if (daysUntil === null) return task;

    // 5. Check triggers
    const isDueDate = daysUntil === 0 && task.pushConfig.notifyOnDueDate;
    const isAdvanceNotice = task.pushConfig.advanceDays.includes(daysUntil);

    if (isDueDate || isAdvanceNotice) {
      const msg = isDueDate ? `今天截止！` : `还有 ${daysUntil} 天截止`;
      const success = await sendWebhook(urlToUse, `任务提醒: ${task.title}`, `${msg} (进度: ${task.currentValue}/${task.targetValue})`);
      
      if (success) {
        hasUpdates = true;
        return {
          ...task,
          pushConfig: {
            ...task.pushConfig,
            lastPushDate: todayStr
          }
        };
      }
    }

    return task;
  }));

  return hasUpdates ? updatedTasks : tasks;
};
