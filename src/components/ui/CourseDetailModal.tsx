import React from 'react';
import { RawCourseData, PrerequisiteGroup } from '../../types/data';
import PrereqTreeDisplay, { HandledPrereq } from './PrereqTreeDisplay';

interface CourseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: RawCourseData | null;
  allCourses?: RawCourseData[];
}

export const CourseDetailModal: React.FC<CourseDetailModalProps> = ({ isOpen, onClose, course, allCourses }) => {
  if (!isOpen || !course) {
    return null;
  }

  // Defensive checks for potentially missing properties, though RawCourseData defines most as non-optional
  const courseId = course._id || 'N/A';
  const courseName = course.name || 'שם לא זמין';
  const courseCredits = course.credits !== undefined ? course.credits : 'N/A';
  const academicPoints = course.academic_points;
  const hours = course.hours;
  const faculty = course.faculty; // faculty is a string in RawCourseData
  const semesters = Array.isArray(course.semester) ? course.semester.join(', ') : (course.semester || 'לא צוין');
  const descriptionFromInfo = course.info;
  const prerequisitesText = course.prerequisites; // This is a string field for textual representation
  const courseUrl = course.url;
  // Add new fields
  const syllabus = course.syllabus;
  const studyProgram = course.study_program;
  const noCreditCourses = course.no_credit_courses;
  const lecturer = course.lecturer;
  const notes = course.notes;
  const examADate = course.exam_a;
  const examBDate = course.exam_b;
  const prereqTreeData = course.prereqTree;

  return (
    <div 
      className="fixed inset-0 bg-black/10 backdrop-blur-sm flex justify-center items-center z-50 p-4 transition-opacity duration-300 ease-in-out"
      onClick={onClose} // Close on overlay click
    >
      {/* Single Modal Container: LTR direction for scrollbar, styling, overflow */}
      <div 
        className="modal-scrollable-content bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modal-appear"
        style={{ direction: 'ltr' }} // Force LTR for scrollbar side
        onClick={(e) => e.stopPropagation()} 
      >
        {/* Inner Wrapper to reset content direction to RTL */}
        <div style={{ direction: 'rtl' }}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white truncate pr-4" title={courseName}>{courseName}</h2>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
              aria-label="סגור"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <p><strong className="font-medium text-gray-800 dark:text-gray-100">מספר קורס:</strong> {courseId}</p>
            <p><strong className="font-medium text-gray-800 dark:text-gray-100">נקודות זכות:</strong> {courseCredits}</p>
            {academicPoints !== undefined && <p><strong className="font-medium text-gray-800 dark:text-gray-100">נקודות אקדמיות:</strong> {academicPoints}</p>}
            {hours && <p><strong className="font-medium text-gray-800 dark:text-gray-100">שעות:</strong> {hours}</p>}
            {faculty && <p><strong className="font-medium text-gray-800 dark:text-gray-100">פקולטה:</strong> {faculty}</p>}
            {semesters && <p><strong className="font-medium text-gray-800 dark:text-gray-100">סמסטרים מוצעים:</strong> {semesters}</p>}
            
            {descriptionFromInfo && (
              <div>
                <strong className="font-medium text-gray-800 dark:text-gray-100">תיאור הקורס:</strong>
                <p className="mt-1 whitespace-pre-wrap">{descriptionFromInfo}</p>
              </div>
            )}

            {prerequisitesText && (
              <div>
                <strong className="font-medium text-gray-800 dark:text-gray-100">דרישות קדם (טקסט):</strong>
                <p className="mt-1 whitespace-pre-wrap">{prerequisitesText}</p>
              </div>
            )}

            {/* Display structured prerequisites if available */}
            {prereqTreeData && (
              <div>
                <strong className="font-medium text-gray-800 dark:text-gray-100">דרישות קדם (מבנה לוגי):</strong>
                { (
                    typeof prereqTreeData === 'string' || 
                    (typeof prereqTreeData === 'object' && prereqTreeData !== null && (
                      Array.isArray((prereqTreeData as { or?: [] }).or) || 
                      Array.isArray((prereqTreeData as { and?: [] }).and) || 
                      (Array.isArray((prereqTreeData as PrerequisiteGroup).list) && typeof (prereqTreeData as PrerequisiteGroup).type === 'string')
                    ))
                  ) ? (
                    <div className="mt-1 pl-2">
                      <PrereqTreeDisplay prereq={prereqTreeData as HandledPrereq} allCourses={allCourses} />
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">אין מידע קדם מובנה זמין עבור קורס זה.</p>
                  )
                }
              </div>
            )}

            {/* Display new fields below prerequisitesText */} 
            {syllabus && (
              <div>
                <strong className="font-medium text-gray-800 dark:text-gray-100">סילבוס:</strong>
                <p className="mt-1 whitespace-pre-wrap">{syllabus}</p>
              </div>
            )}

            {studyProgram && <p><strong className="font-medium text-gray-800 dark:text-gray-100">תוכנית לימודים:</strong> {studyProgram}</p>}
            {noCreditCourses && <p><strong className="font-medium text-gray-800 dark:text-gray-100">קורסים ללא אשראי חופף:</strong> {noCreditCourses}</p>}
            {lecturer && <p><strong className="font-medium text-gray-800 dark:text-gray-100">מרצה:</strong> {lecturer}</p>}
            
            {notes && (
              <div>
                <strong className="font-medium text-gray-800 dark:text-gray-100">הערות:</strong>
                <p className="mt-1 whitespace-pre-wrap">{notes}</p>
              </div>
            )}

            {examADate && <p><strong className="font-medium text-gray-800 dark:text-gray-100">מועד א׳:</strong> {examADate}</p>}
            {examBDate && <p><strong className="font-medium text-gray-800 dark:text-gray-100">מועד ב׳:</strong> {examBDate}</p>}

            {courseUrl && (
              <p>
                <strong className="font-medium text-gray-800 dark:text-gray-100">קישור לקורס:</strong> 
                <a href={courseUrl as string} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline">
                  פתח ב-UG
                </a>
              </p>
            )}
          </div>
        </div> 
      </div> 

      {/* Basic CSS for modal animation - can be moved to index.css or a dedicated CSS file */}
      <style>{`
        @keyframes modal-appear-animation {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-modal-appear {
          animation: modal-appear-animation 0.2s ease-out forwards;
        }
        /* Custom Scrollbar Styles for WebKit browsers */
        .modal-scrollable-content::-webkit-scrollbar {
          width: 8px; /* Adjust width */
        }
        .modal-scrollable-content::-webkit-scrollbar-track {
          background: transparent; /* Or match modal background */
        }
        .modal-scrollable-content::-webkit-scrollbar-thumb {
          background-color: rgba(0, 0, 0, 0.3); /* Dark thumb */
          border-radius: 4px; 
          border: 2px solid transparent; /* Creates padding around thumb */
          background-clip: padding-box;
        }
        .modal-scrollable-content::-webkit-scrollbar-thumb:hover {
          background-color: rgba(0, 0, 0, 0.5);
        }
        .dark .modal-scrollable-content::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.3); /* Light thumb for dark mode */
        }
        .dark .modal-scrollable-content::-webkit-scrollbar-thumb:hover {
          background-color: rgba(255, 255, 255, 0.5);
        }

        /* Custom Scrollbar Styles for Firefox */
        .modal-scrollable-content {
          scrollbar-width: thin; /* "auto" or "thin" */
          scrollbar-color: rgba(0, 0, 0, 0.3) transparent; /* thumb color track color */
        }
        .dark .modal-scrollable-content {
           scrollbar-color: rgba(255, 255, 255, 0.3) transparent; /* thumb color track color for dark mode */
        }
      `}</style>
    </div>
  );
}; 