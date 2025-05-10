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
    console.log(`[checkPrerequisites] ${targetCourseId}: No prereqTree defined.`);
    return true; // No prerequisites defined
  }

  const targetSemesterIndex = getSemesterIndex(targetCourseId, templateSemesters);
  if (targetSemesterIndex === -1) {
    console.warn(`[checkPrerequisites] Target course ${targetCourseId} not found in semesters.`);
    return true; // Assume ok if target placement is unclear
  }
  console.log(`[checkPrerequisites] Checking prerequisites for ${targetCourseId} (semester ${targetSemesterIndex + 1})`);

  // Recursive helper function
  const checkGroup = (prereq: PrerequisiteItem | PrerequisiteGroup): boolean => {
    if (typeof prereq === 'string') { // Base case: simple course ID
      const prereqSemesterIndex = getSemesterIndex(prereq, templateSemesters);
      const met = prereqSemesterIndex !== -1 && prereqSemesterIndex <= targetSemesterIndex;
      console.log(`  [checkPrerequisites] Prereq ${prereq}: in semester ${prereqSemesterIndex + 1}, met: ${met}`);
      return met;
    } else if (prereq && typeof prereq === 'object') {
      // Support for {and: [...]}, {or: [...]}
      if (Array.isArray((prereq as any).and)) {
        const allMet = (prereq as any).and.every(item => checkGroup(item));
        console.log(`  [checkPrerequisites] Group 'and': met: ${allMet}`);
        return allMet;
      }
      if (Array.isArray((prereq as any).or)) {
        const oneMet = (prereq as any).or.some(item => checkGroup(item));
        console.log(`  [checkPrerequisites] Group 'or': met: ${oneMet}`);
        return oneMet;
      }
      // Existing support for { type: 'all' | 'one', list: [...] }
      if (Array.isArray((prereq as PrerequisiteGroup).list)) {
        const group = prereq as PrerequisiteGroup;
        switch (group.type) {
          case 'all': {
            const allMet = group.list.every(item => checkGroup(item));
            console.log(`  [checkPrerequisites] Group 'all': met: ${allMet}`);
            return allMet;
          }
          case 'one': {
            const oneMet = group.list.some(item => checkGroup(item));
            console.log(`  [checkPrerequisites] Group 'one': met: ${oneMet}`);
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
  console.log(`[checkPrerequisites] Result for ${targetCourseId}: ${result}`);
  return result;
} 