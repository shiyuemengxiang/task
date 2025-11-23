import React, { useState } from 'react';
import { Task, TaskType, Frequency } from '../types';
import { ProgressBar } from './ProgressBar';
import { getDaysUntilDeadline, checkRateLimit } from '../services/taskManager';
import { CheckCircle2, Circle, Plus, Minus, History, Trash2, CalendarClock, Tag, Lock, Pencil, GripVertical } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onUpdate: (id: string, newValue: number) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  dragHandleProps?: any;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onUpdate, onDelete, onEdit, dragHandleProps }) => {
  const [showHistory, setShowHistory] = useState(false);
  const [inputValue, setInputValue] = useState<string>('');

  const isDone = task.currentValue >= task.targetValue;
  const daysUntil = getDaysUntilDeadline(task);
  
  // Rate Limit Check
  const limitStatus = checkRateLimit(task);
  const isRateLimited = !limitStatus.allowed;
  
  // Urgency Logic (3 days or less)
  const isUrgent = daysUntil !== null && daysUntil <= 3 && daysUntil >= 0 && !isDone;
  const isOverdue = daysUntil !== null && daysUntil < 0 && !isDone;

  const handleIncrement = (amount: number) => {
    if (amount > 0 && isRateLimited) return;
    onUpdate(task.id, task.currentValue + amount);
  };

  const handleNumericSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(inputValue);
    if (!isNaN(val)) {
      if (val > 0 && isRateLimited) return;
      handleIncrement(val);
      setInputValue('');
    }
  };

  const frequencyLabel = {
    [Frequency.DAILY]: '每日',
    [Frequency.WEEKLY]: '每周',
    [Frequency.MONTHLY]: '每月',
    [Frequency.QUARTERLY]: '每季',
    [Frequency.YEARLY]: '每年',
    [Frequency.CUSTOM]: `每${task.customInterval}天`
  }[task.frequency];

  const getDeadlineText = () => {
    if (daysUntil === null) return null;
    if (daysUntil === 0) return '今天截止';
    if (daysUntil < 0) return `逾期 ${Math.abs(daysUntil)} 天`;
    return `剩 ${daysUntil} 天`;
  };

  const deadlineText = getDeadlineText();

  return (
    <div className={`bg-white rounded-2xl border mb-4 transition-all relative group overflow-hidden
        ${isUrgent ? 'border-orange-200 shadow-[0_0_15px_rgba(251,146,60,0.1)]' : 'border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]'}
        ${isOverdue ? 'border-red-200 bg-red-50/30' : ''}
    `}>
      {/* Decorative bg blob */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-50 to-white rounded-bl-full -z-10 opacity-50"></div>

      <div className="p-5 pb-3">
        <div className="flex justify-between items-start mb-2">
            <div className="flex-1 flex items-start gap-2">
                {/* Drag Handle */}
                {dragHandleProps && (
                    <div 
                        {...dragHandleProps} 
                        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing pt-1 -ml-1"
                    >
                        <GripVertical size={20} />
                    </div>
                )}
                
                <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                            {frequencyLabel}
                        </span>
                        {task.group && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-1">
                                <Tag size={8} />
                                {task.group}
                            </span>
                        )}
                        {deadlineText && !isDone && (
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1
                                ${isUrgent ? 'bg-orange-100 text-orange-600 border-orange-200 animate-pulse' : ''}
                                ${isOverdue ? 'bg-red-100 text-red-600 border-red-200' : 'bg-gray-50 text-gray-500 border-gray-100'}
                            `}>
                                <CalendarClock size={10} />
                                {deadlineText}
                            </span>
                        )}
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 leading-tight">{task.title}</h3>
                    {task.description && <p className="text-sm text-gray-400 mt-1">{task.description}</p>}
                </div>
            </div>
            
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                    onClick={() => onEdit(task)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    title="编辑"
                >
                    <Pencil size={18} />
                </button>
                <button 
                    onClick={() => setShowHistory(!showHistory)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    title="历史记录"
                >
                    <History size={18} />
                </button>
                <button 
                    onClick={() => onDelete(task.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                    title="删除"
                >
                    <Trash2 size={18} />
                </button>
            </div>
        </div>

        {/* Main Interaction Area */}
        <div className="mt-2">
            {task.type === TaskType.BOOLEAN ? (
            <button
                onClick={() => handleIncrement(isDone ? 0 : 1)}
                disabled={isRateLimited && !isDone}
                className={`flex items-center justify-center gap-3 w-full p-3 rounded-xl border transition-all duration-200 ${
                isDone 
                    ? 'border-green-200 bg-green-50/50 text-green-700 shadow-inner' 
                    : isRateLimited
                        ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600 bg-white'
                }`}
            >
                {isDone ? (
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                ) : isRateLimited ? (
                    <Lock className="w-6 h-6 text-gray-400" />
                ) : (
                    <Circle className="w-6 h-6 text-gray-300" />
                )}
                <span className="font-medium">
                    {isDone ? '本周期已完成' : isRateLimited ? `请${limitStatus.nextAvailable}再来` : '点击打卡'}
                </span>
            </button>
            ) : (
            <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100">
                <div className="flex justify-between text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
                <span>当前进度</span>
                <span className={isDone ? 'text-green-600' : 'text-blue-600'}>
                    {task.currentValue} <span className="text-gray-400 font-normal">/ {task.targetValue} {task.unit}</span>
                </span>
                </div>
                <ProgressBar current={task.currentValue} target={task.targetValue} />
                
                <div className="mt-4 flex items-center gap-2">
                <button 
                    onClick={() => onUpdate(task.id, task.currentValue - 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 shadow-sm hover:bg-gray-50 text-gray-600 active:translate-y-0.5 transition-all"
                >
                    <Minus size={14} />
                </button>
                
                <form onSubmit={handleNumericSubmit} className="flex-1 flex gap-2">
                    <input 
                    type="number" 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={isRateLimited ? `${limitStatus.nextAvailable}解锁` : "输入数量..."}
                    disabled={isRateLimited}
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-gray-100 disabled:text-gray-400"
                    />
                    <button 
                        type="submit"
                        disabled={!inputValue || isRateLimited}
                        className="px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                        记录
                    </button>
                </form>
                <button 
                    onClick={() => handleIncrement(1)}
                    disabled={isRateLimited}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg border shadow-sm transition-all
                        ${isRateLimited 
                            ? 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed' 
                            : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600 active:translate-y-0.5'}
                    `}
                >
                    {isRateLimited ? <Lock size={12} /> : <Plus size={14} />}
                </button>
                </div>
                {isRateLimited && !isDone && (
                    <p className="text-[10px] text-orange-400 mt-2 text-center">
                        已达到本阶段限制，请{limitStatus.nextAvailable}再继续
                    </p>
                )}
            </div>
            )}
        </div>

        {/* History Drawer */}
        {showHistory && (
            <div className="mt-4 pt-4 border-t border-gray-100 animate-in slide-in-from-top-2 duration-200">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <History size={10} /> 往期记录
                </h4>
                {task.history.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-1">暂无历史记录</p>
                ) : (
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1 scrollbar-hide">
                        {task.history.slice().reverse().map((h, idx) => (
                            <div key={idx} className="flex justify-between text-xs p-2 rounded bg-gray-50">
                                <span className="text-gray-500">{new Date(h.date).toLocaleDateString('zh-CN')}</span>
                                <span className={`${h.completed ? 'text-green-600 font-medium' : 'text-red-400'}`}>
                                    {h.completed ? '已达成' : '未达成'} ({h.value}/{task.targetValue})
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};