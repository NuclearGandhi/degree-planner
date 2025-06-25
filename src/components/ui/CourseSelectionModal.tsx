import React, { useState, useMemo } from 'react';
import { RawCourseData } from '../../types/data';
import BaseModal from './BaseModal';

interface CourseSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: RawCourseData[]; // All available courses to list
  onSelectCourse: (course: RawCourseData) => void;
  semesterNumber?: number | null; // Made optional
  customTitle?: string; // New optional prop for custom title
  alreadyTakenCourses?: RawCourseData[]; // New prop for already taken courses
}

export const CourseSelectionModal: React.FC<CourseSelectionModalProps> = ({
  isOpen,
  onClose,
  courses,
  onSelectCourse,
  semesterNumber,
  customTitle, // New prop
  alreadyTakenCourses = [], // Default to empty array
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Combine available and already taken courses for display
  const allCoursesForDisplay = useMemo(() => {
    const availableWithStatus = courses.map(course => ({ ...course, isAlreadyTaken: false }));
    const takenWithStatus = alreadyTakenCourses.map(course => ({ ...course, isAlreadyTaken: true }));
    return [...availableWithStatus, ...takenWithStatus];
  }, [courses, alreadyTakenCourses]);

  const filteredCourses = useMemo(() => {
    if (!searchTerm) {
      return allCoursesForDisplay;
    }
    return allCoursesForDisplay.filter(course => 
      course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course._id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allCoursesForDisplay, searchTerm]);

  const modalTitle = customTitle 
    ? customTitle 
    : semesterNumber 
      ? `בחר קורס לסמסטר ${semesterNumber}` 
      : "בחר קורס";

  return (
    <BaseModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={modalTitle}
      maxWidth='max-w-lg'
    >
      <div className="mb-4">
        <input 
          type="text"
          placeholder="חפש לפי שם או מספר קורס..."
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-blue-500 outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="overflow-y-auto flex-grow pr-2 max-h-[50vh] min-h-[200px]">
        {filteredCourses.length > 0 ? (
          <ul className="space-y-2">
            {filteredCourses.map((course) => (
              <li key={course._id}>
                <button
                  onClick={() => course.isAlreadyTaken ? undefined : onSelectCourse(course)}
                  disabled={course.isAlreadyTaken}
                  className={`w-full text-right p-3 rounded-md transition-colors rtl-text-force ${
                    course.isAlreadyTaken 
                      ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-75 border border-gray-300 dark:border-gray-600'
                      : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  <div className={`font-medium ${
                    course.isAlreadyTaken 
                      ? 'text-gray-600 dark:text-gray-400' 
                      : 'text-gray-800 dark:text-gray-200'
                  }`}>
                    {course.name} ({course._id})
                  </div>
                  <div className={`text-sm ${
                    course.isAlreadyTaken 
                      ? 'text-gray-500 dark:text-gray-500' 
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    נקודות זכות: {course.credits}
                  </div>
                  {course.isAlreadyTaken && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                      ✓ הקורס כבר נמצא בתכנית הלימודים
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600 dark:text-gray-400 text-center">לא נמצאו קורסים התואמים את החיפוש.</p>
        )}
      </div>
      <div className="mt-6 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          ביטול
        </button>
      </div>
    </BaseModal>
  );
}; 