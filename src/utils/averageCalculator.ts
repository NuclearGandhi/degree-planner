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
        if (gradeStr !== undefined && gradeStr !== '' && course.credits > 0) {
            const gradeNum = parseFloat(gradeStr);
            // Only include valid numeric grades and courses with credits > 0 in the average
            if (!isNaN(gradeNum)) {
                totalPoints += gradeNum * course.credits;
                totalCredits += course.credits;
            }
            // Decide how to handle non-numeric grades (e.g., "Pass", "Fail") - currently ignored
        }
    });

    if (totalCredits === 0) {
        return null; // Avoid division by zero
    }

    return totalPoints / totalCredits;
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
    semesterAverages: Record<string, number | null>;
} {
    const semesterAverages: Record<string, number | null> = {};
    let allCoursesInPlan: RawCourseData[] = [];

    if (!Array.isArray(allCoursesData)) {
        console.warn("Data Input Warning (calculateAllAverages): allCoursesData is not an array!", allCoursesData);
        return { overallAverage: null, semesterAverages: {} };
    }

    if (template && typeof template.semesters === 'object' && template.semesters !== null) {
        Object.entries(template.semesters).forEach(([semesterKey, courseIds]) => {
            const coursesInSemester = (courseIds as string[])
                .map(id => allCoursesData.find(c => c._id === id))
                .filter(Boolean) as RawCourseData[];
            
            semesterAverages[semesterKey] = calculateWeightedAverage(coursesInSemester, grades);
            allCoursesInPlan = allCoursesInPlan.concat(coursesInSemester);
        });
    } else if (template) {
        console.warn("Data Structure Warning (calculateAllAverages): template.semesters is not a valid object!", template.semesters);
    }

    const overallAverage = calculateWeightedAverage(allCoursesInPlan, grades);

    return { overallAverage, semesterAverages };
} 