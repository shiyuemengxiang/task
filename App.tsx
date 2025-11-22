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
import { FolderOpen, ChevronLeft } from 'lucide-react';

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('TASKS');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);

  // Load tasks and initial logic
  useEffect(() => {
    const loaded = loadTasks();
    setTasks(loaded);

    // Webhook Push Notifications Check
    const runPushCheck = async () => {
        if (loaded.length > 0) {
            const updatedTasks = await checkAndNotifyTasks(loaded);
            const hasChanges = updatedTasks.some((t, i) => t.pushConfig?.lastPushDate !== loaded[i].pushConfig?.lastPushDate);
            if (hasChanges) {
                setTasks(updatedTasks);
                saveTasks(updatedTasks);
            }
        }
    };
    setTimeout(runPushCheck, 2000);
  }, []);

  // Persist tasks
  useEffect(() => {
    if (tasks.length > 0) {
      saveTasks(tasks);
    }
  }, [tasks]);

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
          setTasks(prev => {
              const filtered = prev.filter(t => t.id !== id);
              saveTasks(filtered); 
              return filtered;
          });
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

  // Grouping Logic
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
      
      {/* WeChat Style Top Navigation Bar (Simulated) */}
      <div className="w-full bg-white sticky top-0 z-20 border-b border-gray-100 h-11 flex items-center justify-center">
          <span className="font-bold text-gray-900 text-sm">
            {activeTab === 'TASKS' ? (currentFolder || '循环清单') : activeTab === 'CALENDAR' ? '日历' : '个人中心'}
          </span>
      </div>

      {/* Main Content Area - Scrollable */}
      <main className="w-full max-w-md flex-1 overflow-y-auto pb-24">
        
        {/* Tab 1: Tasks / Folders */}
        {activeTab === 'TASKS' && (
            <div className="px-4 pt-4">
                {currentFolder && (
                    <button 
                        onClick={() => setCurrentFolder(null)}
                        className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors"
                    >
                        <ChevronLeft size={16} />
                        返回文件夹
                    </button>
                )}

                {!currentFolder ? (
                    <div className="space-y-4">
                         {Object.keys(groupedTasks).length === 0 ? (
                             <div className="text-center py-20 text-gray-300 text-sm">
                                 点击下方 + 号创建第一个任务
                             </div>
                         ) : (
                            <div className="grid grid-cols-1 gap-3">
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
                    <div className="space-y-3 animate-in slide-in-from-right-4 duration-200">
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
                    </div>
                )}
            </div>
        )}

        {/* Tab 2: Calendar */}
        {activeTab === 'CALENDAR' && (
            <div className="px-4 pt-4">
                <CalendarView tasks={tasks} />
            </div>
        )}

        {/* Tab 3: Me (Settings) */}
        {activeTab === 'ME' && (
            <MinePage />
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
