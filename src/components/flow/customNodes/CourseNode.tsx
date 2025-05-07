import React, { ChangeEvent } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { CourseDisplayNode, CourseNodeData } from '../../../types/flow'; // Adjusted import path

const CourseNode = ({ data, selected, dragging }: NodeProps<CourseDisplayNode>) => {
  const handleGradeInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (data.onGradeChange) {
      data.onGradeChange(data.courseId, event.target.value);
    }
  };

  const handleRemoveClick = () => {
    if (data.onRemoveCourse) {
      data.onRemoveCourse(data.courseId);
    }
  };

  // Prevent node drag when interacting with input fields
  const onInputMouseDown = (event: React.MouseEvent<HTMLDivElement | HTMLInputElement | HTMLButtonElement>) => {
    event.stopPropagation();
  };

  return (
    <div 
      className={`course-node relative shadow-md p-3 pr-8 border rounded-lg bg-white min-w-[180px] 
                  dark:bg-gray-800 dark:border-gray-700 
                  ${selected ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-300 dark:border-gray-600'}
                  ${dragging ? 'opacity-70' : ''}`}>
      {/* Remove Button */}      
      {data.onRemoveCourse && (
        <button 
          onClick={handleRemoveClick}
          onMouseDown={onInputMouseDown} // Prevent drag when clicking button
          className="absolute top-1 right-1 p-0.5 rounded-full text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-700 dark:hover:text-red-200 transition-colors"
          aria-label="Remove course"
        >
          {/* Simple X icon */} 
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <Handle type="target" position={Position.Right} className="!bg-teal-500 w-2.5 h-2.5 rounded-full" />
      <div className="font-bold text-sm text-gray-900 dark:text-gray-100 mb-1">{data.label}</div>
      <div className="text-xs text-gray-700 dark:text-gray-300">ID: {data.courseId}</div>
      <div className="text-xs text-gray-700 dark:text-gray-300 mb-2">Credits: {data.credits}</div>
      
      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700" onMouseDown={onInputMouseDown}>
        <label htmlFor={`grade-${data.courseId}`} className="text-xs text-gray-500 dark:text-gray-400 mr-1">Grade:</label>
        <input 
          type="text" 
          id={`grade-${data.courseId}`} 
          defaultValue={data.grade || ''} 
          onChange={handleGradeInputChange}
          className="w-16 p-1 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </div>
      <Handle type="source" position={Position.Left} className="!bg-rose-500 w-2.5 h-2.5 rounded-full" />
    </div>
  );
};

export default CourseNode;
