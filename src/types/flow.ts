import { Node, Edge } from '@xyflow/react';
import { PrereqStatus } from '../utils/prerequisiteChecker'; // Import the status type

// Data interfaces for custom nodes
// These should match the structures previously defined locally in each node component,
// but without the `[key: string]: unknown;` workaround.

export interface CourseNodeData {
  label: string;
  courseId: string;
  credits: number | string; // Allow string for 'N/A'
  grade: string;
  onGradeChange: (id: string, grade: string) => void;
  onRemoveCourse: (id: string) => void;
  prerequisitesMet: PrereqStatus; // <<< Updated from boolean to PrereqStatus
  isBinary: boolean;
  onBinaryChange: (id: string, isBinary: boolean) => void;
  onDoubleClick?: (courseId: string) => void;
  tabIndex?: number; // For keyboard navigation through grade inputs
  [key: string]: unknown; // Use unknown instead of any
}

export interface CreditInputDetails {
  max: number;
  step: number;
}

export interface ClassificationCourseDetail {
  id: string;
  name: string;
  checked: boolean;
  credits?: number;
  creditInput?: CreditInputDetails;
  [key: string]: unknown;
}

export interface RuleNodeData {
  id: string;
  description: string;
  currentProgress?: number | string | null;
  targetProgress?: number | null;
  isSatisfied: boolean;
  details?: string;
  listName?: string;
  minGrade?: number | null;
  courseList?: string[];
  minCourses?: number | null;
  minCredits?: number | null;
  classificationCourseDetails?: ClassificationCourseDetail[];
  onClassificationToggle?: (courseId: string, isSelected: boolean) => void;
  onClassificationCreditsChange?: (courseId: string, newCredits: number) => void;
  listsProgress?: Array<{
    listName: string;
    currentCount?: number;
    requiredCount?: number;
    currentValuePlanned?: number;
    currentValueDone?: number;
    requiredValue?: number;
    isSatisfied?: boolean;
    [key: string]: unknown;
  }> | null;
  groups?: Array<{
    groupId: string;
    minCoursesRequired: number;
    coursesTaken: number;
    lists: Array<{ listName: string; courses: string[]; coursesInPlanCount: number }>;
    isGroupSatisfied: boolean;
    [key: string]: unknown;
  }> | null;
  isConsolidated?: boolean;
  listProgressDetails?: {
    listName: string;
    currentCount?: number;
    requiredCount?: number;
    currentValuePlanned?: number;
    currentValueDone?: number;
    requiredValue?: number;
    isSatisfied?: boolean;
    unit?: string; // Unit of measurement (e.g., 'נק"ז', 'קורסים')
  }[];
  currentValuePlanned?: number;
  currentValueDone?: number;
  requiredValue?: number;
  consolidatedRules?: {
      id: string;
      description: string;
      currentProgress: string;
      isSatisfied: boolean;
      currentValuePlanned?: number;
      currentValueDone?: number;
      requiredValue?: number;
  }[];
  onEditRule?: (ruleId: string) => void;
  onDeleteRule?: (ruleId: string) => void;
  [key: string]: unknown;
}

export interface AddCourseNodeData {
  semesterNumber: number;
  onAddCourse: (semesterNumber: number) => void;
  [key: string]: unknown; // Use unknown instead of any
}

export interface AddSemesterNodeData {
  onAddSemester: () => void;
  [key: string]: unknown; // Use unknown instead of any
}

export interface SemesterTitleNodeData {
  title: string;
  semesterKey: string;
  isEmpty: boolean;
  onRemoveSemester?: (semesterKey: string) => void;
  [key: string]: unknown; // Use unknown instead of any
}

// Specific React Flow Node types using the data interfaces and type strings
export type CourseDisplayNode = Node<CourseNodeData, 'course'>;
export type RuleDisplayNode = Node<RuleNodeData, 'rule'>;
export type AddCourseDisplayNode = Node<AddCourseNodeData, 'addCourse'>;
export type AddSemesterDisplayNode = Node<AddSemesterNodeData, 'addSemester'>;
export type SemesterTitleDisplayNode = Node<SemesterTitleNodeData, 'semesterTitle'>;

// Union type for all nodes in the application
export type AppNode = 
  | CourseDisplayNode 
  | RuleDisplayNode 
  | AddCourseDisplayNode
  | AddSemesterDisplayNode
  | SemesterTitleDisplayNode;

// Type for edges in the application
// For now, a generic Edge is fine, but can be made more specific if needed.
export type AppEdge = Edge; // Use base Edge type for now

// Removed unused change types
// export type AppNodeChange = NodeChange;
// export type AppEdgeChange = EdgeChange; 