import React from 'react';
import { NodeProps, Node as RFNode } from '@xyflow/react';
import { SemesterTitleNodeData } from '../../../types/flow';

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
  </svg>
);

const SemesterTitleNode: React.FC<NodeProps<RFNode<SemesterTitleNodeData, 'semesterTitle'>>> = ({ data }) => {
  const handleRemoveClick = () => {
    if (data.onRemoveSemester) {
      data.onRemoveSemester(data.semesterKey);
    }
  };

  return (
    <div 
      dir="rtl"
      className="semester-title-node p-1 w-[240px] !text-lg font-semibold !text-gray-700 dark:!text-gray-200 text-center select-none pointer-events-none relative"
    >
      <div className="flex items-center justify-center">
        <span>{data.title}</span>
        {data.isEmpty && data.onRemoveSemester && (
          <button
            onClick={handleRemoveClick}
            className="pointer-events-auto mr-2 p-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center transition-colors duration-150"
            title={`מחק ${data.title}`}
            aria-label={`מחק ${data.title}`}
          >
            <TrashIcon />
          </button>
        )}
      </div>
    </div>
  );
};

export default SemesterTitleNode;   