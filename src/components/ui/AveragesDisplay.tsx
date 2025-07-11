import React, { useMemo, useState } from 'react';
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
  const [isExpanded, setIsExpanded] = useState(false);

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

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div 
      dir="rtl" 
      className={`fixed bottom-4 right-4 z-50 p-4 !bg-slate-50/60 dark:!bg-gray-800/60 rounded-lg shadow-md backdrop-blur-sm transition-all duration-300 ease-in-out ${
        isExpanded ? 'max-w-sm min-h-[250px]' : 'max-w-xs'
      }`}
    >
      {/* Header with toggle button */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-center !text-gray-700 dark:!text-gray-300">
          {isExpanded ? 'סיכום נק"ז וממוצע' : 'ממוצע'}
        </h3>
        <button
          onClick={toggleExpanded}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-200 p-1 rounded"
          aria-label={isExpanded ? 'מזער' : 'הרחב'}
        >
          <svg 
            className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>

      {/* Content */}
      {isExpanded ? (
        // Expanded view - full details
        <>
          <div className="text-xs !text-gray-600 dark:!text-gray-400 mb-3 pb-3 border-b border-gray-200 dark:border-gray-600">
            ממוצע כללי (משוקלל): 
            <span className="font-bold !text-gray-800 dark:!text-gray-200 mr-1">
              {formatAverage(overallAverage)}
            </span>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto pl-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-400 dark:hover:[&::-webkit-scrollbar-thumb]:bg-gray-500">
            {Object.entries(semesterCalculations).map(([semesterKey, calc]) => (
              <div key={semesterKey} className="flex justify-between items-center text-xs">
                <span className="!text-gray-600 dark:!text-gray-400 truncate ml-2">{semesterKey}:</span>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <span className="!text-gray-500 dark:!text-gray-500 text-xs">
                    ({formatCredits(calc.totalCredits)} נק"ז)
                  </span>
                  <span className="font-medium !text-gray-700 dark:!text-gray-300 w-12 text-left">
                    {formatAverage(calc.average)}
                  </span>
                </div>
              </div>
            ))}
            {Object.keys(semesterCalculations).length === 0 && (
              <div className="text-xs text-center !text-gray-500 dark:!text-gray-500">אין סמסטרים להצגה</div>
            )}
          </div>
        </>
      ) : (
        // Minimized view - no details shown (private)
        <div className="text-center">
          <div className="text-2xl !text-gray-600 dark:!text-gray-400">
            📊
          </div>
        </div>
      )}
    </div>
  );
}; 