import { PrerequisiteItem, PrerequisiteGroup, RawCourseData } from '../types/data';

// Helper to get the semester index (0-based) a course is in, or -1 if not found
// IMPORTANT: This relies on the ORDER of semesters in Object.entries, which might not be guaranteed.
// A more robust solution would involve parsing semester names or using numeric keys.
// const getSemesterIndex = (
//   courseId: string,
//   semesters: Record<string, string[]>
// ): number => {
//   const entry = Object.entries(semesters).find(([, courses]) => courses.includes(courseId));
//   if (!entry) return -1; // Course not found
//   return Object.keys(semesters).findIndex(key => key === entry[0]);
// };

// Helper to get equivalent courses (including no_credit_courses)
export const getEquivalentCourses = (courseId: string, allCoursesData: RawCourseData[]): Set<string> => {
  const equivalents = new Set<string>([courseId]);
  const course = allCoursesData.find(c => c._id === courseId);
  
  if (course?.no_credit_courses) {
    // Split by comma or one or more whitespace characters, then trim any remaining whitespace from individual IDs
    const equivalentIds = course.no_credit_courses.split(/[,\s]+/).map(id => id.trim()).filter(id => id); // filter empty strings
    equivalentIds.forEach(id => equivalents.add(id));
  }
  
  return equivalents;
};

// Type for SAP-style prerequisite structures
interface SAPPrerequisiteGroup {
  and?: (PrerequisiteItem | PrerequisiteGroup)[];
  or?: (PrerequisiteItem | PrerequisiteGroup)[];
}

// Define the detailed status type
export type PrereqStatus = 'MET' | 'WARN_SAME_SEMESTER' | 'ERROR_LATER_SEMESTER' | 'ERROR_NOT_IN_PLAN';

// Helper to determine the priority of a status (lower number = higher priority/worse violation)
const getStatusPriority = (status: PrereqStatus): number => {
  switch (status) {
    case 'ERROR_NOT_IN_PLAN': return 0;
    case 'ERROR_LATER_SEMESTER': return 1;
    case 'WARN_SAME_SEMESTER': return 2;
    case 'MET': return 3;
    default: return 4; // Should not happen
  }
};

// Helper to get the highest priority status from a list of statuses
const getWorstStatus = (statuses: PrereqStatus[]): PrereqStatus => {
  if (!statuses.length) return 'MET'; // If list is empty, requirement is met by default?
  return statuses.reduce((worst, current) =>
    getStatusPriority(current) < getStatusPriority(worst) ? current : worst
  );
};

// Helper to get the lowest priority status from a list of statuses
const getBestStatus = (statuses: PrereqStatus[]): PrereqStatus => {
  if (!statuses.length) return 'ERROR_NOT_IN_PLAN'; // If list is empty, requirement cannot be met
  return statuses.reduce((best, current) =>
    getStatusPriority(current) > getStatusPriority(best) ? current : best
  );
};

/**
 * Checks the prerequisites for a target course, considering semester placement.
 * @returns PrereqStatus indicating if met, met but in same semester, violated (later semester), or violated (not in plan).
 */
