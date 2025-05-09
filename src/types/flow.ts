import { Node as RFNode, Edge as RFEdge, NodeChange, EdgeChange } from '@xyflow/react';

// Data interfaces for custom nodes
// These should match the structures previously defined locally in each node component,
// but without the `[key: string]: unknown;` workaround.

export interface CourseNodeData {
  label: string;
  courseId: string;
  credits: number;
  grade?: string;
  onGradeChange?: (courseId: string, grade: string) => void;
  onRemoveCourse?: (courseId: string) => void;
  prerequisitesMet?: boolean;
  onDoubleClick?: (courseId: string) => void;
  [key: string]: unknown;
}

export interface RuleNodeData {
  id: string;
  description: string; // For single rules or the title of a consolidated rule group
  currentProgress: string; // Overall progress for single rules, or a summary for consolidated
  isSatisfied: boolean; // Overall satisfaction for single rules, or if all consolidated are met
  currentValue?: number | null; // Relevant for single rules with a singular progress metric
  requiredValue?: number | null; // Relevant for single rules with a singular progress metric
  
  // Details for 'minCoursesFromMultipleLists' or similar complex single rules
  listProgressDetails?: { 
    listName: string; 
    currentValue: number; 
    requiredValue: number; 
    isSatisfied: boolean; 
  }[] | null;

  // New field for consolidated rules
  consolidatedRules?: Array<{
    id: string; // ID of the original DegreeRule, for editing/deleting
    description: string; // Description of the individual sub-rule
    currentProgress: string; // Progress string of the sub-rule
    isSatisfied: boolean; // Satisfaction status of the sub-rule
    currentValue?: number | null; // Current value for this sub-rule's progress
    requiredValue?: number | null; // Required value for this sub-rule
  }> | null;

  onEditRule?: (id: string) => void; // Retain for potential editing of the rule group or specific rules
  onDeleteRule?: (id: string) => void; // Retain for potential deletion
  [key: string]: unknown;
}

export interface AddCourseNodeData {
  semesterNumber: number;
  onAddCourse: (semesterNumber: number) => void;
  [key: string]: unknown;
}

export interface AddSemesterNodeData {
  onAddSemester: () => void;
  [key: string]: unknown;
}

export interface SemesterTitleNodeData {
  title: string;
  [key: string]: unknown;
}

// Specific React Flow Node types using the data interfaces and type strings
export type CourseDisplayNode = RFNode<CourseNodeData, 'course'>;
export type RuleDisplayNode = RFNode<RuleNodeData, 'rule'>;
export type AddCourseDisplayNode = RFNode<AddCourseNodeData, 'addCourse'>;
export type AddSemesterDisplayNode = RFNode<AddSemesterNodeData, 'addSemester'>;
export type SemesterTitleDisplayNode = RFNode<SemesterTitleNodeData, 'semesterTitle'>;

// Union type for all nodes in the application
export type AppNode = CourseDisplayNode | RuleDisplayNode | AddCourseDisplayNode | AddSemesterDisplayNode | SemesterTitleDisplayNode;

// Type for edges in the application
// For now, a generic RFEdge is fine, but can be made more specific if needed.
export type AppEdge = RFEdge & {
    pathOptions?: { curvature?: number; borderRadius?: number; offset?: number };
  };

// Types for change handlers, if explicitly needed
export type AppOnNodesChange = (changes: NodeChange<AppNode>[]) => void;
export type AppOnEdgesChange = (changes: EdgeChange<AppEdge>[]) => void; 