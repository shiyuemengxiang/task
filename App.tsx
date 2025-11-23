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
import { ChevronLeft, Infinity, Loader2, ListFilter, CheckCircle2, Circle } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

type TaskFilterStatus = 'ALL' | 'PENDING' | 'COMPLETED';

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groupOrder, setGroupOrder] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('TASKS');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  
  // Tab/Filter State for within a Folder
  const [taskFilter, setTaskFilter] = useState<TaskFilterStatus>('ALL');

  // Async function to load tasks
  const refreshTasks = async () => {
    setLoading(true);
    const { tasks: loadedTasks, groupOrder: loadedOrder } = await loadTasks();
    setTasks(loadedTasks);
    setGroupOrder(loadedOrder);
    setLoading(false);
  };

  // Load tasks on mount
  useEffect(() => {
    refreshTasks();
    
    // Initial webhook check
    const runPushCheck = async () => {
        const { tasks: loaded } = await loadTasks();
        if (loaded.length > 0) {
            const updatedTasks = await checkAndNotifyTasks(loaded);
            const hasChanges = updatedTasks.some((t, i) => t.pushConfig?.lastPushDate !== loaded[i].pushConfig?.lastPushDate);
            if (hasChanges) {
                setTasks(updatedTasks);
                saveTasks(updatedTasks, groupOrder);
            }
        }
    };
    setTimeout(runPushCheck, 3000);
  }, []);

  // Persist tasks whenever they change (debounce could be added here in a real app)
  useEffect(() => {
    if (!loading) {
        saveTasks(tasks, groupOrder);
    }
  }, [tasks, groupOrder, loading]);

  const addTask = (payload: CreateTaskPayload) => {
    const newTask: Task = {
      id: uuidv4(),
      ...payload,
      group: payload.group || '默认',
      currentValue: 0,
      lastUpdated: new Date().toISOString(),
      history: [],
      activityLog: [],
      sortOrder: Date.now() // New tasks go to the end
    };
    
    setTasks(prev => {
        const newTasks = [...prev, newTask];
        // Ensure new group is added to order if not exists
        if (newTask.group && !groupOrder.includes(newTask.group)) {
            setGroupOrder(current => [...current, newTask.group!]);
        }
        return newTasks;
    });
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
      setTasks(prev => {
          const updated = prev.map(t => {
            if (t.id === id) {
                return {
                    ...t,
                    ...payload,
                    currentValue: (t.type !== payload.type) ? 0 : t.currentValue
                };
            }
            return t;
          });
          
          // Handle group change: if new group doesn't exist in order, add it
          if (payload.group && !groupOrder.includes(payload.group)) {
              setGroupOrder(current => [...current, payload.group!]);
          }
          return updated;
      });
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
      setGroupOrder(prev => prev.map(g => g === oldName ? newName : g));
      if (currentFolder === oldName) setCurrentFolder(newName);
  };

  // --- Derived Data ---

  // 1. Unique Groups (Synced with groupOrder)
  const sortedGroupNames = useMemo(() => {
      const distinctGroups = Array.from(new Set(tasks.map(t => t.group || '未分组')));
      
      // Combine saved order with any new/unsaved groups (appended at end)
      const ordered = [...groupOrder];
      distinctGroups.forEach(g => {
          if (!ordered.includes(g)) ordered.push(g);
      });
      
      // Filter out groups that no longer exist (cleanup)
      return ordered.filter(g => distinctGroups.includes(g));
  }, [tasks, groupOrder]);

  // 2. Grouped Tasks
  const groupedTasks = useMemo(() => {
      const groups: Record<string, Task[]> = {};
      tasks.forEach(t => {
          const g = t.group || '未分组';
          if (!groups[g]) groups[g] = [];
          groups[g].push(t);
      });
      
      // Sort tasks within groups
      Object.keys(groups).forEach(key => {
          groups[key].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      });
      
      return groups;
  }, [tasks]);

  // --- Drag and Drop Logic ---

  const onDragEnd = (result: DropResult) => {
      const { destination, source, type } = result;
      if (!destination) return;
      if (destination.droppableId === source.droppableId && destination.index === source.index) return;

      if (type === 'GROUP') {
          // Reordering Folders
          const newOrder = Array.from(sortedGroupNames);
          const [moved] = newOrder.splice(source.index, 1);
          newOrder.splice(destination.index, 0, moved);
          setGroupOrder(newOrder);
      } else if (type === 'TASK') {
          // Reordering Tasks within a folder
          if (!currentFolder) return;
          
          const currentGroupTasks = [...(groupedTasks[currentFolder] || [])];
          const [movedTask] = currentGroupTasks.splice(source.index, 1);
          currentGroupTasks.splice(destination.index, 0, movedTask);

          // Calculate new sortOrders
          // We map the new visual order to updated sortOrder properties on the original tasks
          // A simple strategy is to re-assign sortOrder based on index * 1000
          const updatedTasksInGroup = currentGroupTasks.map((t, index) => ({
              ...t,
              sortOrder: index * 1000 + Date.now() // Use Date.now to ensure uniqueness if needed, but index is primary
          }));

          setTasks(prev => prev.map(t => {
             const foundUpdate = updatedTasksInGroup.find(ut => ut.id === t.id);
             return foundUpdate || t;
          }));
      }
  };

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
                    onClick={() => { setCurrentFolder(null); setTaskFilter('ALL'); }}
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
                            // --- FOLDER LIST (Groups) ---
                            <div className="space-y-4">
                                {sortedGroupNames.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-24 text-gray-300 space-y-4">
                                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                                            <Infinity size={32} className="text-gray-300" />
                                        </div>
                                        <p className="text-sm">
                                            {tasks.length === 0 ? "点击 + 号创建任务" : "暂无文件夹"}
                                        </p>
                                    </div>
                                ) : (
                                    <DragDropContext onDragEnd={onDragEnd}>
                                        <Droppable droppableId="groups" type="GROUP">
                                            {(provided) => (
                                                <div 
                                                    {...provided.droppableProps} 
                                                    ref={provided.innerRef}
                                                    className="grid grid-cols-1 gap-3 pb-safe-bottom"
                                                >
                                                    {sortedGroupNames.map((groupName, index) => {
                                                        const groupTasks = groupedTasks[groupName] || [];
                                                        const completedCount = groupTasks.filter(t => t.currentValue >= t.targetValue).length;
                                                        const totalCount = groupTasks.length;
                                                        const pendingCount = totalCount - completedCount;
                                                        const groupProgress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

                                                        return (
                                                            <Draggable key={groupName} draggableId={groupName} index={index}>
                                                                {(provided) => (
                                                                    <div
                                                                        ref={provided.innerRef}
                                                                        {...provided.draggableProps}
                                                                    >
                                                                        <FolderCard 
                                                                            groupName={groupName}
                                                                            totalTasks={totalCount}
                                                                            completedTasks={completedCount}
                                                                            pendingTasks={pendingCount}
                                                                            progress={groupProgress}
                                                                            onClick={() => setCurrentFolder(groupName)}
                                                                            onRename={(newName) => renameGroup(groupName, newName)}
                                                                            dragHandleProps={provided.dragHandleProps}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </Draggable>
                                                        );
                                                    })}
                                                    {provided.placeholder}
                                                </div>
                                            )}
                                        </Droppable>
                                    </DragDropContext>
                                )}
                            </div>
                        ) : (
                            // --- TASK LIST (Inside Folder) ---
                            <div className="animate-in slide-in-from-right-4 duration-300">
                                {/* Filter Tabs */}
                                <div className="flex p-1 bg-gray-100 rounded-xl mb-4">
                                    <button 
                                        onClick={() => setTaskFilter('ALL')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-all ${taskFilter === 'ALL' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}
                                    >
                                        <ListFilter size={14} /> 全部
                                    </button>
                                    <button 
                                        onClick={() => setTaskFilter('PENDING')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-all ${taskFilter === 'PENDING' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}
                                    >
                                        <Circle size={14} /> 待办
                                    </button>
                                    <button 
                                        onClick={() => setTaskFilter('COMPLETED')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-all ${taskFilter === 'COMPLETED' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400'}`}
                                    >
                                        <CheckCircle2 size={14} /> 已完
                                    </button>
                                </div>

                                <DragDropContext onDragEnd={onDragEnd}>
                                    <Droppable droppableId="tasks" type="TASK" isDropDisabled={taskFilter !== 'ALL'}>
                                        {(provided) => (
                                            <div 
                                                {...provided.droppableProps} 
                                                ref={provided.innerRef}
                                                className="space-y-3"
                                            >
                                                {(groupedTasks[currentFolder] || [])
                                                    .filter(task => {
                                                        if (taskFilter === 'PENDING') return task.currentValue < task.targetValue;
                                                        if (taskFilter === 'COMPLETED') return task.currentValue >= task.targetValue;
                                                        return true;
                                                    })
                                                    .map((task, index) => (
                                                        <Draggable 
                                                            key={task.id} 
                                                            draggableId={task.id} 
                                                            index={index}
                                                            isDragDisabled={taskFilter !== 'ALL'}
                                                        >
                                                            {(provided, snapshot) => (
                                                                <div
                                                                    ref={provided.innerRef}
                                                                    {...provided.draggableProps}
                                                                    style={{ ...provided.draggableProps.style }}
                                                                >
                                                                    <TaskCard 
                                                                        task={task} 
                                                                        onUpdate={updateTaskValue} 
                                                                        onDelete={deleteTask}
                                                                        onEdit={(t) => {
                                                                            setEditingTask(t);
                                                                            setIsModalOpen(true);
                                                                        }}
                                                                        dragHandleProps={taskFilter === 'ALL' ? provided.dragHandleProps : undefined}
                                                                    />
                                                                </div>
                                                            )}
                                                        </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                </DragDropContext>

                                {(groupedTasks[currentFolder] || []).length === 0 && (
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
            if (tab !== 'TASKS') {
                setCurrentFolder(null);
                setTaskFilter('ALL');
            }
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
        existingGroups={sortedGroupNames}
        defaultGroup={currentFolder}
      />
    </div>
  );
};

export default App;