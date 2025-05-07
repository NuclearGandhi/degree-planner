// Types for data loaded from public/data/*.json

// Represents a single course from merged_courses.json
export interface RawCourseData {
  _id: string; // Course ID, e.g., "123456"
  name: string; // Course name in Hebrew
  english_name: string;
  credits: number;
  academic_points: number;
  hours: string; // e.g., "2h+1t"
  semester: ("אביב" | "חורף" | "קיץ" | "שנתי" | string)[]; // Array of semesters course is given
  faculty: string;
  description?: string;
  prerequisites?: PrerequisiteItem | PrerequisiteGroup;
  [key: string]: unknown; // Changed to unknown
}

export type PrerequisiteItem = string; // Course ID
export interface PrerequisiteGroup {
  type: 'all' | 'one' | 'at_least_X_credits_from_list' | string; 
  list: (PrerequisiteItem | PrerequisiteGroup)[];
  credits?: number; 
}

export interface CourseListRule {
  name: string; 
  courses: string[]; 
  credits_to_complete?: number;
  courses_to_complete?: number;
}

export interface DegreeRule {
  id: string;
  description: string;
  type: 'total_credits' | 'credits_from_list' | 'min_grade' | string;
  required_credits?: number;
  course_list_name?: string; 
  min_grade_value?: number;
  courses_for_min_grade?: string[];
}

// Represents a degree template from degrees.json
export interface DegreeTemplate {
  id: string; 
  name: string; 
  total_credits: number;
  // Updated semesters to be a Record (object) where keys are semester names (string)
  // and values are arrays of course IDs (string[])
  semesters: Record<string, string[]>; 
  rules?: DegreeRule[]; 
  "courses-lists"?: CourseListRule[]; 
}

export interface DegreesFileStructure {
  [degreeId: string]: DegreeTemplate;
}

export type MergedCoursesFileStructure = RawCourseData[]; 