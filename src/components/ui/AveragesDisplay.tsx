import React, { useMemo } from 'react';
import { DegreeTemplate, RawCourseData } from '../../types/data';
import { calculateAllAverages } from '../../utils/averageCalculator';

interface AveragesDisplayProps {
  currentTemplate: DegreeTemplate | undefined;
  allCourses: RawCourseData[];
  grades: Record<string, string>;
}

export const AveragesDisplay: React.FC<AveragesDisplayProps> = ({
  currentTemplate,
  allCourses,
  grades,
}) => {
  const { overallAverage /*, semesterAverages */ } = useMemo(() => {
    if (!Array.isArray(allCourses) || !currentTemplate) {
      return { overallAverage: null, semesterAverages: {} };
    }
    return calculateAllAverages(currentTemplate, allCourses, grades);
  }, [currentTemplate, allCourses, grades]);

  const formatAverage = (avg: number | null): string => {
    return avg === null ? 'N/A' : avg.toFixed(2);
  };

  return (
    <div className="fixed bottom-20 right-4 z-50 p-4 !bg-slate-50 dark:!bg-gray-800 dark:!bg-opacity-80 rounded-lg shadow-md backdrop-blur-sm">
      <h3 className="text-sm font-semibold mb-2 !text-gray-700 dark:!text-gray-300">ממוצעים</h3>
      <div className="text-xs !text-gray-600 dark:!text-gray-400">
        כללי: 
        <span className="font-bold !text-gray-800 dark:!text-gray-200 ml-1">
          {formatAverage(overallAverage)}
        </span>
      </div>
      {/* Optional: Display semester averages if needed */}
      {/* <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
        Semesters: {Object.entries(semesterAverages).map(([sem, avg]) => `S${sem}: ${formatAverage(avg)}`).join(' | ')}
      </div> */}
    </div>
  );
}; 