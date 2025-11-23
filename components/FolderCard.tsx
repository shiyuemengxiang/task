import React, { useState } from 'react';
import { Folder, FolderOpen, MoreVertical, Pencil, GripVertical } from 'lucide-react';

interface FolderCardProps {
  groupName: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  progress: number;
  onClick: () => void;
  onRename: (newName: string) => void;
  dragHandleProps?: any;
}

export const FolderCard: React.FC<FolderCardProps> = ({ 
  groupName, 
  totalTasks, 
  completedTasks, 
  pendingTasks,
  progress, 
  onClick,
  onRename,
  dragHandleProps
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(groupName);
  const [showMenu, setShowMenu] = useState(false);

  const handleRenameSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (editName.trim() && editName !== groupName) {
          onRename(editName);
      }
      setIsEditing(false);
      setShowMenu(false);
  };

  return (
    <div 
        className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all cursor-pointer relative group"
        onClick={onClick}
    >
        <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
                 {/* Drag Handle */}
                 {dragHandleProps && (
                    <div 
                        {...dragHandleProps} 
                        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing p-1 -ml-2"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <GripVertical size={20} />
                    </div>
                 )}
                <div className={`p-3 rounded-xl ${progress === 100 ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                    {progress === 100 ? <FolderOpen size={24} /> : <Folder size={24} />}
                </div>
            </div>
            
            <div className="relative" onClick={e => e.stopPropagation()}>
                <button 
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-2 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <MoreVertical size={16} />
                </button>
                
                {showMenu && (
                    <div className="absolute right-0 top-8 bg-white border border-gray-100 shadow-xl rounded-xl py-1 z-10 w-32 animate-in fade-in zoom-in-95 duration-100">
                        <button 
                            onClick={() => { setIsEditing(true); setShowMenu(false); }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                            <Pencil size={12} /> 重命名
                        </button>
                    </div>
                )}
            </div>
        </div>

        {isEditing ? (
            <form onSubmit={handleRenameSubmit} onClick={e => e.stopPropagation()}>
                <input 
                    autoFocus
                    className="w-full font-bold text-lg border-b-2 border-blue-500 outline-none bg-transparent"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={() => setIsEditing(false)}
                />
            </form>
        ) : (
            <h3 className="text-lg font-bold text-gray-800 mb-1 truncate">{groupName}</h3>
        )}

        <p className="text-xs text-gray-400 mb-4">{totalTasks} 个任务 · {pendingTasks} 待办</p>

        <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <span>完成度</span>
                <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div 
                    className={`h-full rounded-full transition-all duration-1000 ${progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    </div>
  );
};