import React, { ChangeEvent } from 'react';
import { Handle, Position, NodeProps, Node as RFNode } from '@xyflow/react';
import { CourseNodeData } from '../../../types/flow';

const CourseNode = ({ data, selected, dragging }: NodeProps<RFNode<CourseNodeData, 'course'>>) => {
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

  // Get the prerequisite status
  const prerequisitesMet = data.prerequisitesMet;

  return (
    <div 
      dir="rtl"
      className={`course-node relative shadow-md p-3 pl-4 pr-4 border rounded-lg !bg-white w-[240px] h-[120px] 
                  dark:!bg-gray-800 dark:!border-gray-700 
                  ${selected ? '!border-blue-500 ring-2 ring-blue-500' : '!border-gray-300 dark:!border-gray-600'}
                  ${dragging ? 'opacity-70' : ''}
                  ${prerequisitesMet === false ? '!border-red-500 dark:!border-red-400 ring-1 ring-red-500 dark:ring-red-400' : ''}
                  flex flex-col justify-between`}
    >
      {/* Top Section: Original structure for course info and remove button */}
      <div> 
        {data.onRemoveCourse && (
          <button 
            onClick={handleRemoveClick} 
            onMouseDown={onInputMouseDown} 
            className="absolute top-1 left-1 p-0.5 rounded-full !text-gray-400 hover:!bg-red-100 hover:!text-red-600 dark:hover:!bg-red-700 dark:hover:!text-red-200 transition-colors"
            aria-label="הסר קורס"
            title="הסר קורס"
          >
            {/* Original SVG Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <div className="font-bold text-sm !text-gray-900 dark:!text-gray-100 mb-1 truncate" title={data.label}>{data.label}</div>
        <div className="text-xs !text-gray-700 dark:!text-gray-300">מספר קורס: {data.courseId}</div>
        <div className="text-xs !text-gray-700 dark:!text-gray-300">נק"ז: {data.credits}</div>

        {prerequisitesMet === false && (
          <div className="absolute bottom-1 left-1 text-red-500 dark:text-red-400" title="אחד או יותר מהקריטריונים המקדימים אינם מתקיימים">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        )}
      </div>
      
      {/* Bottom Section: Grade Input */}
      <div className="pt-1 border-t !border-gray-200 dark:!border-gray-700 flex items-center" onMouseDown={onInputMouseDown}>
        <label htmlFor={`grade-${data.courseId}`} className="text-xs !text-gray-500 dark:!text-gray-400">ציון:</label>
        <input 
          type="text" 
          id={`grade-${data.courseId}`} 
          defaultValue={data.grade || ''} 
          onChange={handleGradeInputChange}
          className="w-16 p-1 text-xs border !border-gray-300 dark:!border-gray-600 rounded !bg-gray-50 dark:!bg-gray-700 !text-gray-900 dark:!text-gray-200 focus:ring-1 focus:ring-blue-500 outline-none mr-2"
        />
      </div>

      {/* Handles need to be outside the flex container for absolute positioning relative to the node */}
      <Handle type="target" position={Position.Right} className="!bg-teal-500 w-2.5 h-2.5 rounded-full" />
      <Handle type="source" position={Position.Left} className="!bg-rose-500 w-2.5 h-2.5 rounded-full" />
    </div>
  );
};

export default CourseNode;
