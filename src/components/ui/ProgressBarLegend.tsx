import React from 'react';

const ProgressBarLegend: React.FC = () => {
  return (
    <div 
      dir="rtl" 
      className="flex items-center space-x-2 p-1.5 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-md shadow-sm text-xs"
      aria-label="מקרא סרגל התקדמות"
    >
      <span className="font-medium text-gray-700 dark:text-gray-200">מקרא:</span>
      <div className="flex items-center">
        <span className="w-2.5 h-2.5 rounded-xs bg-gray-300 dark:bg-gray-500 ml-1"></span>
        <span className="text-gray-600 dark:text-gray-300">נדרש</span>
      </div>
      <div className="flex items-center">
        <span className="w-2.5 h-2.5 rounded-xs bg-yellow-400 dark:bg-yellow-500 ml-1"></span>
        <span className="text-gray-600 dark:text-gray-300">בתכנון</span>
      </div>
      <div className="flex items-center">
        <span className="w-2.5 h-2.5 rounded-xs bg-green-500 dark:bg-green-600 ml-1"></span>
        <span className="text-gray-600 dark:text-gray-300">בוצע</span>
      </div>
    </div>
  );
};

export default ProgressBarLegend; 