import React, { useState, useMemo } from 'react';
import { RawCourseData } from '../../types/data';

interface CourseSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: RawCourseData[]; // All available courses to list
  onSelectCourse: (course: RawCourseData) => void;
  semesterNumber: number | null; // To know which semester we are adding to
}

export const CourseSelectionModal: React.FC<CourseSelectionModalProps> = ({
  isOpen,
  onClose,
  courses,
  onSelectCourse,
  semesterNumber,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCourses = useMemo(() => {
    if (!searchTerm) {
      return courses;
    }
    return courses.filter(course => 
      course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course._id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [courses, searchTerm]);

  if (!isOpen || semesterNumber === null) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]" dir="rtl">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            בחר קורס לסמסטר {semesterNumber}
          </h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="סגור"
          >
            &times;
          </button>
        </div>
        <div className="mb-4">
          <input 
            type="text"
            placeholder="חפש לפי שם או מספר קורס..."
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-blue-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="overflow-y-auto flex-grow pr-2">
          {filteredCourses.length > 0 ? (
            <ul className="space-y-2">
              {filteredCourses.map((course) => (
                <li key={course._id}>
                  <button
                    onClick={() => onSelectCourse(course)}
                    className="w-full text-right p-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors rtl-text-force"
                  >
                    <div className="font-medium text-gray-800 dark:text-gray-200">{course.name} ({course._id})</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">נקודות זכות: {course.credits}</div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600 dark:text-gray-400 text-center">לא נמצאו קורסים התואמים את החיפוש.</p>
          )}
        </div>
        <div className="mt-6 text-left">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}; 