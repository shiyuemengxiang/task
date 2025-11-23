import React, { useEffect, useState, useMemo } from 'react';
import { Task, CreateTaskPayload } from './types';
import { loadTasks, saveTasks } from './services/taskManager';
import { TaskCard } from './components/TaskCard';
import { SmartAddModal } from './components/SmartAddModal';
import { FolderCard } from './components/FolderCard';
import { CalendarView } from './components/CalendarView';
import { checkAndNotifyTasks } from './services/notificationService';
import { TabBar, TabType } from './components/TabBar';
import { MinePage } from './components/MinePage';
import { v4 as uuidv4 } from 'uuid';
import { ChevronLeft, Infinity, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('TASKS');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);

  // Async function to load tasks
  const refreshTasks = async () => {
    setLoading(true);
    const loaded = await loadTasks();
    setTasks(loaded);
    setLoading(false);
  };

  // Load tasks on mount
  useEffect(() => {
    refreshTasks();
    
    // Initial webhook check (Client side check for immediate feedback, server side Cron also handles this)
    const runPushCheck = async () => {
        const loaded = await loadTasks();
        if (loaded.length > 0) {
            const updatedTasks = await checkAndNotifyTasks(loaded);
            const hasChanges = updatedTasks.some((t, i) => t.pushConfig?.lastPushDate !== loaded[i].pushConfig?.lastPushDate);
            if (hasChanges) {
                setTasks(updatedTasks);
                saveTasks(updatedTasks);
            }
        }
    };
    // Delay slightly to let initial load finish or run in parallel
    setTimeout(runPushCheck, 3000);
  }, []);

  // Persist tasks whenever they change
  // Note: saveTasks is now async, but we don't need to await it here for UI responsiveness
  useEffect(() => {
    if (!loading) {
        saveTasks(tasks);
    }
  }, [tasks, loading]);

  const addTask = (payload: CreateTaskPayload) => {
    const newTask: Task = {
      id: uuidv4(),
      ...payload,
      group: payload.group || '默认',
      currentValue: 0,
      lastUpdated: new Date().toISOString(),
      history: [],
      activityLog: []
    };
    setTasks(prev => [...prev, newTask]);
  };

  const updateTaskValue = (id: string, newValue: number) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const isIncrement = newValue > t.currentValue;
        const updatedLog = isIncrement 
            ? [...(t.activityLog || []), Date.now()] 
            : (t.activityLog || []);
        
        return {
          ...t,
          currentValue: Math.min(Math.max(0, newValue), t.type === 'BOOLEAN' ? 1 : 99999999),
          lastUpdated: new Date().toISOString(),
          activityLog: updatedLog
        };
      }
      return t;
    }));
  };

  const editTask = (id: string, payload: CreateTaskPayload) => {
      setTasks(prev => prev.map(t => {
          if (t.id === id) {
              return {
                  ...t,
                  ...payload,
                  currentValue: (t.type !== payload.type) ? 0 : t.currentValue
              };
          }
          return t;
      }));
  };

  const deleteTask = (id: string) => {
      if(window.confirm("确定要删除这个循环任务吗?")) {
          setTasks(prev => prev.filter(t => t.id !== id));
      }
  }

  const renameGroup = (oldName: string, newName: string) => {
      setTasks(prev => prev.map(t => {
          if (t.group === oldName) {
              return { ...t, group: newName };
          }
          return t;
      }));
      if (currentFolder === oldName) setCurrentFolder(newName);
  };

  const groupedTasks = useMemo(() => {
      const groups: Record<string, Task[]> = {};
      tasks.forEach(t => {
          const g = t.group || '未分组';
          if (!groups[g]) groups[g] = [];
          groups[g].push(t);
      });
      return groups;
  }, [tasks]);

  const uniqueGroups = useMemo(() => {
      const g = new Set<string>();
      tasks.forEach(t => {
          if (t.group) g.add(t.group);
      });
      return Array.from(g).sort();
  }, [tasks]);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center pt-safe-top pl-safe-left pr-safe-right">
      <style>
          {`
            @supports (padding-top: env(safe-area-inset-top)) {
                .pt-safe-top { padding-top: env(safe-area-inset-top); }
                .pl-safe-left { padding-left: env(safe-area-inset-left); }
                .pr-safe-right { padding-right: env(safe-area-inset-right); }
            }
          `}
      </style>
      
      {/* Navbar */}
      <div className="w-full bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-gray-100/50 h-[52px] flex items-center justify-center px-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all">
          {activeTab === 'TASKS' && currentFolder ? (
            <div className="flex items-center w-full relative justify-center animate-in fade-in duration-200">
                <button 
                    onClick={() => setCurrentFolder(null)}
                    className="absolute left-0 p-2 -ml-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100/50 rounded-full transition-all active:scale-90"
                    title="返回"
                >
                    <ChevronLeft size={26} />
                </button>
                <span className="font-bold text-lg text-gray-800 truncate max-w-[60%]">{currentFolder}</span>
            </div>
          ) : (
             <div className="w-full flex items-center justify-center gap-2 animate-in fade-in duration-200">
                 {activeTab === 'TASKS' && <Infinity size={22} className="text-blue-600" strokeWidth={2.5} />}
                 <span className="font-bold text-lg text-gray-800 tracking-wide">
                    {activeTab === 'TASKS' ? '循环清单' : activeTab === 'CALENDAR' ? '日历视图' : '个人中心'}
                 </span>
             </div>
          )}
      </div>

      <main className="w-full max-w-md flex-1 overflow-y-auto pb-24 scrollbar-hide">
        
        {loading && activeTab !== 'ME' ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
                <Loader2 className="animate-spin text-blue-500" size={32} />
                <p className="text-xs">正在同步数据...</p>
            </div>
        ) : (
            <>
                {activeTab === 'TASKS' && (
                    <div className="px-4 pt-4">
                        {!currentFolder ? (
                            <div className="space-y-4">
                                {Object.keys(groupedTasks).length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-24 text-gray-300 space-y-4">
                                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                                            <Infinity size={32} className="text-gray-300" />
                                        </div>
                                        <p className="text-sm">
                                            {tasks.length === 0 ? "点击 + 号创建任务" : "暂无文件夹"}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3 pb-safe-bottom">
                                        {Object.entries(groupedTasks).map(([groupName, groupTasks]) => {
                                            const completedCount = groupTasks.filter(t => t.currentValue >= t.targetValue).length;
                                            const totalCount = groupTasks.length;
                                            const pendingCount = totalCount - completedCount;
                                            const groupProgress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

                                            return (
                                                <FolderCard 
                                                    key={groupName}
                                                    groupName={groupName}
                                                    totalTasks={totalCount}
                                                    completedTasks={completedCount}
                                                    pendingTasks={pendingCount}
                                                    progress={groupProgress}
                                                    onClick={() => setCurrentFolder(groupName)}
                                                    onRename={(newName) => renameGroup(groupName, newName)}
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3 animate-in slide-in-from-right-4 duration-300">
                                {groupedTasks[currentFolder]?.map(task => (
                                    <TaskCard 
                                        key={task.id} 
                                        task={task} 
                                        onUpdate={updateTaskValue} 
                                        onDelete={deleteTask}
                                        onEdit={(t) => {
                                            setEditingTask(t);
                                            setIsModalOpen(true);
                                        }}
                                    />
                                ))}
                                {groupedTasks[currentFolder]?.length === 0 && (
                                    <div className="text-center py-12 text-gray-400 text-xs">
                                        此文件夹暂无任务
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'CALENDAR' && (
                    <div className="px-4 pt-4">
                        <CalendarView tasks={tasks} />
                    </div>
                )}
            </>
        )}

        {activeTab === 'ME' && (
            <MinePage onUserChange={refreshTasks} />
        )}

      </main>

      <TabBar 
        activeTab={activeTab}
        onTabChange={(tab) => {
            setActiveTab(tab);
            if (tab !== 'TASKS') setCurrentFolder(null);
        }}
        onAddClick={() => {
            setEditingTask(undefined);
            setIsModalOpen(true);
        }}
      />

      <SmartAddModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onAdd={addTask} 
        onEdit={editTask}
        initialData={editingTask}
        existingGroups={uniqueGroups}
        defaultGroup={currentFolder}
      />
    </div>
  );
};

export default App;