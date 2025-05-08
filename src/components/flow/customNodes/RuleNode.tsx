import React from 'react';
import { NodeProps, Node as RFNode } from '@xyflow/react'; // No Handles needed for rule nodes if they are informational
import { RuleNodeData } from '../../../types/flow'; // Adjusted import path, removed RuleNodeData import

const RuleNode: React.FC<NodeProps<RFNode<RuleNodeData, 'rule'>>> = ({ data }) => {
  const isSatisfied = data.isSatisfied;
  const statusColor = isSatisfied 
    ? '!bg-green-100 dark:!bg-green-800 !border-green-600 dark:!border-green-700'
    : '!bg-amber-100 dark:!bg-amber-800 !border-amber-500 dark:!border-amber-700';
  const textColor = isSatisfied 
    ? '!text-green-700 dark:!text-green-200' 
    : '!text-amber-700 dark:!text-amber-200';
  const description = data.description;
  const currentProgress = data.currentProgress; // Overall text progress (e.g., joined string)
  const listDetails = data.listProgressDetails;

  // Check for single progress bar
  const showSingleProgressBar = typeof data.currentValue === 'number' && typeof data.requiredValue === 'number' && data.requiredValue > 0;
  // Ensure values are treated as numbers for calculation, defaulting to 0 if check failed (though showProgressBar would be false)
  const currentValNum = typeof data.currentValue === 'number' ? data.currentValue : 0;
  const requiredValNum = typeof data.requiredValue === 'number' && data.requiredValue > 0 ? data.requiredValue : 1; // Avoid division by zero
  const singleProgressPercent = showSingleProgressBar ? Math.min(100, Math.max(0, (currentValNum / requiredValNum) * 100)) : 0;

  const handleEdit = () => {
    if (data.onEditRule) {
      data.onEditRule(data.id);
    }
  };

  const handleDelete = () => {
    if (data.onDeleteRule) {
      // Optional: Add a confirmation dialog here
      data.onDeleteRule(data.id);
    }
  };

  return (
    <div dir="rtl" className={`rule-node p-3 border-r-4 rounded-md shadow-lg w-[240px] h-auto min-h-[120px] ${statusColor} flex flex-col justify-between`}> {/* Changed justify-center to justify-between */}
      <div> {/* Added a wrapper div for main content */}
        <div className={`font-semibold text-md mb-1 ${textColor}`}>{description}</div>
        
        {/* Display either single progress bar or list details */} 
        {showSingleProgressBar && (
          <>
            <div className={`text-sm mb-1 ${textColor}`}>התקדמות: {currentProgress}</div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 my-1">
              <div 
                className={`h-2.5 rounded-full ${isSatisfied ? 'bg-green-500' : 'bg-amber-500'}`}
                style={{ width: `${singleProgressPercent}%` }}
              ></div>
            </div>
          </>
        )}

        {listDetails && listDetails.length > 0 && (
          <div className="text-xs mt-1 space-y-1"> {/* Increased spacing slightly */} 
            <div className={`font-medium mb-0.5 ${textColor}`}>התקדמות לפי רשימה:</div>
            {listDetails.map((item, index) => {
              // Calculate individual list progress
              const itemShowBar = typeof item.currentValue === 'number' && typeof item.requiredValue === 'number' && item.requiredValue > 0;
              const itemCurrentVal = itemShowBar ? item.currentValue : 0;
              const itemRequiredVal = itemShowBar ? item.requiredValue : 1;
              const itemPercent = itemShowBar ? Math.min(100, Math.max(0, (itemCurrentVal / itemRequiredVal) * 100)) : 0;
              
              return (
                <div key={index} className={`flex items-center justify-between ${item.isSatisfied ? '!text-green-600 dark:!text-green-300' : textColor}`}> 
                  <span>{item.listName}: {item.currentValue}/{item.requiredValue}</span>
                  {/* Mini Progress Bar */} 
                  {itemShowBar && (
                    <div className="w-1/3 bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 ml-2"> {/* Adjusted width/height/margin */} 
                      <div 
                        className={`h-1.5 rounded-full ${item.isSatisfied ? 'bg-green-500' : 'bg-amber-500'}`}
                        style={{ width: `${itemPercent}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit and Delete Buttons */}
      {(data.onEditRule || data.onDeleteRule) && (
        <div className="flex justify-end space-x-2 mt-2">
          {data.onEditRule && (
            <button 
              onClick={handleEdit} 
              className="text-xs px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded"
              aria-label="Edit rule"
            >
              ערוך
            </button>
          )}
          {data.onDeleteRule && (
            <button 
              onClick={handleDelete}
              className="text-xs px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded"
              aria-label="Delete rule"
            >
              מחק
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default RuleNode; 