import React, { useState } from 'react';

interface PlanManagementProps {
  onSavePlan: (slotId: number) => void;
  onLoadPlan: (slotId: number) => void;
  // We might need info about which slots are occupied later
}

export const PlanManagement: React.FC<PlanManagementProps> = ({
  onSavePlan,
  onLoadPlan,
}) => {
  const slots = [1, 2, 3];
  const [selectedSlot, setSelectedSlot] = useState<number>(1); // Default to slot 1

  return (
    <div className="fixed bottom-4 right-4 z-50 p-3 bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 rounded-lg shadow-md backdrop-blur-sm flex items-center space-x-2">
      <span className="text-xs font-semibold mr-2 text-gray-700 dark:text-gray-300">חריץ תוכנית:</span>
      <select 
        value={selectedSlot}
        onChange={(e) => setSelectedSlot(parseInt(e.target.value, 10))}
        className="p-1 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-blue-500 outline-none"
      >
        {slots.map(slot => (
          <option key={slot} value={slot}>{slot}</option>
        ))}
      </select>
      <button
        onClick={() => onSavePlan(selectedSlot)}
        className="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
        title={`שמור תוכנית נוכחית לחריץ ${selectedSlot}`}
      >
        שמור
      </button>
      <button
        onClick={() => onLoadPlan(selectedSlot)}
        className="px-3 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors"
        title={`טען תוכנית מחריץ ${selectedSlot}`}
      >
        טען
      </button>
    </div>
  );
}; 