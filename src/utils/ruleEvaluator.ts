import { DegreeRule, RawCourseData } from '../types/data';

export interface EvaluatedRuleStatus {
  currentProgressString: string;
  isSatisfied: boolean;
  currentValue: number | null; // Current numeric value for progress
  requiredValue: number | null; // Required numeric value for progress
  // Details for multi-list rules
  listProgressDetails?: { 
    listName: string; 
    currentValue: number; 
    requiredValue: number; 
    isSatisfied: boolean; 
  }[] | null; 
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
  templateSemesters: Record<string, string[]>, // Mandatory courses from template (CURRENTLY LIVE SEMESTERS, used by other rules perhaps)
  degreeCourseLists?: Record<string, string[] | number[]>, // Adjusted type
  initialTemplateMandatoryCourseIds?: string[] // NEW: IDs from the original template's semester definition
): EvaluatedRuleStatus {
  let currentProgressString = "N/A";
  let isSatisfied = false;
  let currentValue: number | null = null;
  let requiredValue: number | null = null;
  let listProgressDetails: EvaluatedRuleStatus['listProgressDetails'] = null; // Initialize new property

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
        currentValue = currentCredits;
        requiredValue = rule.required_credits;
        currentProgressString = `${currentValue}/${requiredValue} נק"ז`;
        isSatisfied = currentValue >= requiredValue;
      }
      break;

    case 'minCredits':
      if (rule.min !== undefined) {
        const currentCredits = coursesInPlan.reduce((sum, course) => sum + (Number(course.credits) || 0), 0);
        currentValue = currentCredits;
        requiredValue = rule.min;
        currentProgressString = `${currentValue}/${requiredValue} נק"ז`;
        isSatisfied = currentValue >= requiredValue;
      } else {
        currentProgressString = "כלל 'minCredits' לא הוגדר כראוי (חסר 'min')";
      }
      break;

    case 'credits_from_list':
      if (rule.course_list_name && rule.required_credits !== undefined && degreeCourseLists && Array.isArray(degreeCourseLists[rule.course_list_name])) {
        const listCourseIds = degreeCourseLists[rule.course_list_name] as string[];
        const coursesFromListInPlan = coursesInPlan.filter(cp => listCourseIds.includes(cp._id));
        const currentCreditsFromList = coursesFromListInPlan.reduce((sum, course) => sum + course.credits, 0);
        currentValue = currentCreditsFromList;
        requiredValue = rule.required_credits;
        currentProgressString = `${currentValue}/${requiredValue} נק"ז מ${rule.course_list_name}`;
        isSatisfied = currentValue >= requiredValue;
      } else {
        currentProgressString = `רשימת קורסים "${rule.course_list_name}" לא נמצאה או שחסר required_credits.`;
      }
      break;

    case 'minCoursesFromList':
      if (rule.listName && rule.min !== undefined && degreeCourseLists && Array.isArray(degreeCourseLists[rule.listName])) {
        const listCourseIds = degreeCourseLists[rule.listName] as string[];
        const coursesFromListInPlan = coursesInPlan.filter(cp => listCourseIds.includes(cp._id));
        currentValue = coursesFromListInPlan.length;
        requiredValue = rule.min;
        currentProgressString = `${currentValue}/${requiredValue} קורסים מ${rule.listName}`;
        isSatisfied = currentValue >= requiredValue;
      } else {
        currentProgressString = `כלל 'minCoursesFromList' לא הוגדר כראוי (חסר listName, min, או שהרשימה לא קיימת).`;
      }
      break;

    case 'minCoursesFromMultipleLists':
      if (rule.lists && Array.isArray(rule.lists) && degreeCourseLists) {
        let overallSatisfied = true;
        const progressStrings: string[] = [];
        const detailsArray: NonNullable<EvaluatedRuleStatus['listProgressDetails']> = [];
        // Set single numeric values to null as they don't represent this combined rule
        currentValue = null; 
        requiredValue = null;

        rule.lists.forEach(listRule => {
          const { listName, min } = listRule;
          let currentCompleted = 0;
          let listSatisfied = false;
          let listProgressText = `${listName}: שגיאה`; // Default text in case of error
          
          if (listName && min !== undefined && Array.isArray(degreeCourseLists[listName])) {
            const listCourseIds = degreeCourseLists[listName] as string[];
            const coursesFromListInPlan = coursesInPlan.filter(cp => listCourseIds.includes(cp._id));
            currentCompleted = coursesFromListInPlan.length;
            listSatisfied = currentCompleted >= min;
            listProgressText = `${listName}: ${currentCompleted}/${min}`;
            detailsArray.push({ listName, currentValue: currentCompleted, requiredValue: min, isSatisfied: listSatisfied });
          } else {
            // Add detail with error state if list definition is problematic
            detailsArray.push({ listName: listName || 'לא ידוע', currentValue: 0, requiredValue: min || 0, isSatisfied: false });
            listSatisfied = false; 
          }
          progressStrings.push(listProgressText); // Add text part for overall string
          
          if (!listSatisfied) {
            overallSatisfied = false;
          }
        });

        currentProgressString = progressStrings.join(' | '); 
        isSatisfied = overallSatisfied;
        listProgressDetails = detailsArray; // Assign the detailed array

      } else {
        currentProgressString = `כלל 'minCoursesFromMultipleLists' לא הוגדר כראוי (חסר 'lists').`;
      }
      break;

    case 'minCreditsFromMandatory':
      if (rule.min !== undefined && initialTemplateMandatoryCourseIds) {
        const mandatoryCourseIds = new Set(initialTemplateMandatoryCourseIds);
        const mandatoryCoursesActuallyInPlan = coursesInPlan.filter(cp => mandatoryCourseIds.has(cp._id));
        currentValue = mandatoryCoursesActuallyInPlan.reduce((sum, course) => sum + (Number(course.credits) || 0), 0);
        requiredValue = rule.min;
        currentProgressString = `${currentValue}/${requiredValue} נק"ז (חובה)`;
        isSatisfied = currentValue >= requiredValue;
      } else {
        currentProgressString = "כלל 'minCreditsFromMandatory' לא הוגדר כראוי (חסר 'min' או הגדרת קורסי חובה ראשונית).";
      }
      break;

    case 'minCreditsFromAnySelectiveList':
      if (rule.min !== undefined && degreeCourseLists) {
        const selectiveCourseIds = new Set<string>();
        Object.entries(degreeCourseLists).forEach(([, list]) => { // Ignore key
          // Assuming actual lists are arrays of strings (course IDs) and ignoring others like 'must-take-min-num-of-courses'
          if (Array.isArray(list) && list.every(item => typeof item === 'string')) {
            (list as string[]).forEach(id => selectiveCourseIds.add(id));
          }
        });
        const selectiveCoursesInPlan = coursesInPlan.filter(cp => selectiveCourseIds.has(cp._id));
        currentValue = selectiveCoursesInPlan.reduce((sum, course) => sum + (Number(course.credits) || 0), 0);
        requiredValue = rule.min;
        currentProgressString = `${currentValue}/${requiredValue} נק"ז (בחירה)`;
        isSatisfied = currentValue >= requiredValue;
      } else {
        currentProgressString = "כלל 'minCreditsFromAnySelectiveList' לא הוגדר כראוי.";
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
          currentValue = coursesPassedMinGrade;
          requiredValue = coursesChecked;
          currentProgressString = `${currentValue}/${requiredValue} courses passed min grade ${rule.min_grade_value}`;
          isSatisfied = currentValue === requiredValue;
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

  return { currentProgressString, isSatisfied, currentValue, requiredValue, listProgressDetails }; // Return new property
} 