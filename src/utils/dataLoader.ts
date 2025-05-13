import { DegreesFileStructure, RawCourseData, DegreeTemplate } from '../types/data';

const DATA_BASE_PATH = '/data'; // Assuming files are in public/data

export async function fetchAllCourses(): Promise<RawCourseData[]> {
  try {
    const response = await fetch(`${DATA_BASE_PATH}/merged_courses.json`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    // Check if data is an object (keyed by course ID)
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      // Map object entries to an array, adding the key as _id
      const coursesArray: RawCourseData[] = Object.entries(data).map(([id, courseDetails]) => ({
        _id: id, 
        ...(courseDetails as Omit<RawCourseData, '_id'>) 
      } as RawCourseData));
      return coursesArray;
    } else if (Array.isArray(data)) {
       // If it was somehow already an array, assume it has _id (or log warning)
       console.warn('[fetchAllCourses] Received an array, expected object. Assuming array items have _id.');
       return data as RawCourseData[];
    }

    // Fallback or handle unexpected data structure
    console.error('[fetchAllCourses] Unexpected data structure received:', data);
    return []; // Return empty array on unexpected structure

  } catch (error) {
    console.error("Failed to fetch courses:", error);
    return []; 
  }
}

export async function fetchDegreeTemplates(): Promise<DegreesFileStructure> {
  try {
    const response = await fetch(`${DATA_BASE_PATH}/degrees.json`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data as DegreesFileStructure;
  } catch (error) {
    console.error("Failed to fetch degree templates:", error);
    return {}; // Return empty object on error
  }
}

// Example utility: Get a specific degree template by ID
export async function getDegreeTemplateById(degreeId: string): Promise<DegreeTemplate | undefined> {
  const templates = await fetchDegreeTemplates();
  // Ensure we don't accidentally try to return globalRules as a DegreeTemplate
  if (degreeId === 'globalRules') {
    return undefined;
  }
  const potentialTemplate = templates[degreeId];
  // Basic check to see if it looks like a DegreeTemplate
  if (potentialTemplate && typeof potentialTemplate === 'object' && 'semesters' in potentialTemplate && !Array.isArray(potentialTemplate)) {
    return potentialTemplate as DegreeTemplate;
  }
  return undefined;
}

// Example utility: Get a specific course by ID
export async function getCourseById(courseId: string): Promise<RawCourseData | undefined> {
  const courses = await fetchAllCourses();
  return courses.find(course => course._id === courseId);
} 