export function checkPrerequisites(
  targetCourseData: RawCourseData,
  currentSemesterNumber: number,
  templateSemesters: Record<string, string[]>,
  allCoursesData: RawCourseData[],
  classificationChecked: Record<string, boolean>
): PrereqStatus { // Changed return type
  if (!targetCourseData?.prereqTree) {
    if (import.meta.env.DEV) {
       console.debug(`[checkPrerequisites] ${targetCourseData._id}: No prereqTree defined.`);
    }
    return 'MET'; // No prerequisites defined
  }

  const targetSemesterIndexForComparison = currentSemesterNumber - 1;
  const semesterKeys = Object.keys(templateSemesters);

  if (import.meta.env.DEV) {
    console.debug(`[checkPrerequisites] Checking prerequisites for ${targetCourseData._id} (in semester ${currentSemesterNumber}, index ${targetSemesterIndexForComparison})`);
  }

  // Recursive helper function - now returns PrereqStatus
  const checkGroup = (prereq: PrerequisiteItem | PrerequisiteGroup | SAPPrerequisiteGroup): PrereqStatus => {
    if (typeof prereq === 'string') { // Base case: simple course ID
      // Check classification courses (e.g., Miluim exemption)
      // TODO: Make these classification IDs configurable or load from data
      const classificationIds = ["01130013", "01130014", "miluim_exemption"];
      if (classificationIds.includes(prereq)) {
        const isChecked = classificationChecked[prereq] || false;
        if (import.meta.env.DEV) {
            console.debug(`  [checkGroup] Classification Prereq ${prereq}: checked: ${isChecked}`);
        }
        return isChecked ? 'MET' : 'ERROR_NOT_IN_PLAN';
      }

      // Regular prerequisite course logic
      let worstFoundStatus: PrereqStatus = 'ERROR_NOT_IN_PLAN'; // Assume not met initially
      if (import.meta.env.DEV) {
        console.debug(`    [checkGroup] Checking string prereq: '${prereq}' for target course in semester index ${targetSemesterIndexForComparison}`);
        // JSON.stringify for templateSemesters can be very large if logged for every string prereq.
        // Consider logging it once per checkPrerequisites call if needed, or only log relevant parts.
        // For now, let's avoid logging the full templateSemesters here to reduce console noise.
        // console.debug(`    [checkGroup] Plan semesters:`, JSON.parse(JSON.stringify(templateSemesters)));
      }

      for (let i = 0; i < semesterKeys.length; i++) {
        const semesterKey = semesterKeys[i];
        const currentSemesterPlanIndex = i; // This is the 0-indexed semester of the *potential* prerequisite
        const coursesInThisSemester = templateSemesters[semesterKey];
        if (import.meta.env.DEV) {
          console.debug(`      [checkGroup] Iterating plan semester index ${currentSemesterPlanIndex} ('${semesterKey}') for prereq '${prereq}'. Courses in this semester: [${coursesInThisSemester ? coursesInThisSemester.join(', ') : ''}]`);
        }

        if (!coursesInThisSemester) { // Guard against undefined semester course list
          if (import.meta.env.DEV) console.debug(`        [checkGroup] Semester '${semesterKey}' has no courses. Skipping.`);
          continue;
        }

        for (const placedCourseId of coursesInThisSemester) {
          const equivalentsOfPlacedCourse = getEquivalentCourses(placedCourseId, allCoursesData);
          const isMatch = equivalentsOfPlacedCourse.has(prereq as string); 
          if (import.meta.env.DEV) {
            console.debug(`        [checkGroup] Checking placed course '${placedCourseId}' (equivalents: [${Array.from(equivalentsOfPlacedCourse).join(', ')}]) against prereq '${prereq}'. Match: ${isMatch}`);
          }

          if (isMatch) {
            let currentMatchStatus: PrereqStatus;
            if (currentSemesterPlanIndex < targetSemesterIndexForComparison) {
              currentMatchStatus = 'MET';
            } else if (currentSemesterPlanIndex === targetSemesterIndexForComparison) {
              currentMatchStatus = 'WARN_SAME_SEMESTER';
            } else { // currentSemesterPlanIndex > targetSemesterIndexForComparison
              currentMatchStatus = 'ERROR_LATER_SEMESTER';
            }
            if (import.meta.env.DEV) {
              console.debug(`          [checkGroup] Match found for prereq '${prereq}' with placed course '${placedCourseId}'. Prereq semester index: ${currentSemesterPlanIndex}, Target course semester index: ${targetSemesterIndexForComparison}. Status for this match: ${currentMatchStatus}`);
            }

            if (worstFoundStatus === 'ERROR_NOT_IN_PLAN' || getStatusPriority(currentMatchStatus) < getStatusPriority(worstFoundStatus)) {
              worstFoundStatus = currentMatchStatus;
              if (import.meta.env.DEV) {
                console.debug(`            [checkGroup] Prereq '${prereq}': worstFoundStatus updated to ${worstFoundStatus}`);
              }
            }
          }
        }
      }
      
      if (import.meta.env.DEV) {
        // This log was already here, just ensuring it's clear
        console.debug(`  [checkPrerequisites] Prereq ${prereq}: Final worst status for this single prereq: ${worstFoundStatus}`);
      }
      return worstFoundStatus;

    } else if (prereq && typeof prereq === 'object') {
      // Handle {and: [...]}, {or: [...]}, and {type: 'all'|'one', list: [...]} logic
      let items: (PrerequisiteItem | PrerequisiteGroup | SAPPrerequisiteGroup)[] = [];
      let logic: 'and' | 'or' | 'unknown' = 'unknown';

      const sapPrereq = prereq as SAPPrerequisiteGroup;
      const groupPrereq = prereq as PrerequisiteGroup;

      if (Array.isArray(sapPrereq.and)) {
        items = sapPrereq.and;
        logic = 'and';
      } else if (Array.isArray(sapPrereq.or)) {
        items = sapPrereq.or;
        logic = 'or';
      } else if (Array.isArray(groupPrereq.list)) {
        items = groupPrereq.list as (PrerequisiteItem | PrerequisiteGroup | SAPPrerequisiteGroup)[]; // Cast needed
        if (groupPrereq.type === 'all') logic = 'and';
        else if (groupPrereq.type === 'one') logic = 'or';
        else {
           console.warn(`[checkPrerequisites] Unsupported group type: ${groupPrereq.type}`);
           return 'MET'; // Treat unknown types as met
        }
      }

      if (items.length > 0 && logic !== 'unknown') {
        const itemStatuses = items.map(item => checkGroup(item));
        if (logic === 'and') {
          const status = getWorstStatus(itemStatuses);
          if (import.meta.env.DEV) {
             console.debug(`  [checkPrerequisites] Group 'and': Result = ${status} (from ${itemStatuses.join(', ')})`);
          }
          return status;
        } else { // logic === 'or'
          const status = getBestStatus(itemStatuses);
           if (import.meta.env.DEV) {
             console.debug(`  [checkPrerequisites] Group 'or': Result = ${status} (from ${itemStatuses.join(', ')})`);
          }
          return status;
        }
      }

      console.warn('[checkPrerequisites] Malformed prerequisite structure:', prereq);
    }
    return 'MET'; // Fallback for malformed or unknown structure
  };

  const finalStatus = checkGroup(targetCourseData.prereqTree);
  if (import.meta.env.DEV) {
    console.debug(`[checkPrerequisites] Final Result for ${targetCourseData._id}: ${finalStatus}`);
  }
  return finalStatus;
}