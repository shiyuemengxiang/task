import { sql } from '@vercel/postgres';

// --- Logic duplicated from services/taskManager.ts to run server-side ---
// In a full monorepo setup we would share code, but inline is safer for Vercel Functions without build steps
const Frequency = { DAILY: 'DAILY', WEEKLY: 'WEEKLY', MONTHLY: 'MONTHLY', QUARTERLY: 'QUARTERLY', YEARLY: 'YEARLY', CUSTOM: 'CUSTOM' };

const needsReset = (task) => {
  const last = new Date(task.lastUpdated);
  const now = new Date();
  const freq = task.frequency;

  last.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (freq === Frequency.DAILY) return today.getTime() > last.getTime();
  if (freq === Frequency.WEEKLY) {
    const getWeek = (d) => {
      const date = new Date(d.getTime());
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
      const week1 = new Date(date.getFullYear(), 0, 4);
      return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    };
    return getWeek(now) !== getWeek(last) || now.getFullYear() !== last.getFullYear();
  }
  if (freq === Frequency.MONTHLY) return now.getMonth() !== last.getMonth() || now.getFullYear() !== last.getFullYear();
  if (freq === Frequency.QUARTERLY) {
    const currentQ = Math.floor((now.getMonth() + 3) / 3);
    const lastQ = Math.floor((last.getMonth() + 3) / 3);
    return currentQ !== lastQ || now.getFullYear() !== last.getFullYear();
  }
  if (freq === Frequency.YEARLY) return now.getFullYear() !== last.getFullYear();
  if (freq === Frequency.CUSTOM && task.customInterval) {
    const diffTime = Math.abs(today.getTime() - last.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= task.customInterval;
  }
  return false;
};

const getDaysUntilDeadline = (task) => {
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
    let targetDate = new Date(now.getFullYear(), now.getMonth(), task.deadlineDay);
    const maxDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    if (task.deadlineDay > maxDay) targetDate = new Date(now.getFullYear(), now.getMonth(), maxDay);
    const diffTime = targetDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return null;
};

// --- Handler ---

export default async function handler(request: Request) {
  // Security check for manual invocation if needed, Vercel Cron secures this automatically 
  // if configured in vercel.json, but public access should be guarded.
  // For this demo, we assume it's public or protected by Vercel's internal cron header.
  
  try {
    const result = await sql`
        SELECT u.username, u.webhook_url, d.tasks 
        FROM users u 
        JOIN user_data d ON u.username = d.username
    `;
    
    const updates = [];

    for (const row of result.rows) {
      let tasks = row.tasks || [];
      let tasksChanged = false;
      const webhookUrl = row.webhook_url;
      const nowStr = new Date().toISOString();
      const todayStr = nowStr.split('T')[0];

      // 1. Process Resets
      tasks = tasks.map(task => {
        if (!task.activityLog) task.activityLog = []; // ensure compatibility
        
        if (needsReset(task)) {
            tasksChanged = true;
            const historyItem = {
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

      // 2. Process Notifications
      if (webhookUrl) {
         for (let i = 0; i < tasks.length; i++) {
             const task = tasks[i];
             if (!task.pushConfig || !task.pushConfig.enabled) continue;
             if (task.currentValue >= task.targetValue) continue;
             if (task.pushConfig.lastPushDate === todayStr) continue;

             const daysUntil = getDaysUntilDeadline(task);
             if (daysUntil === null) continue;

             const isDueDate = daysUntil === 0 && task.pushConfig.notifyOnDueDate;
             const isAdvanceNotice = task.pushConfig.advanceDays.includes(daysUntil);

             if (isDueDate || isAdvanceNotice) {
                 const msg = isDueDate ? `今天截止！` : `还有 ${daysUntil} 天截止`;
                 const title = `任务提醒: ${task.title}`;
                 const body = `${msg} (进度: ${task.currentValue}/${task.targetValue})`;
                 
                 // Fire and forget webhook
                 let finalUrl = webhookUrl
                    .replace('{title}', encodeURIComponent(title))
                    .replace('{body}', encodeURIComponent(body));
                 if (!webhookUrl.includes('{title}')) {
                    const separator = finalUrl.includes('?') ? '&' : '?';
                    finalUrl = `${finalUrl}${separator}title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
                 }
                 
                 try {
                     await fetch(finalUrl);
                     tasks[i] = {
                         ...task,
                         pushConfig: { ...task.pushConfig, lastPushDate: todayStr }
                     };
                     tasksChanged = true;
                     console.log(`Pushed for ${row.username}: ${task.title}`);
                 } catch (e) {
                     console.error(`Push failed for ${row.username}`, e);
                 }
             }
         }
      }

      if (tasksChanged) {
          updates.push(sql`
            UPDATE user_data 
            SET tasks = ${JSON.stringify(tasks)}::jsonb, updated_at = NOW() 
            WHERE username = ${row.username}
          `);
      }
    }

    await Promise.all(updates);

    return new Response(JSON.stringify({ processed: result.rows.length, updated: updates.length }), { status: 200 });

  } catch (error) {
      console.error(error);
      return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
}