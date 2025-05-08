import { DegreeRule, RawCourseData } from '../types/data';

export interface EvaluatedRuleStatus {
  currentProgressString: string;
  isSatisfied: boolean;
  // We can add more detailed progress info if needed, e.g., current_credits, required_credits
}

/**
 * Evaluates a single degree rule based on the current set of courses and their grades.
 */
export function evaluateRule(
  rule: DegreeRule,
  coursesInPlan: RawCourseData[], // List of RawCourseData objects currently in the student's plan
  grades: Record<string, string>, // courseId: grade string
  allCoursesData: RawCourseData[], // All available course data (for looking up details of courses in lists)
  degreeCourseLists?: Record<string, string[] | number[]> // Adjusted type
): EvaluatedRuleStatus {
  let currentProgressString = "N/A";
  let isSatisfied = false;

  // Helper to parse grade string to number, handling non-numeric/empty as 0 or NaN for checks
  const getNumericGrade = (courseId: string): number => {
    const gradeStr = grades[courseId];
    if (!gradeStr) return 0; // Or handle as ungraded differently, e.g. by not counting towards avg unless grade present
    const gradeNum = parseFloat(gradeStr);
    return isNaN(gradeNum) ? 0 : gradeNum; // Treat non-numeric grades as 0 for now
  };

  switch (rule.type) {
    case 'total_credits':
      if (rule.required_credits !== undefined) {
        const currentCredits = coursesInPlan.reduce((sum, course) => sum + course.credits, 0);
        currentProgressString = `${currentCredits}/${rule.required_credits} נ"ז`;
        isSatisfied = currentCredits >= rule.required_credits;
      }
      break;

    case 'minCredits':
      if (rule.min !== undefined) {
        const currentCredits = coursesInPlan.reduce((sum, course) => sum + (Number(course.credits) || 0), 0);
        currentProgressString = `${currentCredits}/${rule.min} נ"ז`;
        isSatisfied = currentCredits >= rule.min;
      } else {
        currentProgressString = "כלל 'minCredits' לא הוגדר כראוי (חסר 'min')";
      }
      break;

    case 'credits_from_list':
      if (rule.course_list_name && rule.required_credits !== undefined && degreeCourseLists && Array.isArray(degreeCourseLists[rule.course_list_name])) {
        const listCourseIds = degreeCourseLists[rule.course_list_name] as string[];
        const coursesFromListInPlan = coursesInPlan.filter(cp => listCourseIds.includes(cp._id));
        const currentCreditsFromList = coursesFromListInPlan.reduce((sum, course) => sum + course.credits, 0);
        currentProgressString = `${currentCreditsFromList}/${rule.required_credits} נ"ז מ${rule.course_list_name}`;
        isSatisfied = currentCreditsFromList >= rule.required_credits;
      } else {
        currentProgressString = `רשימת קורסים "${rule.course_list_name}" לא נמצאה או שחסר required_credits.`;
      }
      break;

    case 'minCoursesFromList':
      if (rule.listName && rule.min !== undefined && degreeCourseLists && Array.isArray(degreeCourseLists[rule.listName])) {
        const listCourseIds = degreeCourseLists[rule.listName] as string[];
        const coursesFromListInPlan = coursesInPlan.filter(cp => listCourseIds.includes(cp._id));
        const completedCoursesFromList = coursesFromListInPlan.length;
        currentProgressString = `${completedCoursesFromList}/${rule.min} קורסים מ${rule.listName}`;
        isSatisfied = completedCoursesFromList >= rule.min;
      } else {
        currentProgressString = `כלל 'minCoursesFromList' לא הוגדר כראוי (חסר listName, min, או שהרשימה לא קיימת).`;
      }
      break;
    
    case 'min_grade':
      // This rule type implies checking if a minimum grade was achieved in specific courses or all courses.
      // For simplicity, let's assume it means all courses in rule.courses_for_min_grade (if defined) must meet rule.min_grade_value.
      // If rule.courses_for_min_grade is undefined, it might mean all courses in the plan (too broad for now).
      if (rule.min_grade_value !== undefined && rule.courses_for_min_grade && rule.courses_for_min_grade.length > 0) {
        let coursesChecked = 0;
        let coursesPassedMinGrade = 0;
        rule.courses_for_min_grade.forEach(courseIdToCheck => {
          if (coursesInPlan.some(c => c._id === courseIdToCheck)) { // Check if course is in plan
            coursesChecked++;
            if (getNumericGrade(courseIdToCheck) >= (rule.min_grade_value || 0)) {
              coursesPassedMinGrade++;
            }
          }
        });
        if (coursesChecked > 0) {
          currentProgressString = `${coursesPassedMinGrade}/${coursesChecked} courses passed min grade ${rule.min_grade_value}`;
          isSatisfied = coursesPassedMinGrade === coursesChecked;
        } else {
          currentProgressString = `No specified courses for min grade found in plan.`;
        }        
      } else {
        currentProgressString = `Min grade rule not fully specified.`;
      }
      break;

    // TODO: Implement other rule types as needed (e.g., specific course completion, average grade rules)
    default:
      currentProgressString = `Rule type "${rule.type}" not implemented.`;
      break;
  }

  return { currentProgressString, isSatisfied };
} 