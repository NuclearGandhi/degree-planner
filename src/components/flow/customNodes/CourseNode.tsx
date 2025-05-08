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
      onDoubleClick={(event) => { 
        event.stopPropagation(); // Prevent React Flow from handling it (e.g., zoom)
        data.onDoubleClick?.(data.courseId);
      }}
      className={`course-node relative shadow-md p-3 pl-4 pr-4 border rounded-lg !bg-white w-[240px] h-[120px] 
                  dark:!bg-gray-800 dark:!border-gray-700 
                  ${selected ? '!border-blue-500 ring-2 ring-blue-500' : '!border-gray-300 dark:!border-gray-600'}
                  ${dragging ? 'opacity-70' : ''}
                  ${prerequisitesMet === false ? '!border-red-500 dark:!border-red-400 ring-1 ring-red-500 dark:ring-red-400' : ''}
                  flex flex-col justify-between`}
    >
      {/* Top Section: Button, Title, Details, Warning */}
      <div>
        {/* Remove Button */}      
        {data.onRemoveCourse && (
          <button 
            onClick={handleRemoveClick}
            onMouseDown={onInputMouseDown} // Prevent drag when clicking button
            className="absolute top-1 left-1 p-0.5 rounded-full !text-gray-400 hover:!bg-red-100 hover:!text-red-600 dark:hover:!bg-red-700 dark:hover:!text-red-200 transition-colors"
            aria-label="הסר קורס"
          >
            {/* Simple X icon */} 
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Course Info */}
        <div className="font-bold text-sm !text-gray-900 dark:!text-gray-100 mb-1 truncate">{data.label}</div>
        <div className="text-xs !text-gray-700 dark:!text-gray-300">מספר קורס: {data.courseId}</div>
        <div className="text-xs !text-gray-700 dark:!text-gray-300">נקודות זכות: {data.credits}</div>

        {/* Prerequisite Warning */} 
        {prerequisitesMet === false && (
          <div className="text-xs font-semibold !text-red-600 dark:!text-red-400 mt-1">
            חסרים קדמים
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
