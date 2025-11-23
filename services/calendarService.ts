import { Task, Frequency } from '../types';
import { getDaysUntilDeadline } from './taskManager';

/**
 * Helper to format Date object to iCal string (YYYYMMDDTHHmmSS)
 */
const formatICalDate = (date: Date, isAllDay = true): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  if (isAllDay) {
    return `${year}${month}${day}`;
  }
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
};

/**
 * Calculate the next start date for the event based on task configuration
 */
const getStartDate = (task: Task): Date => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysUntil = getDaysUntilDeadline(task);
    
    if (daysUntil !== null && daysUntil >= 0) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + daysUntil);
        // Set default reminder time to 9:00 AM
        targetDate.setHours(9, 0, 0, 0);
        return targetDate;
    }
    
    // Fallback for overdue or weird states: Start tomorrow 9 AM
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow;
};

/**
 * Generate RRULE (Recurrence Rule) string
 */
const getRRule = (task: Task): string | null => {
  switch (task.frequency) {
    case Frequency.DAILY:
      return 'FREQ=DAILY';
    case Frequency.WEEKLY:
        // Map 1-7 (Mon-Sun) to MO, TU...
        const mapDays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
        const dayIndex = (task.deadlineDay || 7) - 1; // Default Sunday
        return `FREQ=WEEKLY;BYDAY=${mapDays[dayIndex]}`;
    case Frequency.MONTHLY:
        const monthDay = task.deadlineDay || 1;
        return `FREQ=MONTHLY;BYMONTHDAY=${monthDay}`;
    case Frequency.YEARLY:
        return 'FREQ=YEARLY';
    case Frequency.CUSTOM:
        return `FREQ=DAILY;INTERVAL=${task.customInterval || 1}`;
    default:
        return null;
  }
};

export const generateICS = (tasks: Task[]) => {
  // Filter only tasks that make sense to remind (have deadlines or are recurring)
  const validTasks = tasks.filter(t => t.frequency !== Frequency.QUARTERLY); // Quarterly is complex in basic iCal, skipping for simplicity or mapping to Monthly interval 3

  if (validTasks.length === 0) return null;

  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cyclic Task Manager//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  validTasks.forEach(task => {
    const startDate = getStartDate(task);
    const endDate = new Date(startDate);
    endDate.setHours(startDate.getHours() + 1); // 1 hour duration default

    const rrule = getRRule(task);
    
    icsContent.push('BEGIN:VEVENT');
    icsContent.push(`UID:${task.id}@cyclic.app`);
    icsContent.push(`DTSTAMP:${formatICalDate(new Date(), false)}`);
    icsContent.push(`DTSTART:${formatICalDate(startDate, false)}`);
    icsContent.push(`DTEND:${formatICalDate(endDate, false)}`);
    icsContent.push(`SUMMARY:🔵 ${task.title}`);
    icsContent.push(`DESCRIPTION:${task.description || ''} [目标: ${task.targetValue} ${task.unit || ''}]`);
    
    if (rrule) {
        icsContent.push(`RRULE:${rrule}`);
    }

    // Add Alarm (Notification) 15 minutes before
    icsContent.push('BEGIN:VALARM');
    icsContent.push('TRIGGER:-PT15M');
    icsContent.push('ACTION:DISPLAY');
    icsContent.push(`DESCRIPTION:记得完成任务: ${task.title}`);
    icsContent.push('END:VALARM');

    icsContent.push('END:VEVENT');
  });

  icsContent.push('END:VCALENDAR');

  return icsContent.join('\r\n');
};

export const downloadCalendarFile = (tasks: Task[]) => {
    const content = generateICS(tasks);
    if (!content) {
        alert("没有可导出的定期任务（需包含截止日期设置）。");
        return;
    }

    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'cyclic_tasks.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};