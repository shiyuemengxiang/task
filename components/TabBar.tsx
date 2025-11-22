import React from 'react';
import { ListTodo, CalendarDays, User, Plus } from 'lucide-react';

export type TabType = 'TASKS' | 'CALENDAR' | 'ME';

interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onAddClick: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabChange, onAddClick }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 pb-safe-bottom pt-2 z-50">
       <style>
          {`@supports (padding-bottom: env(safe-area-inset-bottom)) { .pb-safe-bottom { padding-bottom: env(safe-area-inset-bottom); } }`}
       </style>
      <div className="flex justify-between items-center h-14 max-w-md mx-auto">
        
        {/* Tasks Tab */}
        <button 
          onClick={() => onTabChange('TASKS')}
          className={`flex flex-col items-center justify-center w-12 gap-1 transition-colors ${activeTab === 'TASKS' ? 'text-blue-600' : 'text-gray-400'}`}
        >
          <ListTodo size={24} strokeWidth={activeTab === 'TASKS' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">清单</span>
        </button>

        {/* Center Add Button (Floating effect) */}
        <button 
          onClick={onAddClick}
          className="flex items-center justify-center w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-200 active:scale-95 transition-transform -mt-6 border-4 border-[#f8fafc]"
        >
          <Plus size={26} />
        </button>

        {/* Calendar Tab */}
        <button 
          onClick={() => onTabChange('CALENDAR')}
          className={`flex flex-col items-center justify-center w-12 gap-1 transition-colors ${activeTab === 'CALENDAR' ? 'text-blue-600' : 'text-gray-400'}`}
        >
          <CalendarDays size={24} strokeWidth={activeTab === 'CALENDAR' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">日历</span>
        </button>
        
        {/* Me Tab */}
        <button 
          onClick={() => onTabChange('ME')}
          className={`flex flex-col items-center justify-center w-12 gap-1 transition-colors ${activeTab === 'ME' ? 'text-blue-600' : 'text-gray-400'}`}
        >
          <User size={24} strokeWidth={activeTab === 'ME' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">我的</span>
        </button>
      </div>
    </div>
  );
};
