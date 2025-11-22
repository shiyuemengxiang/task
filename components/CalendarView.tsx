import React from 'react';
import { Task, Frequency } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarViewProps {
  tasks: Task[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({ tasks }) => {
  const now = new Date();
  const [currentMonth, setCurrentMonth] = React.useState(new Date(now.getFullYear(), now.getMonth(), 1));

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay(); // 0 = Sun
  const startingEmptyDays = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Make Mon = 0

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

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: startingEmptyDays }, (_, i) => i);

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 animate-in fade-in zoom-in-95 duration-300">
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
            
            // Simplified "Pending" check: just check global status (not accurate for historical dates, but good for current view)
            const pendingCount = dayTasks.filter(t => t.currentValue < t.targetValue).length;

            return (
                <div 
                    key={day} 
                    className={`aspect-square rounded-xl border flex flex-col items-center justify-center relative transition-all
                        ${isToday 
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-105 z-10' 
                            : 'bg-white border-gray-100 text-gray-700 hover:border-blue-200'
                        }
                    `}
                >
                    <span className={`text-xs font-bold ${isToday ? 'opacity-100' : 'opacity-70'}`}>{day}</span>
                    {count > 0 && (
                        <div className="flex gap-0.5 mt-1">
                           {pendingCount > 0 && (
                               <span className={`h-1.5 w-1.5 rounded-full ${isToday ? 'bg-white' : 'bg-orange-400'}`}></span>
                           )} 
                           {count - pendingCount > 0 && (
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
    </div>
  );
};