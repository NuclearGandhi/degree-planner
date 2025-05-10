import React from 'react';
import BaseModal from './BaseModal';
import { RawCourseData, PrerequisiteGroup } from '../../types/data';
import PrereqCourseIdWithTooltip from './PrereqCourseIdWithTooltip';
import PrereqTreeDisplay, { HandledPrereq } from './PrereqTreeDisplay';

interface CourseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: RawCourseData | null;
  allCourses: RawCourseData[];
}

export const CourseDetailModal: React.FC<CourseDetailModalProps> = ({ isOpen, onClose, course, allCourses }) => {
  if (!isOpen || !course) {
    return null;
  }

  const courseName = course.name || 'פרטי קורס';
  const courseId = course._id || 'N/A';
  const courseCredits = course.credits !== undefined ? course.credits : 'N/A';
  const academicPoints = course.academic_points;
  const hours = course.hours;
  const faculty = course.faculty;
  const semesters = Array.isArray(course.semester) ? course.semester.join(', ') : (course.semester || 'לא צוין');
  const descriptionFromInfo = course.info;
  const prerequisitesText = course.prerequisites as string | undefined;
  const courseUrl = course.url;
  const syllabus = course.syllabus;
  const studyProgram = course.study_program;
  const noCreditCourses = course.no_credit_courses;
  const lecturer = course.lecturer;
  const notes = course.notes;
  const examADate = course.exam_a;
  const examBDate = course.exam_b;
  const prereqTreeData = course.prereqTree;

  const isValidPrereqTree = (data: unknown): data is HandledPrereq => {
    if (!data) return false;
    if (typeof data === 'string') return true;
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.or) && obj.or.every(item => isValidPrereqTree(item))) return true;
      if (Array.isArray(obj.and) && obj.and.every(item => isValidPrereqTree(item))) return true;
      if (Array.isArray(obj.list) && typeof obj.type === 'string') {
        const group = obj as unknown as PrerequisiteGroup;
        return group.list.every(item => isValidPrereqTree(item));
      }
    }
    return false;
  };

  const renderPrereqTree = (): React.ReactNode => {
    if (!prereqTreeData) return null;
    if (!isValidPrereqTree(prereqTreeData)) {
      return <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">אין מידע קדם מובנה זמין עבור קורס זה.</p>;
    }
    return (
      <div className="mt-1 pl-2">
        <PrereqTreeDisplay prereq={prereqTreeData} allCourses={allCourses} />
      </div>
    );
  };

  const renderPrereqSection = (): React.ReactNode | null => {
    if (!prereqTreeData) return null;
    const treeContent = renderPrereqTree();
    if (!treeContent) return null;
    return (
      <div>
        <strong className="font-medium text-gray-800 dark:text-gray-100">דרישות קדם (מבנה לוגי):</strong>
        {treeContent}
      </div>
    );
  };

  const renderContent = () => {
    return (
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

        {renderPrereqSection()}

        {syllabus && (
          <div>
            <strong className="font-medium text-gray-800 dark:text-gray-100">סילבוס:</strong>
            <p className="mt-1 whitespace-pre-wrap">{syllabus}</p>
          </div>
        )}

        {studyProgram && <p><strong className="font-medium text-gray-800 dark:text-gray-100">תוכנית לימודים:</strong> {studyProgram}</p>}
        
        {noCreditCourses && (
          <div>
            <strong className="font-medium text-gray-800 dark:text-gray-100">קורסים ללא זיכוי נוסף:</strong>
            <div className="mt-1 flex flex-wrap gap-1">
              {noCreditCourses.split(/[,\s]+/).map(id => id.trim()).filter(id => id).map((courseId, index) => (
                <PrereqCourseIdWithTooltip 
                  key={index} 
                  courseId={courseId} 
                  allCourses={allCourses} 
                />
              ))}
            </div>
          </div>
        )}
        
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
    );
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={courseName} maxWidth='max-w-lg'>
      {renderContent()}
    </BaseModal>
  );
}; 