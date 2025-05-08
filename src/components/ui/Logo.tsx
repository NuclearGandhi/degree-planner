import React from 'react';

export const Logo: React.FC = () => {
  return (
    <div className="fixed top-4 right-4 z-50 p-3 bg-slate-200 bg-opacity-60 dark:bg-slate-800 dark:bg-opacity-70 rounded-lg shadow-lg flex items-center space-x-3">
      <span className="text-xl font-semibold text-slate-700 dark:text-slate-200">DegreePlanner</span>
      <img src="/assets/icon.png" alt="DegreePlanner Logo" className="h-10 w-10 object-contain" />
      {/* The path /assets/icon.png assumes icon.png is in public/assets */}
    </div>
  );
}; 