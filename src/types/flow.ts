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
  [key: string]: unknown;
}

export interface RuleNodeData {
  id: string;
  description: string;
  currentProgress: string;
  isSatisfied: boolean;
  currentValue?: number | null;
  requiredValue?: number | null;
  // Optional details for multi-list rules
  listProgressDetails?: { 
    listName: string; 
    currentValue: number; 
    requiredValue: number; 
    isSatisfied: boolean; 
  }[] | null;
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
export type AppEdge = RFEdge;

// Types for change handlers, if explicitly needed
export type AppOnNodesChange = (changes: NodeChange<AppNode>[]) => void;
export type AppOnEdgesChange = (changes: EdgeChange<AppEdge>[]) => void; 