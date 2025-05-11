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
  prereqTree?: PrerequisiteItem | PrerequisiteGroup | { or: (PrerequisiteItem | PrerequisiteGroup)[] } | { and: (PrerequisiteItem | PrerequisiteGroup)[] };
  info?: string;
  url?: string;
  syllabus?: string;
  study_program?: string;
  no_credit_courses?: string;
  lecturer?: string;
  notes?: string;
  exam_a?: string;
  exam_b?: string;
  prerequisites?: string;
  isClassificationCourse?: boolean; // Added for classification courses
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
  type: 'total_credits' | 'credits_from_list' | 'min_grade' | 'minCredits' | 'minCoursesFromList' | 'minCoursesFromMultipleLists' | 'minCreditsFromMandatory' | 'minCreditsFromAnySelectiveList' | 'classification_courses' | string;
  required_credits?: number;
  course_list_name?: string;
  listName?: string;
  lists?: { listName: string; min: number }[];
  min_grade_value?: number;
  courses_for_min_grade?: string[];
  min?: number;
  courses?: Array<{ 
    id: string; 
    name: string; 
    creditInput?: { max: number; step: number; }; // Added for exemption credit input
  }>; // For the new classification_courses rule type
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
  "courses-lists"?: Record<string, string[]>;
  "semester-names"?: Record<string, string>;
  definedMandatoryCourseIds?: string[]; // New field for the independent list of mandatory courses
}

export interface DegreesFileStructure {
  globalRules?: DegreeRule[]; // Optional array of global rules
  [degreeId: string]: DegreeTemplate | DegreeRule[] | undefined; // Allow DegreeRule[] for globalRules
}

export type MergedCoursesFileStructure = RawCourseData[]; 