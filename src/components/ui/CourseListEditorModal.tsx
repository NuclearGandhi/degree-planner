import React, { useState, useEffect, useMemo } from 'react';
import { RawCourseData } from '../../types/data';
import BaseModal from './BaseModal';
import { CourseSelectionModal } from './CourseSelectionModal';
import { AlertModal } from './AlertModal';
import { ConfirmModal } from './ConfirmModal';

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
  const [newListName, setNewListName] = useState<string>(""); // State for new list name input
  const [renamingListName, setRenamingListName] = useState<string | null>(null); // State for which list is being renamed
  const [editedListName, setEditedListName] = useState<string>(""); // State for the new name input during rename
  const [isCoursePickerModalOpen, setIsCoursePickerModalOpen] = useState<boolean>(false); // State for picker modal
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title?: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    buttonText?: string;
  }>({ message: '' });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [listToDelete, setListToDelete] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      // Make a deep copy for local editing to avoid mutating the prop directly
      setEditableCourseLists(JSON.parse(JSON.stringify(currentCourseLists)));
      setSelectedListName(null); // Reset selection when modal opens/data changes
      setRenamingListName(null); // Reset rename state when modal opens/re-opens
      setEditedListName("");
      setIsCoursePickerModalOpen(false); // Ensure picker is closed when main modal opens/re-opens
    } else {
      setEditableCourseLists({}); // Clear when closed
    }
  }, [isOpen, currentCourseLists]);

  const handleAddNewList = () => {
    const trimmedNewListName = newListName.trim();
    if (trimmedNewListName && !(trimmedNewListName in editableCourseLists)) {
      setEditableCourseLists(prevLists => ({
        ...prevLists,
        [trimmedNewListName]: []
      }));
      setNewListName(""); // Clear input after adding
    } else if (trimmedNewListName in editableCourseLists) {
      showAlertMessage("שם רשימה כבר קיים.", 'error');
    } else {
      showAlertMessage("שם רשימה לא יכול להיות ריק.", 'error');
    }
  };

  const handleStartRename = (listName: string) => {
    setRenamingListName(listName);
    setEditedListName(listName);
  };

  const handleCancelRename = () => {
    setRenamingListName(null);
    setEditedListName("");
  };

  const handleConfirmRename = () => {
    if (!renamingListName) return;
    const trimmedEditedName = editedListName.trim();

    if (!trimmedEditedName) {
      showAlertMessage("שם רשימה לא יכול להיות ריק.", 'error');
      return;
    }
    // Allow renaming to the same name (effectively a no-op for name change)
    // Check for conflict only if the name actually changed to something that already exists
    if (trimmedEditedName !== renamingListName && (trimmedEditedName in editableCourseLists)) {
      showAlertMessage("שם רשימה אחרת כבר קיים עם שם זה.", 'error');
      return;
    }

    setEditableCourseLists(prevLists => {
      const newListData: Record<string, string[]> = {};
      for (const key in prevLists) {
        if (key === renamingListName) {
          newListData[trimmedEditedName] = prevLists[key];
        } else {
          newListData[key] = prevLists[key];
        }
      }
      return newListData;
    });

    if (selectedListName === renamingListName) {
      setSelectedListName(trimmedEditedName);
    }
    handleCancelRename(); // Reset rename state
  };

  const handleDeleteList = (listNameToDelete: string) => {
    if (listNameToDelete === mandatoryCoursesListKey) {
        showAlertMessage("לא ניתן למחוק את רשימת קורסי החובה.", 'error');
        return;
    }
    setListToDelete(listNameToDelete);
    setShowDeleteConfirm(true);
  };

  const handleRemoveCourseFromList = (courseIdToRemove: string) => {
    if (!selectedListName) return;

    setEditableCourseLists(prevLists => {
      if (!prevLists[selectedListName]) return prevLists; // Should not happen if selectedListName is valid

      const updatedCoursesInList = prevLists[selectedListName].filter(id => id !== courseIdToRemove);
      return {
        ...prevLists,
        [selectedListName]: updatedCoursesInList
      };
    });
  };

  const handleSelectCourseFromPickerModal = (selectedCourse: RawCourseData) => {
    if (!selectedListName) {
      // This should ideally not happen if the add button is disabled when no list is selected
      showAlertMessage("אנא בחר רשימה תחילה.", 'warning');
      setIsCoursePickerModalOpen(false);
      return;
    }
    if (editableCourseLists[selectedListName]?.includes(selectedCourse._id)) {
      showAlertMessage("הקורס כבר קיים ברשימה זו.", 'warning');
      // We might want to keep the picker open or give other feedback
      // For now, just an alert, and it will close implicitly if not handled otherwise
    } else {
      setEditableCourseLists(prevLists => ({
        ...prevLists,
        [selectedListName]: [...(prevLists[selectedListName] || []), selectedCourse._id]
      }));
    }
    setIsCoursePickerModalOpen(false); // Close picker after selection/attempt
  };

  // Memoized list of available courses for the dropdown (not already in the selected list)
  const availableCoursesForSelectedList = useMemo(() => {
    if (!selectedListName || !editableCourseLists[selectedListName]) {
      return allCourses; // If no list selected or list is new/empty, show all
    }
    const coursesInCurrentList = new Set(editableCourseLists[selectedListName]);
    return allCourses.filter(course => !coursesInCurrentList.has(course._id));
  }, [allCourses, selectedListName, editableCourseLists]);

  // In a later phase, onSave will call onSaveCourseLists(editableCourseLists)
  // For now, onClose is just onClose from props.

  const showAlertMessage = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', title?: string) => {
    setAlertConfig({ message, type, title });
    setShowAlert(true);
  };

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
            {Object.keys(editableCourseLists).length > 0 ? (
              <ul className="space-y-1">
                {Object.keys(editableCourseLists).sort((a, b) => a.localeCompare(b, 'he')).map(name => (
                  <li key={name}>
                    <button
                      onClick={() => {
                        setSelectedListName(name);
                        handleCancelRename(); // Cancel any ongoing rename when selecting a new list
                      }}
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
          {/* Add New List input and button */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <input 
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="שם רשימה חדשה"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md mb-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button 
              onClick={handleAddNewList}
              className="w-full p-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors"
            >
              הוסף רשימה חדשה +
            </button>
          </div>
        </div>

        {/* Right Panel: Courses in Selected List */}
        <div className="w-2/3 flex flex-col px-4">
          {selectedListName ? (
            <>
              <div className="flex justify-between items-center mb-3">
                {renamingListName === selectedListName ? (
                  <div className="flex-grow flex items-center">
                    <input 
                      type="text"
                      value={editedListName}
                      onChange={(e) => setEditedListName(e.target.value)}
                      className="flex-grow p-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-indigo-500 focus:border-indigo-500 mr-2"
                    />
                    <button onClick={handleConfirmRename} className="p-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded-md mr-1">שמור שם</button>
                    <button onClick={handleCancelRename} className="p-1 text-xs bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-md">בטל</button>
                  </div>
                ) : (
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 truncate">קורסים ברשימה: {selectedListName}</h3>
                )}
                
                {/* Show rename/delete only if not currently renaming this list */}
                {renamingListName !== selectedListName && (
                  <div className="flex-shrink-0">
                      <button 
                          onClick={() => handleStartRename(selectedListName)}
                          className="text-xs text-blue-500 hover:text-blue-700 ml-2"
                          disabled={selectedListName === mandatoryCoursesListKey} 
                      >
                          שנה שם
                      </button>
                      <button 
                          onClick={() => handleDeleteList(selectedListName)}
                          className="text-xs text-red-500 hover:text-red-700"
                          disabled={selectedListName === mandatoryCoursesListKey} 
                      >
                          מחק רשימה
                      </button>
                  </div>
                )}
              </div>
              <div className="overflow-y-auto flex-grow border border-gray-200 dark:border-gray-700 rounded-md p-2 bg-gray-50 dark:bg-gray-700/30">
                {(editableCourseLists[selectedListName] && editableCourseLists[selectedListName].length > 0) ? (
                  <ul className="space-y-1">
                    {editableCourseLists[selectedListName].map(courseId => {
                      const course = allCourses.find(c => c._id === courseId);
                      return (
                        <li key={courseId} className="p-2 bg-white dark:bg-gray-600 rounded shadow-sm flex justify-between items-center">
                          <span className="truncate pr-2">{course ? `${course.name} (${courseId})` : courseId}</span>
                          <button 
                            onClick={() => handleRemoveCourseFromList(courseId)}
                            className="text-xs text-red-500 hover:text-red-700 flex-shrink-0"
                          >
                            הסר
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-center py-4 text-gray-500 dark:text-gray-400">רשימה זו ריקה.</p>
                )}
              </div>
              {/* Add Course to List section - uses CourseSelectionModal now */}
              <div className="mt-4 p-3 border-t border-gray-200 dark:border-gray-700">
                <button 
                  onClick={() => setIsCoursePickerModalOpen(true)}
                  className="w-full p-2 text-sm bg-sky-500 hover:bg-sky-600 text-white rounded-md transition-colors"
                  disabled={!selectedListName} // Disable if no list is selected
                >
                  הוסף קורס לרשימה זו...
                </button>
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
              type="button" 
              onClick={() => { 
                  onSaveCourseLists(editableCourseLists); 
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              שמור רשימות
            </button>
      </div>
      {/* Course Picker Modal */}
      {selectedListName && (
        <CourseSelectionModal 
          isOpen={isCoursePickerModalOpen}
          onClose={() => setIsCoursePickerModalOpen(false)}
          courses={availableCoursesForSelectedList} // Pass courses not already in the list
          onSelectCourse={handleSelectCourseFromPickerModal}
          customTitle={`הוסף קורס לרשימה: ${selectedListName}`}
        />
      )}
      <AlertModal
        isOpen={showAlert}
        onClose={() => setShowAlert(false)}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttonText={alertConfig.buttonText}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setListToDelete('');
        }}
        title="מחיקת רשימה"
        message={`האם אתה בטוח שברצונך למחוק את הרשימה "${listToDelete}"?`}
        confirmText="מחק"
        confirmVariant="danger"
        onConfirm={() => {
          setEditableCourseLists(prevLists => {
            const newListData = { ...prevLists };
            delete newListData[listToDelete];
            return newListData;
          });
          if (selectedListName === listToDelete) {
            setSelectedListName(null);
            setRenamingListName(null); // Ensure rename state is also cleared if deleted list was being renamed
            setEditedListName("");
          }
          setShowDeleteConfirm(false);
          setListToDelete('');
        }}
      />
    </BaseModal>
  );
};

export default CourseListEditorModal; 