import React from 'react';
import { NodeProps, Node as RFNode } from '@xyflow/react';
import { SemesterTitleNodeData } from '../../../types/flow';

const SemesterTitleNode: React.FC<NodeProps<RFNode<SemesterTitleNodeData, 'semesterTitle'>>> = ({ data }) => {
  return (
    <div 
      dir="rtl"
      className="semester-title-node p-1 w-[240px] !text-lg font-semibold !text-gray-700 dark:!text-gray-200 text-center select-none pointer-events-none"
    >
      {data.title}
    </div>
  );
};

export default SemesterTitleNode;   