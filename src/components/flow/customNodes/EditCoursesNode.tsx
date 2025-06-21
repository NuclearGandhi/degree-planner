import React from 'react';
import { Handle, Position } from '@xyflow/react';

interface EditCoursesNodeData {
  onEditCourses: () => void;
}

interface EditCoursesNodeProps {
  data: EditCoursesNodeData;
}

const EditCoursesNode: React.FC<EditCoursesNodeProps> = ({ data }) => {
  return (
    <div className="relative">
      <button 
        onClick={data.onEditCourses}
        className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-base font-medium shadow-lg border border-blue-600 min-w-[200px]"
      >
        ערוך רשימות קורסים
      </button>
      {/* Hide connection handles since this is just a UI button */}
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
    </div>
  );
};

export default EditCoursesNode; 