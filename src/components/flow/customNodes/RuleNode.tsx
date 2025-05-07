import React from 'react';
import { NodeProps } from '@xyflow/react'; // No Handles needed for rule nodes if they are informational
import { RuleDisplayNode } from '../../../types/flow'; // Adjusted import path, removed RuleNodeData import

const RuleNode: React.FC<NodeProps<RuleDisplayNode>> = ({ data }) => {
  const isSatisfied = data.isSatisfied;
  const statusColor = isSatisfied ? 'bg-green-100 dark:bg-green-800 border-green-600' : 'bg-amber-100 dark:bg-amber-800 border-amber-500';
  const textColor = isSatisfied ? 'text-green-700 dark:text-green-200' : 'text-amber-700 dark:text-amber-200';
  const description = data.description;
  const currentProgress = data.currentProgress;

  return (
    <div className={`rule-node p-4 border-l-4 rounded-md shadow-lg min-w-[250px] ${statusColor} dark:bg-opacity-30`}>
      <div className={`font-semibold text-md mb-2 ${textColor}`}>{description}</div>
      <div className={`text-sm mb-1 ${textColor}`}>Progress: {currentProgress}</div>
      <div className={`text-sm font-medium ${textColor}`}>
        Status: {isSatisfied ? 'Satisfied' : 'Pending'}
      </div>
    </div>
  );
};

export default RuleNode; 