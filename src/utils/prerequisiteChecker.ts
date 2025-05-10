import { PrerequisiteItem, PrerequisiteGroup, RawCourseData } from '../types/data';

// Helper to get the semester index (0-based) a course is in, or -1 if not found
// IMPORTANT: This relies on the ORDER of semesters in Object.entries, which might not be guaranteed.
// A more robust solution would involve parsing semester names or using numeric keys.
const getSemesterIndex = (
  courseId: string,
  semesters: Record<string, string[]>
): number => {
  const entry = Object.entries(semesters).find(([, courses]) => courses.includes(courseId));
  if (!entry) return -1; // Course not found
  return Object.keys(semesters).findIndex(key => key === entry[0]);
};

// Helper to get equivalent courses (including no_additional_credit_courses)
const getEquivalentCourses = (courseId: string, allCoursesData: RawCourseData[]): Set<string> => {
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

/**
 * Checks if the prerequisites for a target course are met based on semester placement.
 * @param targetCourseId The ID of the course whose prerequisites are being checked.
 * @param templateSemesters The semester structure from the degree template.
 * @param allCoursesData Full course data list to look up prerequisites.
 * @returns `true` if prerequisites are met or undefined, `false` otherwise.
 */
export function checkPrerequisites(
  targetCourseId: string,
  templateSemesters: Record<string, string[]>,
  allCoursesData: RawCourseData[]
): boolean {
  const targetCourseData = allCoursesData.find(c => c._id === targetCourseId);
  if (!targetCourseData?.prereqTree) {
    if (import.meta.env.DEV) {
      console.debug(`[checkPrerequisites] ${targetCourseId}: No prereqTree defined.`);
    }
    return true; // No prerequisites defined
  }

  const targetSemesterIndex = getSemesterIndex(targetCourseId, templateSemesters);
  if (targetSemesterIndex === -1) {
    console.warn(`[checkPrerequisites] Target course ${targetCourseId} not found in semesters.`);
    return true; // Assume ok if target placement is unclear
  }
  if (import.meta.env.DEV) {
    console.debug(`[checkPrerequisites] Checking prerequisites for ${targetCourseId} (semester ${targetSemesterIndex + 1})`);
  }

  // Recursive helper function
  const checkGroup = (prereq: PrerequisiteItem | PrerequisiteGroup | SAPPrerequisiteGroup): boolean => {
    if (typeof prereq === 'string') { // Base case: simple course ID
      const equivalentCourses = getEquivalentCourses(prereq, allCoursesData);
      let met = false;
      
      // Check if any equivalent course is in a valid semester
      for (const courseId of equivalentCourses) {
        const prereqSemesterIndex = getSemesterIndex(courseId, templateSemesters);
        if (prereqSemesterIndex !== -1 && prereqSemesterIndex <= targetSemesterIndex) {
          met = true;
          break;
        }
      }
      
      if (import.meta.env.DEV) {
        console.debug(`  [checkPrerequisites] Prereq ${prereq} (and equivalents): met: ${met}`);
      }
      return met;
    } else if (prereq && typeof prereq === 'object') {
      // Support for {and: [...]}, {or: [...]}
      const sapPrereq = prereq as SAPPrerequisiteGroup;
      if (Array.isArray(sapPrereq.and)) {
        const allMet = sapPrereq.and.every(item => checkGroup(item));
        if (import.meta.env.DEV) {
          console.debug(`  [checkPrerequisites] Group 'and': met: ${allMet}`);
        }
        return allMet;
      }
      if (Array.isArray(sapPrereq.or)) {
        const oneMet = sapPrereq.or.some(item => checkGroup(item));
        if (import.meta.env.DEV) {
          console.debug(`  [checkPrerequisites] Group 'or': met: ${oneMet}`);
        }
        return oneMet;
      }
      // Existing support for { type: 'all' | 'one', list: [...] }
      const group = prereq as PrerequisiteGroup;
      if (Array.isArray(group.list)) {
        switch (group.type) {
          case 'all': {
            const allMet = group.list.every(item => checkGroup(item));
            if (import.meta.env.DEV) {
              console.debug(`  [checkPrerequisites] Group 'all': met: ${allMet}`);
            }
            return allMet;
          }
          case 'one': {
            const oneMet = group.list.some(item => checkGroup(item));
            if (import.meta.env.DEV) {
              console.debug(`  [checkPrerequisites] Group 'one': met: ${oneMet}`);
            }
            return oneMet;
          }
          default:
            console.warn(`[checkPrerequisites] Unsupported group type: ${group.type}`);
            return true; // Treat unknown types as met
        }
      }
      // If we get here, it's still malformed
      console.warn('[checkPrerequisites] Malformed prerequisite structure:', prereq);
    }
    return true; // Fallback for malformed or unknown structure
  };

  const result = checkGroup(targetCourseData.prereqTree);
  if (import.meta.env.DEV) {
    console.debug(`[checkPrerequisites] Result for ${targetCourseId}: ${result}`);
  }
  return result;
} 