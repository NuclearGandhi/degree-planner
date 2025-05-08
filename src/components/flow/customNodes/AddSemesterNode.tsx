import React from 'react';
import { NodeProps } from '@xyflow/react';
import { AddSemesterDisplayNode } from '../../../types/flow'; // Adjusted import path

const AddSemesterNode = ({ data, selected }: NodeProps<AddSemesterDisplayNode>) => {
  const handleAddClick = () => {
    data.onAddSemester();
  };

  return (
    <button
      onClick={handleAddClick}
      className={`add-semester-node p-6 w-[240px] h-[120px] flex items-center justify-center 
                  border-2 border-dashed !border-green-500 dark:!border-green-700 
                  !text-green-600 dark:!text-green-400 
                  hover:!border-green-600 hover:!text-green-700 dark:hover:!border-green-500 dark:hover:!text-green-300
                  rounded-lg transition-colors !bg-green-50 dark:!bg-green-900 dark:!bg-opacity-30
                  ${selected ? 'ring-2 ring-green-500' : ''}`}
      title="הוסף סמסטר חדש לתוכנית שלך"
    >
      + הוסף סמסטר
    </button>
  );
};

export default AddSemesterNode; 