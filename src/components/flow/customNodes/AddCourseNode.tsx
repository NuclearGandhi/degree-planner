import React from 'react';
import { NodeProps } from '@xyflow/react';
import { AddCourseDisplayNode } from '../../../types/flow'; // Adjusted import path

// AddCourseNodeData is now effectively part of AddCourseDisplayNode, local definition removed.

const AddCourseNode = ({ data, selected }: NodeProps<AddCourseDisplayNode>) => {
  const handleAddClick = () => {
    data.onAddCourse(data.semesterNumber);
  };

  return (
    <button
      onClick={handleAddClick}
      className={`add-course-node p-4 w-[200px] h-[60px] flex items-center justify-center 
                  border-2 border-dashed border-gray-400 dark:border-gray-600 
                  text-gray-500 dark:text-gray-400 
                  hover:border-blue-500 hover:text-blue-500 dark:hover:border-blue-400 dark:hover:text-blue-400
                  rounded-lg transition-colors 
                  ${selected ? 'ring-2 ring-blue-500' : ''}`}
      title={`Add course to semester ${data.semesterNumber}`}
    >
      + Add Course
    </button>
  );
};

export default AddCourseNode; 