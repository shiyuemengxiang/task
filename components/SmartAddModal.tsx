import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Loader2, Tag, ShieldAlert, ChevronDown, Bell } from 'lucide-react';
import { Frequency, TaskType, CreateTaskPayload, LimitPeriod, Task } from '../types';
import { parseTaskWithGemini } from '../services/geminiService';

interface SmartAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (task: CreateTaskPayload) => void;
  onEdit?: (id: string, task: CreateTaskPayload) => void;
  initialData?: Task;
  existingGroups?: string[];
  defaultGroup?: string | null;
}

export const SmartAddModal: React.FC<SmartAddModalProps> = ({ 
  isOpen, 
  onClose, 
  onAdd, 
  onEdit, 
  initialData, 
  existingGroups = [],
  defaultGroup
}) => {
  const [mode, setMode] = useState<'MANUAL' | 'AI'>('AI');
  const [loading, setLoading] = useState(false);
  const [aiInput, setAiInput] = useState('');
  
  // Manual State
  const [title, setTitle] = useState('');
  const [group, setGroup] = useState('默认');
  const [type, setType] = useState<TaskType>(TaskType.BOOLEAN);
  const [frequency, setFrequency] = useState<Frequency>(Frequency.MONTHLY);
  const [customInterval, setCustomInterval] = useState<number>(3);
  const [target, setTarget] = useState(1);
  const [unit, setUnit] = useState('');
  const [deadlineDay, setDeadlineDay] = useState<string>('');
  const [deadlineMonth, setDeadlineMonth] = useState<string>('');
  
  // Group Suggestion State
  const [isGroupFocused, setIsGroupFocused] = useState(false);
  
  // Limit State
  const [useLimit, setUseLimit] = useState(false);
  const [limitPeriod, setLimitPeriod] = useState<LimitPeriod>(LimitPeriod.DAILY);
  const [limitCount, setLimitCount] = useState<number>(1);

  // Push Notification State
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushAdvanceDays, setPushAdvanceDays] = useState<number[]>([]);

  useEffect(() => {
      if (isOpen) {
          if (initialData) {
              setMode('MANUAL');
              setTitle(initialData.title);
              setGroup(initialData.group || '默认');
              setType(initialData.type);
              setFrequency(initialData.frequency);
              setCustomInterval(initialData.customInterval || 3);
              setTarget(initialData.targetValue);
              setUnit(initialData.unit || '');
              setDeadlineDay(initialData.deadlineDay ? String(initialData.deadlineDay) : '');
              setDeadlineMonth(initialData.deadlineMonth ? String(initialData.deadlineMonth) : '');
              
              if (initialData.limitConfig) {
                  setUseLimit(true);
                  setLimitPeriod(initialData.limitConfig.period);
                  setLimitCount(initialData.limitConfig.count);
              } else {
                  setUseLimit(false);
              }

              if (initialData.pushConfig) {
                  setPushEnabled(initialData.pushConfig.enabled);
                  setPushAdvanceDays(initialData.pushConfig.advanceDays);
              } else {
                  setPushEnabled(false);
                  setPushAdvanceDays([]);
              }
          } else {
              // Reset defaults for New Task
              setMode('AI');
              setTitle('');
              setGroup(defaultGroup || '默认');
              setType(TaskType.BOOLEAN);
              setFrequency(Frequency.MONTHLY);
              setTarget(1);
              setUnit('');
              setDeadlineDay('');
              setDeadlineMonth('');
              setUseLimit(false);
              setPushEnabled(false);
              setPushAdvanceDays([]);
          }
      }
  }, [isOpen, initialData, defaultGroup]);

  if (!isOpen) return null;

  const handleAiSubmit = async () => {
    if (!aiInput.trim()) return;
    setLoading(true);
    try {
      const result = await parseTaskWithGemini(aiInput);
      if (result) {
        onAdd({
            ...result,
            group: defaultGroup || result.group || '默认' // Prefer current folder if parsed group is generic
        });
        onClose();
        setAiInput('');
      } else {
        alert("抱歉，我没能理解这个任务。请尝试手动输入。");
      }
    } catch (e) {
        console.error(e);
        alert("AI 处理失败，请检查网络或 API 设置。");
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: CreateTaskPayload = {
      title,
      group,
      type,
      frequency,
      customInterval: frequency === Frequency.CUSTOM ? customInterval : undefined,
      targetValue: type === TaskType.BOOLEAN ? 1 : target,
      unit: type === TaskType.BOOLEAN ? '' : unit,
      deadlineDay: deadlineDay ? parseInt(deadlineDay) : undefined,
      deadlineMonth: deadlineMonth ? parseInt(deadlineMonth) : undefined,
      limitConfig: useLimit ? { period: limitPeriod, count: limitCount } : undefined,
      pushConfig: pushEnabled ? {
          enabled: true,
          advanceDays: pushAdvanceDays,
          notifyOnDueDate: true // Always notify on due date if enabled
      } : undefined
    };

    if (initialData && onEdit) {
        onEdit(initialData.id, payload);
    } else {
        onAdd(payload);
    }
    onClose();
  };

  const toggleAdvanceDay = (day: number) => {
      setPushAdvanceDays(prev => 
          prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
      );
  };

  const filteredGroups = existingGroups.filter(g => 
      !group || g.toLowerCase().includes(group.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/30 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white/50 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-800">{initialData ? '编辑任务' : '新建任务'}</h2>
          <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 p-2 rounded-full text-gray-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
            {/* Tabs - Only show AI in Add Mode */}
            {!initialData && (
                <div className="flex bg-gray-100 p-1.5 rounded-xl mb-6">
                    <button 
                        onClick={() => setMode('AI')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${mode === 'AI' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Sparkles size={16} />
                        智能识别
                    </button>
                    <button 
                        onClick={() => setMode('MANUAL')}
                        className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${mode === 'MANUAL' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        手动录入
                    </button>
                </div>
            )}

            {mode === 'AI' ? (
                <div className="space-y-4">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-2xl text-sm text-blue-800 border border-blue-100">
                        <p className="font-medium mb-2">用一句话描述你的任务，我会自动设置参数。</p>
                        <ul className="space-y-1 text-blue-700/70 text-xs">
                            <li>• "每月打卡10天" (隐含每日限一次)</li>
                            <li>• "每年体检1次，每月存500元"</li>
                            <li>• "每季度第一天提醒我交房租"</li>
                        </ul>
                    </div>
                    <textarea 
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        className="w-full p-4 border border-gray-200 bg-gray-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all h-32 resize-none text-gray-700 placeholder-gray-400"
                        placeholder="例如：每3天跑步5公里..."
                    />
                    <button 
                        onClick={handleAiSubmit}
                        disabled={loading || !aiInput.trim()}
                        className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
                        生成任务
                    </button>
                </div>
            ) : (
                <form onSubmit={handleManualSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">标题</label>
                        <input 
                            required
                            value={title}
                            placeholder="任务名称"
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition-all" 
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">分组 (文件夹)</label>
                        <div className="relative group-dropdown-container">
                            <Tag className="absolute left-3 top-3.5 text-gray-400" size={16} />
                            <input 
                                value={group}
                                placeholder="输入名称创建新分组..."
                                onChange={(e) => setGroup(e.target.value)}
                                onFocus={() => setIsGroupFocused(true)}
                                onBlur={() => setTimeout(() => setIsGroupFocused(false), 200)}
                                className="w-full pl-10 pr-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                            />
                            <ChevronDown className={`absolute right-3 top-3.5 text-gray-400 pointer-events-none transition-transform ${isGroupFocused ? 'rotate-180' : ''}`} size={16} />
                            
                            {/* Group Suggestions Dropdown */}
                            {isGroupFocused && filteredGroups.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto z-30 scrollbar-hide animate-in fade-in slide-in-from-top-1">
                                    {filteredGroups.map(g => (
                                        <div
                                            key={g}
                                            onMouseDown={() => setGroup(g)} // Use onMouseDown to fire before input blur
                                            className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center justify-between cursor-pointer border-b border-gray-50 last:border-0"
                                        >
                                            {g}
                                            {g === group && <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">频率</label>
                             <select 
                                value={frequency} 
                                onChange={(e) => setFrequency(e.target.value as Frequency)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                            >
                                <option value={Frequency.DAILY}>每天</option>
                                <option value={Frequency.WEEKLY}>每周</option>
                                <option value={Frequency.MONTHLY}>每月</option>
                                <option value={Frequency.QUARTERLY}>每季度</option>
                                <option value={Frequency.YEARLY}>每年</option>
                                <option value={Frequency.CUSTOM}>自定义天数</option>
                             </select>
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">类型</label>
                             <select 
                                value={type} 
                                onChange={(e) => setType(e.target.value as TaskType)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                            >
                                <option value={TaskType.BOOLEAN}>打卡 (是/否)</option>
                                <option value={TaskType.NUMERIC}>进度 (数值)</option>
                             </select>
                        </div>
                    </div>

                    {frequency === Frequency.CUSTOM && (
                        <div>
                             <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">间隔天数</label>
                             <input 
                                type="number"
                                min="1"
                                value={customInterval} 
                                onChange={(e) => setCustomInterval(parseInt(e.target.value))}
                                placeholder="每几天执行一次?"
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                    )}

                    {/* Deadline Inputs */}
                    <div>
                         <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">提醒/截止日 (选填)</label>
                         <div className="flex gap-2">
                            {(frequency === Frequency.YEARLY) && (
                                <input 
                                    type="number"
                                    min="1" max="12"
                                    value={deadlineMonth} 
                                    onChange={(e) => setDeadlineMonth(e.target.value)}
                                    placeholder="月份 (1-12)"
                                    className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            )}
                            
                            {(frequency === Frequency.WEEKLY || frequency === Frequency.MONTHLY || frequency === Frequency.YEARLY) && (
                                <input 
                                    type="number"
                                    min="1"
                                    max="31"
                                    value={deadlineDay} 
                                    onChange={(e) => setDeadlineDay(e.target.value)}
                                    placeholder={frequency === Frequency.WEEKLY ? "1 (周一) - 7 (周日)" : "日期 (例如: 15)"}
                                    className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            )}
                         </div>
                    </div>

                    {/* Advanced Limits */}
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                         <div className="flex items-center justify-between mb-2">
                            <label className="flex items-center gap-2 text-xs font-bold text-orange-600 uppercase">
                                <ShieldAlert size={12} />
                                频率限制
                            </label>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={useLimit} onChange={(e) => setUseLimit(e.target.checked)} className="sr-only peer" />
                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                            </label>
                         </div>
                         
                         {useLimit && (
                             <div className="flex gap-2 items-center mt-2 animate-in slide-in-from-top-1">
                                 <span className="text-sm text-gray-600">限制</span>
                                 <select 
                                    value={limitPeriod}
                                    onChange={(e) => setLimitPeriod(e.target.value as LimitPeriod)}
                                    className="p-2 bg-white border border-orange-200 rounded-lg text-sm"
                                 >
                                     <option value={LimitPeriod.DAILY}>每天</option>
                                     <option value={LimitPeriod.WEEKLY}>每周</option>
                                     <option value={LimitPeriod.MONTHLY}>每月</option>
                                 </select>
                                 <span className="text-sm text-gray-600">最多</span>
                                 <input 
                                    type="number" 
                                    min="1"
                                    value={limitCount}
                                    onChange={(e) => setLimitCount(parseInt(e.target.value))}
                                    className="w-16 p-2 bg-white border border-orange-200 rounded-lg text-sm text-center"
                                 />
                                 <span className="text-sm text-gray-600">次有效</span>
                             </div>
                         )}
                    </div>

                    {/* Push Notifications */}
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                         <div className="flex items-center justify-between mb-2">
                            <label className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase">
                                <Bell size={12} />
                                微信推送
                            </label>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={pushEnabled} onChange={(e) => setPushEnabled(e.target.checked)} className="sr-only peer" />
                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                            </label>
                         </div>
                         
                         {pushEnabled && (
                             <div className="mt-3 animate-in slide-in-from-top-1">
                                 <p className="text-[10px] text-blue-400 mb-2">提前推送天数 (当天默认推送):</p>
                                 <div className="flex gap-2">
                                     {[1, 3, 5, 7].map(d => (
                                         <button
                                            type="button"
                                            key={d}
                                            onClick={() => toggleAdvanceDay(d)}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all
                                                ${pushAdvanceDays.includes(d) 
                                                    ? 'bg-blue-500 text-white border-blue-500 shadow-sm' 
                                                    : 'bg-white text-gray-500 border-blue-200 hover:bg-blue-50'}
                                            `}
                                         >
                                             {d}天
                                         </button>
                                     ))}
                                 </div>
                             </div>
                         )}
                    </div>

                    {type === TaskType.NUMERIC && (
                        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <div className="col-span-2 text-xs font-bold text-gray-400 uppercase">目标设定</div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">目标数值</label>
                                <input 
                                    type="number"
                                    required
                                    value={target}
                                    onChange={(e) => setTarget(parseFloat(e.target.value))}
                                    className="w-full p-2 bg-white border border-gray-200 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">单位</label>
                                <input 
                                    value={unit}
                                    placeholder="元, 次, km"
                                    onChange={(e) => setUnit(e.target.value)}
                                    className="w-full p-2 bg-white border border-gray-200 rounded-lg"
                                />
                            </div>
                        </div>
                    )}

                    <button 
                        type="submit"
                        className="w-full py-3.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200"
                    >
                        {initialData ? '保存修改' : '创建任务'}
                    </button>
                </form>
            )}
        </div>
      </div>
    </div>
  );
};