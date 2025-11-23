export enum Frequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM',
}

export enum TaskType {
  BOOLEAN = 'BOOLEAN', // Checkbox (Done/Not Done)
  NUMERIC = 'NUMERIC', // Progress Bar (e.g., 3/5 times, $200/$500)
}

export enum LimitPeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export interface LimitConfig {
  period: LimitPeriod;
  count: number; // e.g., 1 time per DAILY
}

export interface PushConfig {
  enabled: boolean;
  advanceDays: number[]; // Days before deadline to notify: [1, 3, 7]
  notifyOnDueDate: boolean; // Notify on the day of deadline
  lastPushDate?: string; // ISO Date string (YYYY-MM-DD) to prevent duplicate pushes
}

export interface TaskHistory {
  date: string; // ISO Date string of when the cycle closed
  value: number;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  group?: string; // New: Category/Group
  type: TaskType;
  frequency: Frequency;
  customInterval?: number; // New: Days for CUSTOM frequency
  
  // Progress tracking
  targetValue: number; // 1 for Boolean, N for Numeric
  currentValue: number;
  
  // Logic
  lastUpdated: string; // ISO Date string
  unit?: string; // e.g., "$", "times", "km"
  
  // Constraints / Rate Limiting
  limitConfig?: LimitConfig; // e.g., Max 1 per day
  activityLog?: number[]; // Timestamp (ms) of every increment in current cycle
  
  // Deadlines
  deadlineDay?: number; // Day of month (1-31) or Day of week (1-7)
  deadlineMonth?: number; // New: Month (1-12) for YEARLY
  
  // Notification
  pushConfig?: PushConfig;

  // History (Previous cycles)
  history: TaskHistory[];

  // Sorting
  sortOrder?: number; // Ascending sort order index
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  group?: string;
  type: TaskType;
  frequency: Frequency;
  customInterval?: number;
  targetValue: number;
  unit?: string;
  deadlineDay?: number;
  deadlineMonth?: number;
  limitConfig?: LimitConfig;
  pushConfig?: PushConfig;
}

export interface EditTaskPayload extends CreateTaskPayload {
    id: string;
}