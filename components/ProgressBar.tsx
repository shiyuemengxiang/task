import React from 'react';

interface ProgressBarProps {
  current: number;
  target: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ current, target }) => {
  const percentage = Math.min(100, Math.max(0, (current / target) * 100));
  const isCompleted = current >= target;
  
  return (
    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border border-gray-100">
      <div 
        className={`h-full rounded-full transition-all duration-700 ease-out shadow-sm ${
            isCompleted 
            ? 'bg-gradient-to-r from-green-400 to-emerald-500' 
            : 'bg-gradient-to-r from-blue-400 to-indigo-500'
        }`} 
        style={{ width: `${percentage}%` }}
      ></div>
    </div>
  );
};