import React, { useState, useEffect } from 'react';
import { RawCourseData } from '../../types/data';
import BaseModal from './BaseModal';

interface CourseListEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  allCourses: RawCourseData[]; // For course picker later
  currentCourseLists: Record<string, string[]>; // e.g., { "List A": ["id1", "id2"], ... }
  onSaveCourseLists: (updatedLists: Record<string, string[]>) => void; // To save changes
  mandatoryCoursesListKey?: string; // Added prop
}

const CourseListEditorModal: React.FC<CourseListEditorModalProps> = ({
  isOpen,
  onClose,
  allCourses, // Unused in this phase
  currentCourseLists,
  onSaveCourseLists, // Unused in this phase
  mandatoryCoursesListKey, // Added prop
}) => {
  const [selectedListName, setSelectedListName] = useState<string | null>(null);
  const [editableCourseLists, setEditableCourseLists] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (isOpen) {
      // Make a deep copy for local editing to avoid mutating the prop directly
      setEditableCourseLists(JSON.parse(JSON.stringify(currentCourseLists)));
      setSelectedListName(null); // Reset selection when modal opens/data changes
    } else {
        setEditableCourseLists({}); // Clear when closed
    }
  }, [isOpen, currentCourseLists]);

  const listNames = Object.keys(editableCourseLists);

  // In a later phase, onSave will call onSaveCourseLists(editableCourseLists)
  // For now, onClose is just onClose from props.

  return (
    <BaseModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="עורך רשימות קורסים" 
      maxWidth="max-w-2xl" // Give it more space than other modals
    >
      <div className="flex space-x-4 space-x-reverse h-[60vh]">
        {/* Left Panel: List of Course Lists */}
        <div className="w-1/3 border-l border-gray-200 dark:border-gray-700 pl-4 flex flex-col">
          <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">רשימות קיימות</h3>
          <div className="overflow-y-auto flex-grow">
            {listNames.length > 0 ? (
              <ul className="space-y-1">
                {listNames.map(name => (
                  <li key={name}>
                    <button
                      onClick={() => setSelectedListName(name)}
                      className={`w-full text-right p-2 rounded-md transition-colors ${selectedListName === name 
                        ? 'bg-indigo-100 dark:bg-indigo-700 text-indigo-700 dark:text-indigo-100' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
                    >
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">אין רשימות קורסים מוגדרות.</p>
            )}
          </div>
          {/* Placeholder for Add New List button */}
          <div className="mt-4">
            <button className="w-full p-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors" disabled> {/* Disabled for now */}
              הוסף רשימה חדשה +
            </button>
          </div>
        </div>

        {/* Right Panel: Courses in Selected List */}
        <div className="w-2/3 flex flex-col">
          {selectedListName ? (
            <>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">קורסים ברשימה: {selectedListName}</h3>
                {/* Placeholder for Rename/Delete List buttons */}
                <div>
                    <button 
                        className="text-xs text-blue-500 hover:text-blue-700 mr-2"
                        disabled={selectedListName === mandatoryCoursesListKey} // Disable if mandatory
                    >
                        שנה שם
                    </button>
                    <button 
                        className="text-xs text-red-500 hover:text-red-700"
                        disabled={selectedListName === mandatoryCoursesListKey} // Disable if mandatory
                    >
                        מחק רשימה
                    </button>
                </div>
              </div>
              <div className="overflow-y-auto flex-grow border border-gray-200 dark:border-gray-700 rounded-md p-2 bg-gray-50 dark:bg-gray-700/30">
                {(editableCourseLists[selectedListName] && editableCourseLists[selectedListName].length > 0) ? (
                  <ul className="space-y-1">
                    {editableCourseLists[selectedListName].map(courseId => {
                      const course = allCourses.find(c => c._id === courseId);
                      return (
                        <li key={courseId} className="p-2 bg-white dark:bg-gray-600 rounded shadow-sm flex justify-between items-center">
                          <span>{course ? `${course.name} (${courseId})` : courseId}</span>
                          {/* Placeholder for Remove from list button */}
                          <button className="text-xs text-red-500 hover:text-red-700" disabled>הסר</button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-center py-4 text-gray-500 dark:text-gray-400">רשימה זו ריקה.</p>
                )}
              </div>
              {/* Placeholder for Add Course to List section */}
              <div className="mt-4 p-2 border-t border-gray-200 dark:border-gray-700">
                 <p className="text-sm text-center text-gray-400">(כאן יופיע ממשק להוספת קורסים לרשימה)</p>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500 dark:text-gray-400">בחר רשימה מהצד כדי להציג את הקורסים שבה.</p>
            </div>
          )}
        </div>
      </div>
       <div className="mt-6 flex justify-end gap-x-2">
            <button
              type="button"
              onClick={onClose} 
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              סגור (ללא שמירה)
            </button>
            <button
              type="button" // Will be type="submit" or call a save handler later
              onClick={() => { 
                  // onSaveCourseLists(editableCourseLists); // This will be enabled later
                  // onClose(); 
              }}
              disabled // Disabled for now
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              שמור רשימות
            </button>
      </div>
    </BaseModal>
  );
};

export default CourseListEditorModal; 