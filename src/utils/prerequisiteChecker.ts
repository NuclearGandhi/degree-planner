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
  if (!targetCourseData?.prerequisites) {
    return true; // No prerequisites defined
  }

  const targetSemesterIndex = getSemesterIndex(targetCourseId, templateSemesters);
  if (targetSemesterIndex === -1) {
    // Course itself not found in the plan structure? Should not happen in this flow.
    console.warn(`[checkPrerequisites] Target course ${targetCourseId} not found in semesters.`);
    return true; // Assume ok if target placement is unclear
  }

  // Recursive helper function
  const checkGroup = (prereq: PrerequisiteItem | PrerequisiteGroup): boolean => {
    if (typeof prereq === 'string') { // Base case: simple course ID
      const prereqSemesterIndex = getSemesterIndex(prereq, templateSemesters);
      // Met if prereq is found AND in an earlier semester (lower index)
      return prereqSemesterIndex !== -1 && prereqSemesterIndex < targetSemesterIndex;
    } else if (prereq && typeof prereq === 'object' && Array.isArray((prereq as PrerequisiteGroup).list)) {
      const group = prereq as PrerequisiteGroup;
      switch (group.type) {
        case 'all':
          return group.list.every(item => checkGroup(item));
        case 'one':
          return group.list.some(item => checkGroup(item));
        // Add cases for other types like 'at_least_X_credits_from_list' if needed
        default:
          console.warn(`[checkPrerequisites] Unsupported group type: ${group.type}`);
          return true; // Treat unknown types as met
      }
    } else if (prereq) {
        console.warn('[checkPrerequisites] Malformed prerequisite structure:', prereq);
    }
    return true; // Fallback for malformed or unknown structure
  };

  return checkGroup(targetCourseData.prerequisites);
} 