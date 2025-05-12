import React, { useState, useEffect } from 'react';
import { RawCourseData } from '../../types/data';
import { getEquivalentCourses } from '../../utils/prerequisiteChecker';

interface PrereqCourseIdWithTooltipProps {
  courseId: string;
  allCourses?: RawCourseData[];
  coursesInPlanIds?: Set<string>;
}

const PrereqCourseIdWithTooltip: React.FC<PrereqCourseIdWithTooltipProps> = ({ courseId, allCourses, coursesInPlanIds }) => {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [courseName, setCourseName] = useState<string | null>(null);
  const [isMet, setIsMet] = useState(false);

  useEffect(() => {
    if (allCourses) {
      const foundCourse = allCourses.find(c => c._id === courseId);
      setCourseName(foundCourse ? foundCourse.name : null);

      let met = false;
      if (coursesInPlanIds && courseId) {
        // 1. Check if the prerequisite courseId itself is directly in the plan
        if (coursesInPlanIds.has(courseId)) {
          met = true;
        } else {
          // 2. If not, check if any course *in the plan* covers this prerequisite courseId via no_credit_courses
          for (const takenCourseId of coursesInPlanIds) {
            // It's possible the takenCourseId itself is not in allCourses if it's an old/custom entry.
            // getEquivalentCourses will still return a set containing at least takenCourseId.
            const equivalentsOfTakenCourse = getEquivalentCourses(takenCourseId, allCourses);
            if (equivalentsOfTakenCourse.has(courseId)) {
              met = true;
              break; // Found a course in plan that satisfies this prerequisite
            }
          }
        }
      }
      setIsMet(met);
    }
  }, [courseId, allCourses, coursesInPlanIds]);

  const handleMouseEnter = () => {
    if (courseName) {
      setTooltipVisible(true);
    }
  };

  const handleMouseLeave = () => {
    setTooltipVisible(false);
  };

  const courseDisplayId = courseId;
  // Display only the course ID as the main text
  const displayText = courseDisplayId;
  // Tooltip text includes the name if available
  const tooltipTextContent = courseName ? `${courseName} (${courseDisplayId})` : courseDisplayId;

  // Base styling for the badge
  const baseBadgeStyle = "font-mono bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-sm shadow-sm cursor-pointer relative";
  // Conditional text color
  const conditionalTextStyle = isMet ? 'text-green-700 dark:text-green-400 font-semibold' : 'text-gray-800 dark:text-gray-200';

  return (
    <span 
      className={`${baseBadgeStyle} ${conditionalTextStyle}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-label={`Course: ${displayText}`}
    >
      {displayText}
      {tooltipVisible && (
        <div 
          // Use absolute positioning relative to the span for the tooltip with arrow
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 text-xs font-medium text-white bg-gray-900/90 dark:bg-gray-100/90 dark:text-black rounded-md shadow-lg max-w-xs text-center z-50 transition-opacity duration-100 opacity-100"
        >
          {tooltipTextContent}
          <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900/90 dark:border-t-gray-100/90"></div>
        </div>
      )}
    </span>
  );
};

export default PrereqCourseIdWithTooltip; 