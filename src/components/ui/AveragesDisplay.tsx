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
  const { overallAverage, semesterCalculations } = useMemo(() => {
    if (!Array.isArray(allCourses) || !currentTemplate) {
      return { overallAverage: null, semesterCalculations: {} };
    }
    return calculateAllAverages(currentTemplate, allCourses, grades);
  }, [currentTemplate, allCourses, grades]);

  const formatAverage = (avg: number | null): string => {
    return avg === null ? '-' : avg.toFixed(2);
  };

  const formatCredits = (credits: number): string => {
    return credits % 1 === 0 ? credits.toString() : credits.toFixed(1);
  };

  return (
    <div 
      dir="rtl" 
      className="fixed bottom-4 right-4 z-50 p-3 !bg-slate-50/90 dark:!bg-gray-800/90 rounded-lg shadow-md backdrop-blur-sm max-w-xs"
    >
      <h3 className="text-sm font-semibold mb-2 text-center !text-gray-700 dark:!text-gray-300">סיכום נק"ז וממוצע</h3>
      <div className="text-xs !text-gray-600 dark:!text-gray-400 mb-2 pb-2 border-b border-gray-200 dark:border-gray-600">
        ממוצע כללי (משוקלל): 
        <span className="font-bold !text-gray-800 dark:!text-gray-200 mr-1">
          {formatAverage(overallAverage)}
        </span>
      </div>
      <div className="space-y-1 max-h-32 overflow-y-auto pl-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-400 dark:hover:[&::-webkit-scrollbar-thumb]:bg-gray-500">
        {Object.entries(semesterCalculations).map(([semesterKey, calc]) => (
          <div key={semesterKey} className="flex justify-between items-center text-xs">
            <span className="!text-gray-600 dark:!text-gray-400 truncate ml-2">{semesterKey}:</span>
            <div className="flex items-center space-x-2 space-x-reverse">
              <span className="!text-gray-500 dark:!text-gray-500">
                ({formatCredits(calc.totalCredits)} נק"ז)
              </span>
              <span className="font-medium !text-gray-700 dark:!text-gray-300 w-10 text-left">
                {formatAverage(calc.average)}
              </span>
            </div>
          </div>
        ))}
        {Object.keys(semesterCalculations).length === 0 && (
          <div className="text-xs text-center !text-gray-500 dark:!text-gray-500">אין סמסטרים להצגה</div>
        )}
      </div>
    </div>
  );
}; 