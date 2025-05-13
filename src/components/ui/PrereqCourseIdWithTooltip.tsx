import React, { useState, useEffect } from 'react';
import { RawCourseData } from '../../types/data';
// Removed getEquivalentCourses as it was not used in the new logic and seems to be from an older version

interface PrereqCourseIdWithTooltipProps {
  courseId: string;
  allCourses?: RawCourseData[];
  coursesInPlanIds?: Set<string>;
  semesters?: Record<string, string[]>;
  targetCourseSemesterKey?: string;
}

const PrereqCourseIdWithTooltip: React.FC<PrereqCourseIdWithTooltipProps> = ({
  courseId,
  allCourses,
  coursesInPlanIds,
  semesters,
  targetCourseSemesterKey,
}) => {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [courseName, setCourseName] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>(' (לא בתוכנית)');
  const [statusStyle, setStatusStyle] = useState<string>('text-gray-800 dark:text-gray-200');
  
  const courseData = allCourses?.find(c => c._id === courseId);
  // Define isInPlan in the component scope
  const isInPlan = coursesInPlanIds?.has(courseId) || false;

  useEffect(() => {
    setCourseName(courseData?.name || courseId);
    // isInPlan is now available from the outer scope

    let currentStatusStyle = 'text-gray-800 dark:text-gray-200';
    let currentStatusText = ' (לא בתוכנית)';

    if (isInPlan) {
      currentStatusStyle = 'text-green-700 dark:text-green-400 font-semibold'; 
      currentStatusText = ' (בתוכנית)';

      if (semesters && targetCourseSemesterKey && courseData) { 
        let prereqSemesterIndex = -1;
        let targetSemesterIndex = -1;
        const semesterKeys = Object.keys(semesters);
        targetSemesterIndex = semesterKeys.indexOf(targetCourseSemesterKey);

        for (const [key, courseIdsInSem] of Object.entries(semesters)) {
          if (courseIdsInSem.includes(courseId)) {
            prereqSemesterIndex = semesterKeys.indexOf(key);
            break;
          }
        }

        if (prereqSemesterIndex !== -1 && targetSemesterIndex !== -1) {
          if (prereqSemesterIndex === targetSemesterIndex) { 
            currentStatusStyle = 'text-orange-600 dark:text-orange-400 font-semibold';
            currentStatusText = ' (בסמסטר הנוכחי)';
          } else if (prereqSemesterIndex > targetSemesterIndex) { 
            currentStatusStyle = 'text-red-600 dark:text-red-400 font-semibold';
            currentStatusText = ' (בסמסטר מאוחר יותר)';
          }
        }
      }
    }
    setStatusStyle(currentStatusStyle);
    setStatusText(currentStatusText);
  }, [courseId, coursesInPlanIds, semesters, targetCourseSemesterKey, courseData, isInPlan]); // Added isInPlan to dependencies

  const handleMouseEnter = () => {
    if (courseName) setTooltipVisible(true);
  };
  const handleMouseLeave = () => setTooltipVisible(false);

  const displayText = courseId;
  const tooltipTextContent = `${courseName || courseId}${statusText}`;
  const baseBadgeStyle = "font-mono bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-sm shadow-sm cursor-pointer relative";

  let badgeBorderColor = 'border-gray-400/50';
  let badgeBgColor = 'bg-gray-500/10';

  if (isInPlan) {
    if (statusStyle.includes('red')) {
      badgeBorderColor = 'border-red-500/50';
      badgeBgColor = 'bg-red-500/10';
    } else if (statusStyle.includes('orange')) {
      badgeBorderColor = 'border-orange-500/50';
      badgeBgColor = 'bg-orange-500/10';
    } else if (statusStyle.includes('green')) {
      badgeBorderColor = 'border-green-600/50';
      badgeBgColor = 'bg-green-500/10';
    }
  }

  return (
    <span 
      className={`${baseBadgeStyle} ${statusStyle} ${badgeBorderColor} ${badgeBgColor}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-label={`Course: ${displayText}`}
    >
      {displayText}
      {tooltipVisible && (
        <div 
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 text-xs font-medium text-white bg-gray-900/90 dark:bg-gray-100/90 dark:text-black rounded-md shadow-lg max-w-xs text-center z-50 transition-opacity duration-100 opacity-100"
        >
          {tooltipTextContent}
          {(courseName && courseData?.credits !== undefined) && <span className="block text-xs">נק״ז: {courseData.credits}</span>}
          <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900/90 dark:border-t-gray-100/90"></div>
        </div>
      )}
    </span>
  );
};

export default PrereqCourseIdWithTooltip; 