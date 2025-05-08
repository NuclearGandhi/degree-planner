import React from 'react';
import { PrerequisiteItem, PrerequisiteGroup as OriginalPrerequisiteGroup, RawCourseData } from '../../types/data';
import PrereqCourseIdWithTooltip from './PrereqCourseIdWithTooltip';

// Define a more comprehensive type for prerequisite structures this component handles
export type HandledPrereq = 
  | PrerequisiteItem 
  | OriginalPrerequisiteGroup // Original structure: { type: string; list: HandledPrereq[]; credits?: number }
  | { or: HandledPrereq[] }    // Structure: { or: [...] }
  | { and: HandledPrereq[] };  // Structure: { and: [...] }
  // Note: PrerequisiteGroup from types/data might need to align or be broadened if it's used elsewhere with these new structures.

interface PrereqTreeDisplayProps {
  prereq: HandledPrereq | null | undefined; // Allow null/undefined for safety
  isTopLevel?: boolean;
  allCourses?: RawCourseData[]; // Add allCourses prop
}

const PrereqTreeDisplay: React.FC<PrereqTreeDisplayProps> = ({ prereq, isTopLevel = true, allCourses }) => {
  if (!prereq) {
    // Handles null, undefined, or potentially empty objects if they sneak through previous checks
    return <span className="text-xs text-gray-500 italic">אין מידע קדם זמין.</span>;
  }

  if (typeof prereq === 'string') {
    const courseId = prereq;
    return <PrereqCourseIdWithTooltip courseId={courseId} allCourses={allCourses} />;
  }

  let groupTitle = '';
  let itemsToRender: HandledPrereq[] = [];
  let groupRenderType: 'and' | 'or' | 'list' | 'unknown' = 'unknown';
  let creditsToComplete: number | undefined = undefined;

  if ('or' in prereq && Array.isArray(prereq.or)) {
    itemsToRender = prereq.or;
    groupRenderType = 'or';
    // No title for top-level OR groups, the 'או' separators should suffice
    // if (isTopLevel) groupTitle = 'לפחות אחד מהתנאים הבאים:'; 
  } else if ('and' in prereq && Array.isArray(prereq.and)) {
    itemsToRender = prereq.and;
    groupRenderType = 'and';
    if (isTopLevel) groupTitle = 'כל התנאים הבאים:';
  } else if ('list' in prereq && Array.isArray(prereq.list) && 'type' in prereq && typeof prereq.type === 'string') {
    const group = prereq as OriginalPrerequisiteGroup;
    itemsToRender = group.list as HandledPrereq[];
    // groupTitle = group.type; // Title will be set below based on refined groupRenderType for top level
    creditsToComplete = group.credits;
    switch (group.type) {
      case 'all':
        groupRenderType = 'and';
        if (isTopLevel) groupTitle = 'כל התנאים הבאים:';
        break;
      case 'one':
        groupRenderType = 'or';
        // No title for top-level OR groups from this structure either
        // if (isTopLevel) groupTitle = 'לפחות אחד מהתנאים הבאים:'; 
        break;
      case 'at_least_X_credits_from_list':
        groupRenderType = 'list';
        if (isTopLevel) groupTitle = `לפחות ${creditsToComplete || 'X'} נקודות זכות מתוך הרשימה:`;
        else groupTitle = 'מתוך:'; 
        break;
      default:
        groupRenderType = 'list'; 
        if (isTopLevel) groupTitle = group.type ? `${group.type}:` : 'קבוצת תנאים:';
        break;
    }
  }

  // Main rendering logic based on groupRenderType
  if (itemsToRender.length > 0) {
    let renderedContent;

    if (groupRenderType === 'and') {
      renderedContent = (
        <div className={`p-2 my-1 rounded-md bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 shadow-sm flex flex-wrap items-center gap-1.5`}>
          {itemsToRender.map((item, index) => (
            <React.Fragment key={index}>
              <PrereqTreeDisplay prereq={item} isTopLevel={false} allCourses={allCourses} />
              {index < itemsToRender.length - 1 && 
                <span className="font-semibold text-indigo-700 dark:text-indigo-300">וגם</span>}
            </React.Fragment>
          ))}
        </div>
      );
    } else if (groupRenderType === 'or') {
      renderedContent = (
        <div className={isTopLevel ? "space-y-1" : "space-y-0.5 mt-1" }>
          {itemsToRender.map((item, index) => (
            <React.Fragment key={index}>
              <div className="flex justify-center">
                <PrereqTreeDisplay prereq={item} isTopLevel={false} allCourses={allCourses} />
              </div>
              {index < itemsToRender.length - 1 && 
                <div className="text-center my-1.5">
                    <span className="px-3 py-1 text-xs font-semibold bg-amber-100 dark:bg-amber-800/60 text-amber-700 dark:text-amber-200 rounded-full shadow-sm tracking-wide">או</span>
                </div>}
            </React.Fragment>
          ))}
        </div>
      );
    } else { // list or unknown - default to a vertical list
      renderedContent = (
        <ul className="list-disc pl-6 mt-1 space-y-1">
          {itemsToRender.map((item, index) => (
            <li key={index} className="text-sm">
              <PrereqTreeDisplay prereq={item} isTopLevel={false} allCourses={allCourses} />
            </li>
          ))}
        </ul>
      );
    }

    if (isTopLevel && groupTitle) {
      return (
        <div className="mb-2">
          <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1 text-md">{groupTitle}</p>
          {renderedContent}
        </div>
      );
    } else {
        return renderedContent; // Nested groups return their content directly
    }

  } else if (isTopLevel && groupTitle) { // Top-level group with a title but no items
     return <p className="text-sm text-gray-600 dark:text-gray-400 p-2 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800/30">{groupTitle} (רשימה ריקה)</p>;
  }

  // Fallback if it's an object but doesn't match any known group structure or is empty and has no title
  return <span className="text-xs text-gray-500 italic">מידע קדם לא תקין או שלא נדרשים קדמים.</span>;
};

export default PrereqTreeDisplay; 