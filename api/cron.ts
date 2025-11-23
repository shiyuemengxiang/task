import { connectToDatabase } from './db';
import { Task, Frequency, TaskHistory } from '../types';

// --- Helper Logic (Same as before) ---
const needsReset = (task: Task): boolean => {
  const last = new Date(task.lastUpdated);
  const now = new Date();
  const freq = task.frequency;

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

const getDaysUntilDeadline = (task: Task): number | null => {
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

  if (task.frequency === Frequency.YEARLY && task.deadlineMonth && task.deadlineDay) {
      const targetDate = new Date(now.getFullYear(), task.deadlineMonth - 1, task.deadlineDay);
      const diffTime = targetDate.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  return null;
};

// --- API Handler ---

export default async function handler(request: Request) {
  try {
    const { db } = await connectToDatabase();
    
    // 1. Fetch all users and their data using LookUp
    const result = await db.collection('users').aggregate([
        {
            $lookup: {
                from: "user_data",
                localField: "username",
                foreignField: "username",
                as: "data"
            }
        },
        {
            $unwind: {
                path: "$data",
                preserveNullAndEmptyArrays: false // Only want users who have data
            }
        },
        {
            $project: {
                username: 1,
                webhook_url: 1,
                tasks: "$data.tasks"
            }
        }
    ]).toArray();
    
    const updates: Promise<any>[] = [];
    const logs: string[] = [];

    for (const row of result) {
      let tasks: Task[] = row.tasks || [];
      let tasksChanged = false;
      const webhookUrl = row.webhook_url;
      const nowStr = new Date().toISOString();
      const todayStr = nowStr.split('T')[0];

      // 2. Iterate tasks
      const updatedTasks = tasks.map(task => {
        let currentTask = { ...task };
        if (!currentTask.activityLog) currentTask.activityLog = []; 
        
        // A. Reset
        if (needsReset(currentTask)) {
            tasksChanged = true;
            const historyItem: TaskHistory = {
                date: currentTask.lastUpdated,
                value: currentTask.currentValue,
                completed: currentTask.currentValue >= currentTask.targetValue
            };
            currentTask.history = [...(currentTask.history || []), historyItem];
            currentTask.currentValue = 0;
            currentTask.lastUpdated = nowStr;
            currentTask.activityLog = [];
            if (currentTask.pushConfig) {
                currentTask.pushConfig = { ...currentTask.pushConfig, lastPushDate: undefined };
            }
            logs.push(`[Reset] User: ${row.username}, Task: ${currentTask.title}`);
        }
        return currentTask;
      });

      tasks = updatedTasks;

      // B. Notifications
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
                     logs.push(`[Push] User: ${row.username}, Task: ${task.title}`);
                 } catch (e) {
                     console.error(`Push failed for ${row.username}`, e);
                 }
             }
         }
      }

      // 3. Save
      if (tasksChanged) {
          updates.push(
            db.collection('user_data').updateOne(
                { username: row.username },
                { $set: { tasks: tasks, updated_at: new Date() } }
            )
          );
      }
    }

    await Promise.all(updates);

    return new Response(JSON.stringify({ 
        success: true, 
        processedUsers: result.length, 
        updatesCount: updates.length,
        logs 
    }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error) {
      console.error("Cron Job Error:", error);
      return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
}