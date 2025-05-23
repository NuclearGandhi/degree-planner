import { DegreeRule, RawCourseData } from '../types/data';

export interface EvaluatedRuleStatus {
  currentProgressString: string;
  isSatisfied: boolean; // Overall satisfaction based on "done" courses
  // currentValue is now deprecated in favor of planned/done
  // currentValue: number | null; 
  currentValuePlanned: number | null; // Progress based on courses *in plan*
  currentValueDone: number | null;    // Progress based on courses *with grades*
  requiredValue: number | null; // Required numeric value for progress
  // Details for multi-list rules
  listProgressDetails?: { 
    listName: string; 
    currentValuePlanned: number; 
    currentValueDone: number;
    requiredValue: number; 
    isSatisfied: boolean; // Based on done courses 
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
  binaryStates: Record<string, boolean>, // ADDED: courseId: isBinary status
  // allCoursesData: RawCourseData[], // REMOVED - Was unused
  // templateSemesters: Record<string, string[]>, // REMOVED - Was unused
  degreeCourseLists?: Record<string, string[] | number[]>, // Adjusted type
  initialTemplateMandatoryCourseIds?: string[], // NEW: IDs from the original template's semester definition
  // New optional parameters for classification/exemption credits
  classificationChecked?: Record<string, boolean>,
  classificationCredits?: Record<string, number>
): EvaluatedRuleStatus {
  let currentProgressString = "N/A";
  let isSatisfied = false; // Based on *done* courses
  let currentValuePlanned: number | null = null;
  let currentValueDone: number | null = null;
  let requiredValue: number | null = null;
  let listProgressDetails: EvaluatedRuleStatus['listProgressDetails'] = null;

  // Helper to check if a course is considered "done" (has a non-empty grade OR is marked as binary)
  const isCourseDone = (courseId: string): boolean => {
    const gradeStr = grades[courseId];
    const isBinary = binaryStates[courseId] === true; // Check if binary flag is explicitly true
    const hasGrade = !!gradeStr && gradeStr.trim() !== '';
    return hasGrade || isBinary; // Course is done if it has a grade OR is marked as binary
  };

  // Helper to parse grade string to number, handling non-numeric/empty as 0 or NaN for checks
  const getNumericGrade = (courseId: string): number => {
    const gradeStr = grades[courseId];
    if (!gradeStr) return 0; // Or handle as ungraded differently, e.g. by not counting towards avg unless grade present
    const gradeNum = parseFloat(gradeStr);
    return isNaN(gradeNum) ? 0 : gradeNum; // Treat non-numeric grades as 0 for now
  };

  switch (rule.type) {
    // --- Rule Types involving Credits --- 
    case 'total_credits':
    case 'minCredits':
    case 'credits_from_list':
    case 'minCreditsFromMandatory':
    case 'minCreditsFromAnySelectiveList': {
      let reqValue: number | undefined = undefined;
      let coursesToConsider: RawCourseData[] = [];
      let descriptionSuffix = '';
      
      // Determine the required value and the list of courses to check based on rule type
      if (rule.type === 'total_credits') reqValue = rule.required_credits;
      if (rule.type === 'minCredits') reqValue = rule.min;
      if (rule.type === 'credits_from_list') reqValue = rule.required_credits;
      if (rule.type === 'minCreditsFromMandatory') reqValue = rule.min;
      if (rule.type === 'minCreditsFromAnySelectiveList') reqValue = rule.min;
      
      if (reqValue === undefined) {
        currentProgressString = `כלל '${rule.type}' לא הוגדר כראוי (חסר ערך נדרש).`;
        break;
      }
      requiredValue = reqValue;

      // Determine the subset of courses to evaluate based on the rule type
      if (rule.type === 'total_credits' || rule.type === 'minCredits') {
        coursesToConsider = coursesInPlan; // Consider all courses in the plan
      } else if (rule.type === 'credits_from_list' && rule.course_list_name && degreeCourseLists && Array.isArray(degreeCourseLists[rule.course_list_name])) {
        const listIds = degreeCourseLists[rule.course_list_name] as string[];
        coursesToConsider = coursesInPlan.filter(cp => listIds.includes(cp._id));
        descriptionSuffix = ` מ${rule.course_list_name}`;
      } else if (rule.type === 'minCreditsFromMandatory') {
        if (import.meta.env.DEV) {
          console.debug(`[evaluateRule DEBUG] Evaluating 'minCreditsFromMandatory' for rule: "${rule.description || rule.id}"`);
          console.debug(`[evaluateRule DEBUG]   Received initialTemplateMandatoryCourseIds (effectiveMandatoryCourseIds):`, initialTemplateMandatoryCourseIds ? [...initialTemplateMandatoryCourseIds] : 'undefined/empty');
          console.debug(`[evaluateRule DEBUG]   Received coursesInPlan (IDs from current semesters):`, coursesInPlan.map(c => c._id));
        }
        if (initialTemplateMandatoryCourseIds && Array.isArray(initialTemplateMandatoryCourseIds)) {
          const mandatoryIds = new Set(initialTemplateMandatoryCourseIds);
          coursesToConsider = coursesInPlan.filter(cp => mandatoryIds.has(cp._id));
          if (import.meta.env.DEV) {
            console.debug('[evaluateRule DEBUG]   Filtered coursesToConsider (in plan AND in mandatory list):', coursesToConsider.map(c => ({ id: c._id, name: c.name, credits: c.credits })));
          }
          descriptionSuffix = ''; // Removed " (חובה)"
        } else {
          // If no mandatory courses are defined, this rule can't be satisfied by taking mandatory courses.
          // Or, it could be considered trivially satisfied if 0 are required. For now, treat as 0 progress.
          coursesToConsider = []; 
          descriptionSuffix = ' (רשימה לא מוגדרת)';
        }
      } else if (rule.type === 'minCreditsFromAnySelectiveList' && degreeCourseLists) {
        const selectiveIds = new Set<string>();
        Object.entries(degreeCourseLists).forEach(([, list]) => {
          if (Array.isArray(list) && list.every(item => typeof item === 'string')) {
            (list as string[]).forEach(id => selectiveIds.add(id));
          }
        });
        coursesToConsider = coursesInPlan.filter(cp => selectiveIds.has(cp._id));
        descriptionSuffix = ` (בחירה)`;
      } else {
        currentProgressString = `כלל '${rule.type}' לא הוגדר כראוי (בעיה ברשימת הקורסים).`;
        break;
      }

      // Calculate Planned and Done credits from the relevant subset
      currentValuePlanned = coursesToConsider.reduce((sum, course) => sum + (Number(course.credits) || 0), 0);
      currentValueDone = coursesToConsider
        .filter(course => isCourseDone(course._id))
        .reduce((sum, course) => sum + (Number(course.credits) || 0), 0);

      if (import.meta.env.DEV && (rule.type === 'minCreditsFromMandatory' || rule.type === 'total_credits')) { // Also log for total_credits for comparison
        console.debug(`[evaluateRule DEBUG] For rule "${rule.description || rule.id}" (${rule.type}):`);
        console.debug(`[evaluateRule DEBUG]   coursesToConsider for sum (IDs):`, coursesToConsider.map(c=>c._id));
        console.debug(`[evaluateRule DEBUG]   Calculated currentValuePlanned: ${currentValuePlanned}`);
        console.debug(`[evaluateRule DEBUG]   Calculated currentValueDone: ${currentValueDone}`);
        console.debug(`[evaluateRule DEBUG]   RequiredValue: ${requiredValue}`);
      }

      // Special handling for total_credits to include classification exemptions
      let doneCreditsWithExemptions = currentValueDone;
      if (rule.type === 'total_credits' && classificationChecked && classificationCredits) {
        if (classificationChecked['miluim_exemption'] && typeof classificationCredits['miluim_exemption'] === 'number') {
          doneCreditsWithExemptions += classificationCredits['miluim_exemption'];
          // Also add to planned credits if it's an exemption that counts towards the total
          currentValuePlanned += classificationCredits['miluim_exemption'];
        }
        // Add other classification credits if needed
      }
      
      // Update satisfaction based on *done* credits (including exemptions for total_credits)
      isSatisfied = doneCreditsWithExemptions >= requiredValue;
      // Progress string shows DONE / REQUIRED (can be adapted later if needed)
      currentProgressString = `${doneCreditsWithExemptions}/${requiredValue}${descriptionSuffix} נק"ז (מתוכנן: ${currentValuePlanned})`;
      // Ensure Planned is never less than Done, especially with exemptions
      currentValuePlanned = Math.max(currentValuePlanned, doneCreditsWithExemptions); 
      
      // Use doneCreditsWithExemptions for currentValueDone ONLY for total_credits rule
      // For other credit rules, exemption credits shouldn't count towards list/mandatory/selective done totals.
      if (rule.type !== 'total_credits') {
           currentValueDone = coursesToConsider
            .filter(course => isCourseDone(course._id))
            .reduce((sum, course) => sum + (Number(course.credits) || 0), 0);
           isSatisfied = currentValueDone >= requiredValue;
           currentProgressString = `${currentValueDone}/${requiredValue}${descriptionSuffix} נק"ז (מתוכנן: ${currentValuePlanned})`;
      }
      
      break;
    }

    // --- Rule Types involving Course Counts --- 
    case 'minCoursesFromList': {
      const unit = 'קורסים'; // Define unit for this scope
      if (rule.listName && rule.min !== undefined && degreeCourseLists && Array.isArray(degreeCourseLists[rule.listName])) {
        const listCourseIds = degreeCourseLists[rule.listName] as string[];
        const coursesFromListInPlan = coursesInPlan.filter(cp => listCourseIds.includes(cp._id));
        
        requiredValue = rule.min;
        currentValuePlanned = coursesFromListInPlan.length;
        currentValueDone = coursesFromListInPlan.filter(cp => isCourseDone(cp._id)).length;
        isSatisfied = currentValueDone >= requiredValue;
        currentProgressString = `${currentValueDone}/${requiredValue} ${unit} מ${rule.listName} (מתוכנן: ${currentValuePlanned})`;
      } else {
        currentProgressString = `כלל 'minCoursesFromList' לא הוגדר כראוי.`;
      }
      break;
    }

    case 'minCoursesFromMultipleLists': {
      if (rule.lists && Array.isArray(rule.lists) && degreeCourseLists) {
        let overallSatisfied = true;
        const progressStrings: string[] = [];
        const detailsArray: NonNullable<EvaluatedRuleStatus['listProgressDetails']> = [];
        currentValuePlanned = null; // Not applicable for parent rule
        currentValueDone = null;    // Not applicable for parent rule
        requiredValue = null;     // Not applicable for parent rule

        rule.lists.forEach(listRule => {
          const { listName, min } = listRule;
          let listCurrentPlanned = 0;
          let listCurrentDone = 0;
          let listSatisfied = false;
          let listProgressText = `${listName}: שגיאה`;
          
          if (listName && min !== undefined && Array.isArray(degreeCourseLists[listName])) {
            const listCourseIds = degreeCourseLists[listName] as string[];
            const coursesFromListInPlan = coursesInPlan.filter(cp => listCourseIds.includes(cp._id));
            listCurrentPlanned = coursesFromListInPlan.length;
            listCurrentDone = coursesFromListInPlan.filter(cp => isCourseDone(cp._id)).length;
            listSatisfied = listCurrentDone >= min;
            listProgressText = `${listName}: ${listCurrentDone}/${min} (מתוכנן: ${listCurrentPlanned})`;
            detailsArray.push({ listName, currentValuePlanned: listCurrentPlanned, currentValueDone: listCurrentDone, requiredValue: min, isSatisfied: listSatisfied });
          } else {
            detailsArray.push({ listName: listName || 'לא ידוע', currentValuePlanned: 0, currentValueDone: 0, requiredValue: min || 0, isSatisfied: false });
            listSatisfied = false; 
          }
          progressStrings.push(listProgressText);
          
          if (!listSatisfied) {
            overallSatisfied = false;
          }
        });

        currentProgressString = progressStrings.join(' | '); 
        isSatisfied = overallSatisfied;
        listProgressDetails = detailsArray;
      } else {
        currentProgressString = `כלל 'minCoursesFromMultipleLists' לא הוגדר כראוי.`;
      }
      break;
    }
    
    // --- Other Rule Types (Keep as is for now or adapt if needed) ---
    case 'min_grade': {
      // This rule checks grades of *done* courses. Logic likely remains the same.
      if (rule.min_grade_value !== undefined && rule.courses_for_min_grade && rule.courses_for_min_grade.length > 0) {
        let coursesChecked = 0;
        let coursesPassedMinGrade = 0;
        rule.courses_for_min_grade.forEach(courseIdToCheck => {
          // Only check if the course is actually DONE
          if (isCourseDone(courseIdToCheck)) { 
            coursesChecked++;
            if (getNumericGrade(courseIdToCheck) >= (rule.min_grade_value || 0)) {
              coursesPassedMinGrade++;
            }
          }
        });
        if (coursesChecked > 0) {
          // For this rule, currentValue represents passed count, not planned/done distinction
          currentValuePlanned = coursesPassedMinGrade; 
          currentValueDone = coursesPassedMinGrade;
          requiredValue = coursesChecked; // Required is the number of *done* courses that should pass
          currentProgressString = `${currentValueDone}/${requiredValue} עברו ציון ${rule.min_grade_value}`;
          isSatisfied = currentValueDone === requiredValue;
        } else {
          currentProgressString = `אין קורסים רלוונטיים שהושלמו.`;
          isSatisfied = true; // Arguably, if none are done, the condition isn't violated
          currentValuePlanned = 0;
          currentValueDone = 0;
          requiredValue = 0;
        }        
      } else {
        currentProgressString = `כלל ציון מינימום לא הוגדר כראוי.`;
      }
      break;
    }

    // TODO: Implement other rule types as needed (e.g., specific course completion, average grade rules)
    default:
      currentProgressString = `Rule type "${rule.type}" not implemented.`;
      break;
  }

  return { 
    currentProgressString, 
    isSatisfied, 
    // currentValue: currentValueDone, // Keep this potentially for backward compat or simple displays? Or remove fully.
    currentValuePlanned,
    currentValueDone,
    requiredValue, 
    listProgressDetails 
  }; 
} 