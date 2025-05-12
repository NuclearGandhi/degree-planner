import { RawCourseData } from "../types/data";

/**
 * Calculates the weighted average grade.
 * @param courses Courses included in the average (must have credits).
 * @param grades Map of courseId to grade string.
 * @returns The weighted average, or null if no valid graded courses found.
 */
export function calculateWeightedAverage(
    courses: RawCourseData[], 
    grades: Record<string, string>
): number | null {
    let totalPoints = 0;
    let totalCredits = 0;

    courses.forEach(course => {
        const gradeStr = grades[course._id];
        // Explicitly convert credits to a number and check if it's valid and positive
        const creditsNum = Number(course.credits);

        // Ensure gradeStr exists, is not empty, credits are valid positive numbers
        if (gradeStr !== undefined && gradeStr !== '' && !isNaN(creditsNum) && creditsNum > 0) {
            // Try parsing grade as an integer
            const gradeNum = parseInt(gradeStr, 10);
            // Check if grade is a valid integer AND within the 0-100 range
            if (!isNaN(gradeNum) && Number.isInteger(gradeNum) && gradeNum >= 0 && gradeNum <= 100) {
                // Use the numeric credits value in calculations
                totalPoints += gradeNum * creditsNum; 
                totalCredits += creditsNum;
            }
            // Ignore grades that are not integers between 0 and 100, or non-numeric grades.
        }
        // Also ignore courses with invalid or non-positive credits
    });

    if (totalCredits === 0) {
        return null; // Avoid division by zero
    }

    return totalPoints / totalCredits;
}

// Define a return type for clarity
interface SemesterCalculationResult {
    average: number | null;
    totalCredits: number;
}

/**
 * Calculates averages for each semester and the overall average.
 * @param template The current degree template with semester structure.
 * @param allCoursesData All course data for lookups.
 * @param grades Map of courseId to grade string.
 * @returns Object containing overallAverage and semesterAverages map, or nulls if not applicable.
 */
export function calculateAllAverages(
    template: { semesters: Record<string, string[]> } | undefined,
    allCoursesData: RawCourseData[],
    grades: Record<string, string>
): {
    overallAverage: number | null;
    // Updated semesterAverages to hold more data
    semesterCalculations: Record<string, SemesterCalculationResult>;
} {
    // Changed name for clarity
    const semesterCalculations: Record<string, SemesterCalculationResult> = {};
    let allCoursesInPlan: RawCourseData[] = [];

    if (!Array.isArray(allCoursesData)) {
        console.warn("Data Input Warning (calculateAllAverages): allCoursesData is not an array!", allCoursesData);
        return { overallAverage: null, semesterCalculations: {} };
    }

    if (template && typeof template.semesters === 'object' && template.semesters !== null) {
        Object.entries(template.semesters).forEach(([semesterKey, courseIds]) => {
            const coursesInSemester = (courseIds as string[])
                .map(id => allCoursesData.find(c => c._id === id))
                .filter(Boolean) as RawCourseData[];
            
            // Calculate weighted average for the semester (only graded courses)
            const semesterAverage = calculateWeightedAverage(coursesInSemester, grades);
            
            // Calculate total credits for *all* courses in the semester
            const semesterTotalCredits = coursesInSemester.reduce((sum, course) => {
                // Ensure credits is treated as a number, default to 0 if invalid/missing
                const credits = Number(course.credits);
                return sum + (isNaN(credits) ? 0 : credits);
            }, 0);

            // Store both average and total credits
            semesterCalculations[semesterKey] = {
                average: semesterAverage,
                totalCredits: semesterTotalCredits
            };
            
            allCoursesInPlan = allCoursesInPlan.concat(coursesInSemester);
        });
    } else if (template) {
        console.warn("Data Structure Warning (calculateAllAverages): template.semesters is not a valid object!", template.semesters);
    }

    const overallAverage = calculateWeightedAverage(allCoursesInPlan, grades);

    return { overallAverage, semesterCalculations }; // Updated return key
} 