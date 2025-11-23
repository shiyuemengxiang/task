import React, { useState } from 'react';
import { Task, Frequency, TaskType } from '../types';
import { ChevronLeft, ChevronRight, X, Calendar, CheckCircle2, Circle, Tag } from 'lucide-react';

interface CalendarViewProps {
  tasks: Task[];
}

interface SelectedDayState {
    date: Date;
    tasks: Task[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({ tasks }) => {
  const now = new Date();
  const [currentMonth, setCurrentMonth] = React.useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<SelectedDayState | null>(null);

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay(); // 0 = Sun
  const startingEmptyDays = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Make Mon = 0

  // Check if the view is in a future month relative to today
  const viewMonthIndex = currentMonth.getFullYear() * 12 + currentMonth.getMonth();
  const currentMonthIndex = now.getFullYear() * 12 + now.getMonth();
  const isFutureMonth = viewMonthIndex > currentMonthIndex;

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const getTasksForDay = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const weekDay = date.getDay() === 0 ? 7 : date.getDay(); // 1-7 (Mon-Sun)
    
    return tasks.filter(t => {
        // Daily tasks happen every day
        if (t.frequency === Frequency.DAILY) return true;

        // Weekly tasks
        if (t.frequency === Frequency.WEEKLY) {
            const targetDay = t.deadlineDay || 7; // Default to Sunday if no deadline
            return targetDay === weekDay;
        }

        // Monthly tasks
        if (t.frequency === Frequency.MONTHLY) {
            const targetDate = t.deadlineDay || 1; // Default to 1st if no deadline
            // Handle end of month overflow (e.g. 31st in Feb)
            const maxDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
            const effectiveTarget = Math.min(targetDate, maxDay);
            return day === effectiveTarget;
        }
        
        // Yearly tasks
        if (t.frequency === Frequency.YEARLY) {
             const targetMonth = t.deadlineMonth || 1;
             const targetDate = t.deadlineDay || 1;
             return (currentMonth.getMonth() + 1) === targetMonth && day === targetDate;
        }

        return false;
    });
  };

  const handleDayClick = (day: number, dayTasks: Task[]) => {
      if (dayTasks.length === 0) return;
      setSelectedDay({
          date: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day),
          tasks: dayTasks
      });
  };

