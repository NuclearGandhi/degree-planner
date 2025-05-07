import { MergedCoursesFileStructure, DegreesFileStructure, RawCourseData, DegreeTemplate } from '../types/data';

const DATA_BASE_PATH = '/data'; // Assuming files are in public/data

export async function fetchAllCourses(): Promise<MergedCoursesFileStructure> {
  try {
    const response = await fetch(`${DATA_BASE_PATH}/merged_courses.json`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data as MergedCoursesFileStructure;
  } catch (error) {
    console.error("Failed to fetch courses:", error);
    // In a real app, handle this more gracefully (e.g., show error to user, return empty array)
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
  return templates[degreeId];
}

// Example utility: Get a specific course by ID
export async function getCourseById(courseId: string): Promise<RawCourseData | undefined> {
  const courses = await fetchAllCourses();
  return courses.find(course => course._id === courseId);
} 