import React, { ChangeEvent, useState } from 'react';
import { Handle, Position, NodeProps, Node as RFNode } from '@xyflow/react';
import { CourseNodeData } from '../../../types/flow';

const CourseNode = ({ data, selected, dragging }: NodeProps<RFNode<CourseNodeData, 'course'>>) => {
  const [showPrereqTooltip, setShowPrereqTooltip] = useState(false);

  const handleGradeInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    // Allow empty string to clear the grade
    if (value === '') {
      if (data.onGradeChange) {
        data.onGradeChange(data.courseId, '');
      }
      return;
    }

    // Validate the input
    const numValue = parseInt(value, 10);
    if (
      !isNaN(numValue) &&          // Is it a number?
      Number.isInteger(numValue) && // Is it an integer?
      numValue >= 0 &&             // Is it >= 0?
      numValue <= 100              // Is it <= 100?
    ) {
      // Update state only if valid
      if (data.onGradeChange) {
        data.onGradeChange(data.courseId, value); 
      }
    }
    // If not valid, do nothing - the input might show the invalid value temporarily
    // but the state (and thus the weighted average) won't be updated.
    // The min/max attributes should provide visual feedback/constraints in the browser.
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
          <div 
            className="absolute bottom-1 left-1 text-red-500 dark:text-red-400"
            onMouseEnter={() => setShowPrereqTooltip(true)}
            onMouseLeave={() => setShowPrereqTooltip(false)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {showPrereqTooltip && (
              <div 
                className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 min-w-max px-2 py-1 bg-gray-700 text-white text-xs rounded shadow-lg dark:bg-gray-900 dark:text-gray-200 border border-red-500 dark:border-red-400"
                style={{ whiteSpace: 'nowrap' }}
              >
                אחד או יותר מהקריטריונים המקדימים אינם מתקיימים
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Bottom Section: Grade Input & Binary Checkbox */}
      <div className="pt-1 border-t !border-gray-200 dark:!border-gray-700 flex items-center justify-start space-x-2" onMouseDown={onInputMouseDown}>
        {/* Grade Input Section */}
        <div className="flex items-center">
          <label htmlFor={`grade-${data.courseId}`} className="text-xs !text-gray-500 dark:!text-gray-400 ml-1">ציון:</label>
          <input 
            id={`grade-${data.courseId}`}
            type="number"
            value={data.grade || ''}
            onChange={handleGradeInputChange}
            min="0"
            max="100"
            step="1"
            placeholder="--"
            className="nodrag px-1 py-0.5 text-xs w-12 rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:text-gray-400 dark:disabled:text-gray-500"
            aria-label={`ציון עבור ${data.label}`}
            disabled={data.isBinary} // Disable if isBinary is true
          />
        </div>
        {/* Binary Checkbox Section */}
        <div className="flex items-center">
          <input 
            type="checkbox"
            id={`binary-${data.courseId}`}
            checked={!!data.isBinary} // Ensure it's a boolean for the checkbox
            onChange={(e) => data.onBinaryChange && data.onBinaryChange(data.courseId, e.target.checked)}
            className="nodrag w-3 h-3 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 dark:bg-gray-700 mr-2"
          />
          <label htmlFor={`binary-${data.courseId}`} className="mr-1.5 text-xs !text-gray-600 dark:!text-gray-400 select-none">
            פטור/בינארי
          </label>
        </div>
      </div>

      {/* Handles need to be outside the flex container for absolute positioning relative to the node */}
      <Handle type="target" position={Position.Right} className="!bg-teal-500 w-2.5 h-2.5 rounded-full" />
      <Handle type="source" position={Position.Left} className="!bg-rose-500 w-2.5 h-2.5 rounded-full" />
    </div>
  );
};

export default CourseNode;