  const isTaskDone = (t: Task) => {
      if (isFutureMonth) return false; // Future months always pending
      return t.currentValue >= t.targetValue;
  };

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: startingEmptyDays }, (_, i) => i);

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 animate-in fade-in zoom-in-95 duration-300 relative">
      <div className="flex justify-between items-center mb-6">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <h2 className="text-lg font-bold text-gray-800">
            {currentMonth.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}
        </h2>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronRight size={20} className="text-gray-600" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2 text-center">
        {['一', '二', '三', '四', '五', '六', '日'].map(d => (
            <div key={d} className="text-xs font-bold text-gray-400 py-2">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {blanks.map(b => <div key={`blank-${b}`} className="aspect-square"></div>)}
        {days.map(day => {
            const dayTasks = getTasksForDay(day);
            const count = dayTasks.length;
            const isToday = 
                day === now.getDate() && 
                currentMonth.getMonth() === now.getMonth() && 
                currentMonth.getFullYear() === now.getFullYear();
            
            const pendingCount = dayTasks.filter(t => !isTaskDone(t)).length;
            const completedCount = count - pendingCount;

            return (
                <div 
                    key={day} 
                    onClick={() => handleDayClick(day, dayTasks)}
                    className={`aspect-square rounded-xl border flex flex-col items-center justify-center relative transition-all
                        ${isToday 
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-105 z-10' 
                            : count > 0 
                                ? 'bg-white border-gray-100 text-gray-700 hover:border-blue-200 cursor-pointer active:scale-95'
                                : 'bg-white border-transparent text-gray-300'
                        }
                    `}
                >
                    <span className={`text-xs font-bold ${isToday ? 'opacity-100' : 'opacity-70'}`}>{day}</span>
                    {count > 0 && (
                        <div className="flex gap-0.5 mt-1">
                           {pendingCount > 0 && (
                               <span className={`h-1.5 w-1.5 rounded-full ${isToday ? 'bg-white' : 'bg-orange-400'}`}></span>
                           )} 
                           {completedCount > 0 && (
                               <span className={`h-1.5 w-1.5 rounded-full ${isToday ? 'bg-blue-300' : 'bg-green-400'}`}></span>
                           )}
                        </div>
                    )}
                    {count > 0 && (
                        <span className={`absolute -top-1 -right-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full border
                            ${isToday ? 'bg-white text-blue-600 border-white' : 'bg-gray-100 text-gray-500 border-gray-200'}
                        `}>
                            {count}
                        </span>
                    )}
                </div>
            );
        })}
      </div>
      <div className="mt-4 flex gap-4 justify-center text-[10px] text-gray-400">
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400"></span> 待办任务</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400"></span> 已完成</div>
      </div>

      {/* Modal for Day Details */}
      {selectedDay && (
          <div className="absolute inset-0 z-20 flex items-end sm:items-center justify-center pointer-events-none">
              <div 
                className="absolute inset-0 bg-black/10 backdrop-blur-[1px] rounded-3xl pointer-events-auto"
                onClick={() => setSelectedDay(null)}
              ></div>
              <div className="bg-white w-full m-4 p-4 rounded-2xl shadow-xl border border-gray-100 animate-in slide-in-from-bottom-4 pointer-events-auto max-h-[300px] flex flex-col">
                  <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-50">
                      <div className="flex items-center gap-2 text-blue-600">
                          <Calendar size={18} />
                          <span className="font-bold text-sm">
                              {selectedDay.date.getMonth() + 1}月{selectedDay.date.getDate()}日
                          </span>
                      </div>
                      <button 
                        onClick={() => setSelectedDay(null)}
                        className="p-1 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-full"
                      >
                          <X size={16} />
                      </button>
                  </div>
                  
                  <div className="overflow-y-auto scrollbar-hide space-y-4">
                      {/* Pending List */}
                      {selectedDay.tasks.filter(t => !isTaskDone(t)).length > 0 && (
                          <div>
                              <h4 className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                  <Circle size={10} /> 待办事项
                              </h4>
                              <div className="space-y-2">
                                  {selectedDay.tasks.filter(t => !isTaskDone(t)).map(task => (
                                      <div key={task.id} className="flex items-center justify-between p-2 rounded-lg bg-orange-50 border border-orange-100">
                                          <div className="flex flex-col">
                                              <span className="text-xs font-bold text-gray-700">{task.title}</span>
                                              <div className="flex items-center gap-1 mt-0.5">
                                                  {task.group && (
                                                      <span className="text-[8px] px-1.5 py-0.5 bg-white rounded text-gray-400 flex items-center gap-0.5">
                                                          <Tag size={8} /> {task.group}
                                                      </span>
                                                  )}
                                                  {task.type === TaskType.NUMERIC && (
                                                      <span className="text-[9px] text-orange-600">
                                                          目标: {task.targetValue} {task.unit}
                                                      </span>
                                                  )}
                                              </div>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}

                      {/* Completed List */}
                      {selectedDay.tasks.filter(t => isTaskDone(t)).length > 0 && (
                          <div>
                              <h4 className="text-[10px] font-bold text-green-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                  <CheckCircle2 size={10} /> 已完成
                              </h4>
                              <div className="space-y-2">
                                  {selectedDay.tasks.filter(t => isTaskDone(t)).map(task => (
                                      <div key={task.id} className="flex items-center justify-between p-2 rounded-lg bg-green-50 border border-green-100 opacity-80">
                                           <div className="flex flex-col">
                                              <span className="text-xs font-bold text-gray-600 line-through decoration-gray-400">{task.title}</span>
                                          </div>
                                          <CheckCircle2 size={14} className="text-green-500" />
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
