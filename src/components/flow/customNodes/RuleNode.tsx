import React from 'react';
import { NodeProps } from '@xyflow/react'; // No Handles needed for rule nodes if they are informational
import { RuleDisplayNode } from '../../../types/flow'; // Adjusted import path, removed RuleNodeData import

const RuleNode: React.FC<NodeProps<RuleDisplayNode>> = ({ data }) => {
  const isSatisfied = data.isSatisfied;
  const statusColor = isSatisfied 
    ? '!bg-green-100 dark:!bg-green-800 !border-green-600 dark:!border-green-700'
    : '!bg-amber-100 dark:!bg-amber-800 !border-amber-500 dark:!border-amber-700';
  const textColor = isSatisfied 
    ? '!text-green-700 dark:!text-green-200' 
    : '!text-amber-700 dark:!text-amber-200';
  const description = data.description;
  const currentProgress = data.currentProgress;

  return (
    <div dir="rtl" className={`rule-node p-4 border-r-4 rounded-md shadow-lg w-[240px] h-[120px] ${statusColor} flex flex-col justify-center`}>
      <div className={`font-semibold text-md mb-2 ${textColor}`}>{description}</div>
      <div className={`text-sm mb-1 ${textColor}`}>התקדמות: {currentProgress}</div>
      <div className={`text-sm font-medium ${textColor}`}>
        מצב: {isSatisfied ? 'הושלם' : 'בהמתנה'}
      </div>
    </div>
  );
};

export default RuleNode; 