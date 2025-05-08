import React, { useState } from 'react';
import { RawCourseData } from '../../types/data';

interface PrereqCourseIdWithTooltipProps {
  courseId: string;
  allCourses?: RawCourseData[];
}

const PrereqCourseIdWithTooltip: React.FC<PrereqCourseIdWithTooltipProps> = ({ courseId, allCourses }) => {
  const [isHovering, setIsHovering] = useState(false);

  const courseName = allCourses?.find(c => c._id === courseId)?.name;
  const tooltipText = courseName ? `${courseName} (${courseId})` : null; // Only show tooltip if name found

  const handleMouseEnter = () => {
    if (tooltipText) {
      setIsHovering(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  return (
    <span 
      className="relative font-mono bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-sm shadow-sm cursor-default" // Added relative and cursor
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {courseId}
      {isHovering && tooltipText && (
        <div 
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 text-xs font-medium text-white bg-gray-900/90 dark:bg-gray-100/90 dark:text-black rounded-md shadow-lg max-w-xs text-center z-10 transition-opacity duration-100 opacity-100"
        >
          {tooltipText}
          <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900/90 dark:border-t-gray-100/90"></div>
        </div>
      )}
    </span>
  );
};

export default PrereqCourseIdWithTooltip; 