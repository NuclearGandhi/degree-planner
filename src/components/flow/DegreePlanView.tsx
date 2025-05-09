import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Background,
  // MiniMap, // Commented out as it's no longer used
  useNodesState,
  useEdgesState,
  // addEdge, // Removed as onConnect is commented out
  BackgroundVariant,
  // Connection, // Removed as onConnect is commented out
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import CourseNode from './customNodes/CourseNode';
import RuleNode from './customNodes/RuleNode';
import AddCourseNode from './customNodes/AddCourseNode';
import AddSemesterNode from './customNodes/AddSemesterNode';
import SemesterTitleNode from './customNodes/SemesterTitleNode';
import { CourseSelectionModal } from '../../components/ui/CourseSelectionModal';
import { fetchAllCourses, fetchDegreeTemplates } from '../../utils/dataLoader';
import { DegreeTemplate, RawCourseData, DegreeRule, PrerequisiteItem, PrerequisiteGroup } from '../../types/data';
import { AppNode, AppEdge, RuleNodeData } from '../../types/flow';
import { evaluateRule } from '../../utils/ruleEvaluator';
import { AveragesDisplay } from '../../components/ui/AveragesDisplay';
import { savePlan, loadPlan } from '../../utils/planStorage';
import { useTheme } from '../../contexts/ThemeContext';
import { numberToHebrewLetter } from '../../utils/hebrewUtils';
import { checkPrerequisites } from '../../utils/prerequisiteChecker';
import { CourseDetailModal } from '../../components/ui/CourseDetailModal';
import RuleEditorModal from '../../components/ui/RuleEditorModal';
import CourseListEditorModal from '../../components/ui/CourseListEditorModal';
import { Logo } from '../../components/ui/Logo';
import { ThemeToggleButton } from '../../components/ui/ThemeToggleButton';
import ConsolidatedRuleEditorModal from '../../components/ui/ConsolidatedRuleEditorModal';

const nodeTypes = {
  course: CourseNode,
  rule: RuleNode,
  addCourse: AddCourseNode,
  addSemester: AddSemesterNode,
  semesterTitle: SemesterTitleNode,
};

const COLUMN_WIDTH = 340; // Increased from 300
const NODE_HEIGHT_COURSE = 90; // Increased approximate height of a course node
// const NODE_HEIGHT_RULE = 70; // No longer used directly, height is estimated
const VERTICAL_SPACING_RULE = 60; // Further increased vertical spacing, was 40
const HORIZONTAL_SPACING_SEMESTER = 75; // New: Spacing between semester columns
const SEMESTER_TOP_MARGIN = 120; // Increased from 100
const ADD_SEMESTER_NODE_ID = 'add-new-semester-button';
const MAX_SEMESTERS = 16;
const SEMESTER_TITLE_HEIGHT = 40; // Approximate height for the title node + spacing
const MANDATORY_COURSES_LIST_KEY = "רשימת קורסי חובה";
const CONSOLIDATED_RULES_NODE_ID = 'consolidated-rules-node';

type SaveStatus = 'idle' | 'saving' | 'saved'; // New type for save status

const transformDataToNodes = (
  template: DegreeTemplate | undefined,
  allCourses: RawCourseData[],
  grades: Record<string, string>,
  onAddCourseToSemesterCallback: (semesterNumber: number) => void,
  onAddSemesterCallbackParam: () => void,
  onGradeChangeCallback: (courseId: string, grade: string) => void,
  onRemoveCourseCallback: (courseId: string) => void,
  initialMandatoryCourseIds?: string[],
  onCourseDoubleClickCallback?: (courseId: string) => void,
  onEditRuleCallback?: (ruleId: string) => void,
  onDeleteRuleCallback?: (ruleId: string) => void
): AppNode[] => {
  if (!template || typeof template.semesters !== 'object' || template.semesters === null) {
    if (template && (typeof template.semesters !== 'object' || template.semesters === null)) {
      console.warn('Data Structure Warning (transformDataToNodes): template.semesters is not an object!', template.semesters);
    }
    return [];
  }

  const flowNodes: AppNode[] = [];
  let currentContentY = VERTICAL_SPACING_RULE;
  let maxEstimatedRuleHeight = 0;
  const ruleRowStartY = currentContentY;

  const allCourseIdsInTemplate = Object.values(template.semesters).flat();
  const coursesInCurrentPlan = (Array.isArray(allCourses) ? allCourseIdsInTemplate
    .map(courseId => allCourses.find(c => c._id === courseId))
    .filter(Boolean) : []) as RawCourseData[];

  const semesterEntries = Object.entries(template.semesters);
  const numExistingSemesters = semesterEntries.length;
  const maxSemesterNum = numExistingSemesters > 0 ? Math.max(...semesterEntries.map((_, i) => i + 1)) : 0;
  const addSemesterNodeIsVisible = numExistingSemesters < MAX_SEMESTERS;
  const baseSemesterAreaStartX = addSemesterNodeIsVisible ? COLUMN_WIDTH + HORIZONTAL_SPACING_SEMESTER : 0;
  const firstSemesterXPos = baseSemesterAreaStartX + (maxSemesterNum > 0 ? (maxSemesterNum - 1) : 0) * (COLUMN_WIDTH + HORIZONTAL_SPACING_SEMESTER);

  const ruleNodeBaseXAdjustment = 98;

  if (template.rules && Array.isArray(template.rules) && template.rules.length > 0) {
    const rulesToConsolidate: DegreeRule[] = [];
    const otherRules: DegreeRule[] = [];
    const consolidatedRuleTypes = new Set([
      'total_credits', 
      'credits_from_list', 
      'min_grade', 
      'minCredits', 
      'minCoursesFromList',
      'minCreditsFromMandatory',
      'minCreditsFromAnySelectiveList'
    ]);

    template.rules.forEach(rule => {
      if (!rule || typeof rule.id === 'undefined' || typeof rule.description === 'undefined') {
        console.warn(`[transformDataToNodes] Skipping rule due to missing id or description:`, rule);
        return;
      }
      if (consolidatedRuleTypes.has(rule.type)) {
        rulesToConsolidate.push(rule);
      } else {
        otherRules.push(rule);
      }
    });

    let ruleNodeXOffset = 0;

    // Create the consolidated rule node if there are any rules to consolidate
    if (rulesToConsolidate.length > 0) {
      const consolidatedNodeId = CONSOLIDATED_RULES_NODE_ID;
      const consolidatedRuleDetails: RuleNodeData['consolidatedRules'] = [];
      let allConsolidatedSatisfied = true;

      rulesToConsolidate.forEach(rule => {
        const ruleStatus = evaluateRule(
          rule, coursesInCurrentPlan, grades, allCourses,
          template.semesters, template["courses-lists"], initialMandatoryCourseIds
        );
        consolidatedRuleDetails!.push({
          id: rule.id,
          description: rule.description,
          currentProgress: ruleStatus.currentProgressString,
          isSatisfied: ruleStatus.isSatisfied,
          currentValue: ruleStatus.currentValue,
          requiredValue: ruleStatus.requiredValue,
        });
        if (!ruleStatus.isSatisfied) {
          allConsolidatedSatisfied = false;
        }
      });
      
      // Base height for title + padding, then add height per sub-rule
      // Each sub-rule: description (sm), progress text (xs), progress bar (h-2.5), buttons (xs), padding (py-1.5)
      // Estimate ~60px per sub-rule to be safe with spacing and potential text wrapping.
      const estimatedHeightConsolidated = 60 + consolidatedRuleDetails!.length * 60; 
      maxEstimatedRuleHeight = Math.max(maxEstimatedRuleHeight, estimatedHeightConsolidated);

      flowNodes.push({
        id: consolidatedNodeId,
        type: 'rule',
        position: { x: (firstSemesterXPos - ruleNodeBaseXAdjustment) - ruleNodeXOffset * (COLUMN_WIDTH + HORIZONTAL_SPACING_SEMESTER), y: ruleRowStartY },
        data: {
          id: consolidatedNodeId,
          description: "התקדמות אקדמית כללית", // Changed title
          currentProgress: `${consolidatedRuleDetails!.filter((r: NonNullable<RuleNodeData['consolidatedRules']>[number]) => r.isSatisfied).length} / ${consolidatedRuleDetails!.length} תתי-כללים הושלמו`,
          isSatisfied: allConsolidatedSatisfied,
          consolidatedRules: consolidatedRuleDetails,
          onEditRule: onEditRuleCallback,
          onDeleteRule: onDeleteRuleCallback,
        },
      });
      ruleNodeXOffset++;
    }

    // Create nodes for other rules (e.g., minCoursesFromMultipleLists)
    otherRules.forEach((rule) => {
      const ruleStatus = evaluateRule(
        rule, coursesInCurrentPlan, grades, allCourses,
        template.semesters, template["courses-lists"], initialMandatoryCourseIds
      );
      const nodeId = `rule-${rule.id}`;
      const nodePosition = { x: (firstSemesterXPos - ruleNodeBaseXAdjustment) - ruleNodeXOffset * (COLUMN_WIDTH + HORIZONTAL_SPACING_SEMESTER), y: ruleRowStartY };
      ruleNodeXOffset++;

      let estimatedHeight = 120; // Default for other rule types
      if (rule.type === 'minCoursesFromMultipleLists' && rule.lists) {
        // Estimate: base height + per list item (description text-sm, progress text-xs, mini-bar h-2)
        // Each item approx 45-50px. Using 50 for safety.
        estimatedHeight = 70 + (rule.lists.length * 50); 
      }
      maxEstimatedRuleHeight = Math.max(maxEstimatedRuleHeight, estimatedHeight);

      flowNodes.push({
        id: nodeId,
        type: 'rule',
        position: nodePosition,
        data: {
          id: rule.id,
          description: rule.description,
          currentProgress: ruleStatus.currentProgressString,
          isSatisfied: ruleStatus.isSatisfied,
          currentValue: ruleStatus.currentValue,
          requiredValue: ruleStatus.requiredValue,
          listProgressDetails: ruleStatus.listProgressDetails,
          onEditRule: onEditRuleCallback,
          onDeleteRule: onDeleteRuleCallback,
        },
      });
    });
    currentContentY = ruleRowStartY + maxEstimatedRuleHeight + SEMESTER_TOP_MARGIN;
  } else {
    currentContentY = Math.max(currentContentY, SEMESTER_TOP_MARGIN);
  }

  // Semester Title and Course Node Generation (uses the calculated currentContentY)
  semesterEntries.forEach(([semesterName, courseIds], semesterIndex) => {
    const semesterNumberForLayout = semesterIndex + 1;
    const semesterXPos = baseSemesterAreaStartX + (maxSemesterNum - semesterNumberForLayout) * (COLUMN_WIDTH + HORIZONTAL_SPACING_SEMESTER);

    flowNodes.push({
      id: `title-sem-${semesterNumberForLayout}`,
      type: 'semesterTitle',
      position: { x: semesterXPos, y: currentContentY }, // Titles start at currentContentY
      data: { title: semesterName },
      draggable: false,
      selectable: false,
    });

    let currentYInSemester = currentContentY + SEMESTER_TITLE_HEIGHT; // Courses start below title

    courseIds.forEach((courseId) => {
      // Add guard for invalid courseId
      if (typeof courseId !== 'string' || !courseId) {
        console.warn(`[transformDataToNodes] Skipping invalid courseId: ${courseId} in semesterIndex ${semesterIndex}`);
        return; // Skip this iteration
      }

      const courseData = allCourses.find(c => c._id === courseId);
      // Log whether courseData was found
      if (!courseData) {
        console.warn(`[transformDataToNodes] Course data not found for courseId: ${courseId}`);
        return; // Skip creating node if course data is missing
      }

      const nodeId = courseId; // Course ID is used directly
      const nodePosition = { x: semesterXPos, y: currentYInSemester };
      console.log(`[transformDataToNodes] Creating Course Node: ID=${nodeId}, Position=`, nodePosition);
      
      // Check prerequisites
      const prereqsMet = checkPrerequisites(nodeId, template.semesters, allCourses);

      flowNodes.push({
        id: nodeId,
        type: 'course',
        position: nodePosition,
        data: {
          label: courseData.name,
          courseId: courseData._id,
          credits: courseData.credits,
          grade: grades[courseId] || '',
          onGradeChange: onGradeChangeCallback,
          onRemoveCourse: onRemoveCourseCallback,
          prerequisitesMet: prereqsMet,
          onDoubleClick: onCourseDoubleClickCallback
        },
      });
      currentYInSemester += NODE_HEIGHT_COURSE + VERTICAL_SPACING_RULE;
    });

    flowNodes.push({
      id: `add-course-sem-${semesterNumberForLayout}`,
      type: 'addCourse',
      position: { x: semesterXPos, y: currentYInSemester },
      data: {
        semesterNumber: semesterNumberForLayout,
        onAddCourse: onAddCourseToSemesterCallback,
      },
      draggable: false,
    });
  });

  if (numExistingSemesters < MAX_SEMESTERS) {
    flowNodes.push({
      id: ADD_SEMESTER_NODE_ID,
      type: 'addSemester',
      position: { x: HORIZONTAL_SPACING_SEMESTER / 2, y: currentContentY + SEMESTER_TITLE_HEIGHT },
      data: { onAddSemester: onAddSemesterCallbackParam },
      draggable: false,
    });
  }

  return flowNodes;
};

const transformDataToEdges = (
  template: DegreeTemplate | undefined,
  allCourses: RawCourseData[]
): AppEdge[] => {
  console.log('[transformDataToEdges] Starting. Template defined:', !!template, 'AllCourses count:', Array.isArray(allCourses) ? allCourses.length : 'N/A');
  if (!template || typeof template.semesters !== 'object' || template.semesters === null || !Array.isArray(allCourses)) {
    if (template && (typeof template.semesters !== 'object' || template.semesters === null)) {
      console.warn('Data Structure Warning (transformDataToEdges): template.semesters is not an object!', template.semesters);
    }
    if (!Array.isArray(allCourses)) {
      console.warn('Data Input Warning (transformDataToEdges): allCourses is not an array!', allCourses);
    }
    return [];
  }

  const edges: AppEdge[] = [];
  const allCourseIdsInPlan = Object.values(template.semesters).flat();
  console.log('[transformDataToEdges] All course IDs in current plan:', allCourseIdsInPlan);

  const isCourseInPlan = (courseId: string): boolean => {
    const result = allCourseIdsInPlan.includes(courseId);
    // console.log(`[transformDataToEdges] isCourseInPlan check: courseId=${courseId}, inPlan=${result}`); // Can be too verbose
    return result;
  };

  // Iterate over each course in the plan to find its prerequisites
  allCourseIdsInPlan.forEach(courseId => {
    const course = allCourses.find(c => c._id === courseId);
    console.log(`[transformDataToEdges] Processing courseId: ${courseId}`);
    if (course) {
      console.log(`[transformDataToEdges] Found course data for ${courseId}. Prerequisites:`, JSON.stringify(course.prereqTree, null, 2));
    } else {
      console.log(`[transformDataToEdges] Course data NOT FOUND for ${courseId} in allCourses.`);
      return; // Skip if course data not found
    }

    if (course && course.prereqTree) {
      const processPrerequisites = (prereq: PrerequisiteItem | PrerequisiteGroup | { or?: (PrerequisiteItem | PrerequisiteGroup)[], and?: (PrerequisiteItem | PrerequisiteGroup)[] }, targetCourseId: string) => {
        if (typeof prereq === 'string') { // Prereq is a course ID
          console.log(`[transformDataToEdges] processPrerequisites: Checking simple prereq string: '${prereq}' for target '${targetCourseId}'`);
          const sourceInPlan = isCourseInPlan(prereq);
          console.log(`[transformDataToEdges] processPrerequisites: Is prereq '${prereq}' in plan? ${sourceInPlan}`);
          if (sourceInPlan) {
            console.log(`[transformDataToEdges] ADDING EDGE: from '${prereq}' to '${targetCourseId}'`);
            edges.push({
              id: `edge-${prereq}-${targetCourseId}`,
              source: prereq,
              target: targetCourseId,
              type: 'default',
              markerEnd: { type: MarkerType.ArrowClosed, color: '#cccccc' },
              animated: false,
              style: { stroke: '#cccccc', strokeWidth: 1.5, strokeOpacity: 0.2 },
              pathOptions: { curvature: 0.25 }
            });
          }
        } else if (prereq && typeof prereq === 'object') {
          let itemsToProcess: (PrerequisiteItem | PrerequisiteGroup)[] = [];
          if (Array.isArray((prereq as { or?: [] }).or)) {
            console.log(`[transformDataToEdges] processPrerequisites: Processing OR group for target '${targetCourseId}':`, JSON.stringify(prereq, null, 2));
            itemsToProcess = (prereq as { or: [] }).or;
          } else if (Array.isArray((prereq as { and?: [] }).and)) {
            console.log(`[transformDataToEdges] processPrerequisites: Processing AND group for target '${targetCourseId}':`, JSON.stringify(prereq, null, 2));
            itemsToProcess = (prereq as { and: [] }).and;
          } else if (Array.isArray((prereq as PrerequisiteGroup).list)) {
            // This handles the case where the structure is { type: '...', list: [...] }
            console.log(`[transformDataToEdges] processPrerequisites: Processing direct LIST group for target '${targetCourseId}':`, JSON.stringify(prereq, null, 2));
            itemsToProcess = (prereq as PrerequisiteGroup).list;
          }

          if (itemsToProcess.length > 0) {
            itemsToProcess.forEach(item => processPrerequisites(item, targetCourseId));
          } else if (Object.keys(prereq).length > 0) { // Avoid logging for empty objects if any slip through
            console.log(`[transformDataToEdges] processPrerequisites: Skipping unknown object prereq type or empty list for target '${targetCourseId}':`, JSON.stringify(prereq, null, 2));
          }
        } else if (prereq) {
            // This case might not be reached if the object handling is comprehensive
            console.log(`[transformDataToEdges] processPrerequisites: Fallback - Skipping unknown prereq type for target '${targetCourseId}':`, JSON.stringify(prereq, null, 2));
        }
      };
      processPrerequisites(course.prereqTree, courseId);
    } else {
      console.log(`[transformDataToEdges] Course ${courseId} has no prerequisites or course data missing.`);
    }
  });
  console.log('[transformDataToEdges] Finished. Total edges generated:', edges.length);
  return edges;
};

function DegreePlanView() {
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<AppEdge[]>([]);
  const [selectedNodes, setSelectedNodes] = useState<AppNode[]>([]); // Added state for selected nodes
  
  const { theme } = useTheme();

  // State for loaded data
  const [allCourses, setAllCourses] = useState<RawCourseData[]>([]);
  const [degreeTemplate, setDegreeTemplate] = useState<DegreeTemplate | undefined>(undefined);
  const [grades, setGrades] = useState<Record<string, string>>({});

  // State for course selection modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetSemesterForModal, setTargetSemesterForModal] = useState<number | null>(null);

  // State for course detail modal
  const [isCourseDetailModalOpen, setIsCourseDetailModalOpen] = useState(false);
  const [detailedCourseInfo, setDetailedCourseInfo] = useState<RawCourseData | null>(null);

  // State for Rule Editor Modal
  const [isRuleEditorModalOpen, setIsRuleEditorModalOpen] = useState(false);
  const [currentRuleForEditing, setCurrentRuleForEditing] = useState<DegreeRule | null>(null);

  // State for Course List Editor Modal
  const [isCourseListEditorModalOpen, setIsCourseListEditorModalOpen] = useState(false);

  // State for ConsolidatedRuleEditorModal
  const [isConsolidatedRuleModalOpen, setIsConsolidatedRuleModalOpen] = useState(false);
  const [rulesForConsolidatedEditing, setRulesForConsolidatedEditing] = useState<DegreeRule[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true); // Loading state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const autosaveTimeoutRef = useRef<number | null>(null);

  const handleAddCourseToSemesterCallback = useCallback((semesterNumber: number) => {
    console.log(`DegreePlanView: Request to add course to semester: ${semesterNumber}`);
    setTargetSemesterForModal(semesterNumber);
    setIsModalOpen(true);
  }, []);

  const handleAddSemesterCallback = useCallback(() => {
    console.log('DegreePlanView: Add new semester');
    setDegreeTemplate(prevTemplate => {
      if (!prevTemplate || typeof prevTemplate.semesters !== 'object') return prevTemplate; // Guard clause
      const semesterKeys = Object.keys(prevTemplate.semesters);
      if (semesterKeys.length >= MAX_SEMESTERS) return prevTemplate;

      const nextSemesterNum = semesterKeys.length + 1;
      const nextSemesterName = `סמסטר ${numberToHebrewLetter(nextSemesterNum)}`;

      return {
        ...prevTemplate,
        semesters: {
          ...prevTemplate.semesters,
          [nextSemesterName]: [] // Add new semester entry
        }
      };
    });
  }, []);

  const handleSelectCourseFromModal = useCallback((selectedCourse: RawCourseData) => {
    if (targetSemesterForModal === null || !degreeTemplate) return;

    setDegreeTemplate(prevTemplate => {
      if (!prevTemplate || typeof prevTemplate.semesters !== 'object') return prevTemplate;

      const semesterEntries = Object.entries(prevTemplate.semesters);
      // targetSemesterForModal is 1-based
      if (targetSemesterForModal <= 0 || targetSemesterForModal > semesterEntries.length) {
        console.warn(`Invalid targetSemesterForModal: ${targetSemesterForModal}, current semester count: ${semesterEntries.length}`);
        return prevTemplate;
      }

      const targetSemesterKey = semesterEntries[targetSemesterForModal - 1][0]; // Get the key of the target semester

      const updatedSemesters = { ...prevTemplate.semesters };
      const currentCoursesInTargetSemester = updatedSemesters[targetSemesterKey] || [];

      if (!currentCoursesInTargetSemester.includes(selectedCourse._id)) {
        updatedSemesters[targetSemesterKey] = [...currentCoursesInTargetSemester, selectedCourse._id];
      } else {
        console.log(`Course ${selectedCourse._id} already in semester ${targetSemesterKey}`);
      }

      return { ...prevTemplate, semesters: updatedSemesters };
    });
    setIsModalOpen(false);
    setTargetSemesterForModal(null);
  }, [targetSemesterForModal, degreeTemplate]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setTargetSemesterForModal(null);
  }, []);

  const handleGradeChangeCallback = useCallback((courseId: string, grade: string) => {
    setGrades(prevGrades => ({
      ...prevGrades,
      [courseId]: grade,
    }));
    // TODO: Add validation for grade input (e.g., numeric, range)
    // TODO: Trigger rule re-calculation and overall average calculation here
  }, []);

  // Callback for handling course removal
  const handleRemoveCourseCallback = useCallback((courseIdToRemove: string) => {
    console.log(`DegreePlanView: Remove course: ${courseIdToRemove}`);
    setDegreeTemplate(prevTemplate => {
      if (!prevTemplate || typeof prevTemplate.semesters !== 'object') return undefined;

      const updatedSemesters: Record<string, string[]> = {};
      for (const [semesterKey, courseIds] of Object.entries(prevTemplate.semesters)) {
        updatedSemesters[semesterKey] = (courseIds as string[]).filter((id: string) => id !== courseIdToRemove);
      }
      return { ...prevTemplate, semesters: updatedSemesters };
    });
    // Also remove grade entry if it exists
    setGrades(prevGrades => {
      const newGrades = { ...prevGrades };
      delete newGrades[courseIdToRemove];
      return newGrades;
    });
    // Clear selection if the removed node was selected
    setSelectedNodes(prevSelected => prevSelected.filter(node => node.id !== courseIdToRemove)); 
    // Alternatively, to clear all selection: setSelectedNodes([]);
  }, [setDegreeTemplate, setGrades, setSelectedNodes]); // Added setSelectedNodes to dependencies

  // Callback for course node double-click
  const handleCourseNodeDoubleClick = useCallback((courseId: string) => {
    if (!Array.isArray(allCourses)) return;
    const courseToShow = allCourses.find(c => c._id === courseId);
    if (courseToShow) {
      setDetailedCourseInfo(courseToShow);
      setIsCourseDetailModalOpen(true);
    }
  }, [allCourses]);

  // Rule Editor Handlers
  const handleOpenRuleEditor = useCallback((ruleId: string) => {
    if (degreeTemplate && degreeTemplate.rules) {
      const ruleToEdit = degreeTemplate.rules.find(r => r.id === ruleId);
      if (ruleToEdit) {
        setCurrentRuleForEditing(ruleToEdit);
        setIsRuleEditorModalOpen(true);
      } else {
        console.warn(`Rule with id ${ruleId} not found.`);
      }
    }
  }, [degreeTemplate]);

  const handleCloseRuleEditor = useCallback(() => {
    setCurrentRuleForEditing(null);
    setIsRuleEditorModalOpen(false);
  }, []);

  const handleSaveRule = useCallback((updatedRule: DegreeRule) => {
    if (!degreeTemplate) return;
    const updatedRules = degreeTemplate.rules.map(r => r.id === updatedRule.id ? updatedRule : r);
    const newDegreeTemplate = { ...degreeTemplate, rules: updatedRules };
    setDegreeTemplate(newDegreeTemplate);
    handleCloseRuleEditor();
  }, [degreeTemplate, handleCloseRuleEditor]);

  const handleDeleteRule = useCallback((ruleId: string) => {
    if (window.confirm("האם אתה בטוח שברצונך למחוק כלל זה?")) {
      setDegreeTemplate(prevTemplate => {
        if (!prevTemplate || !prevTemplate.rules) return prevTemplate;
        const updatedRules = prevTemplate.rules.filter(r => r.id !== ruleId);
        return { ...prevTemplate, rules: updatedRules };
      });
    }
  }, [setDegreeTemplate]);

  // Callback for Course List Editor Modal
  const handleToggleCourseListEditorModal = useCallback(() => {
    setIsCourseListEditorModalOpen(prev => !prev);
  }, []);

  // Callback for saving updated course lists
  const handleSaveCourseLists = useCallback((allListsFromModal: Record<string, string[]>) => {
    setDegreeTemplate(prevTemplate => {
      if (!prevTemplate) return undefined;

      // Handle the mandatory courses list
      const newDefinedMandatoryCourseIds = allListsFromModal[MANDATORY_COURSES_LIST_KEY] !== undefined
        ? allListsFromModal[MANDATORY_COURSES_LIST_KEY]
        : prevTemplate.definedMandatoryCourseIds; // Fallback if key somehow missing

      // Rebuild the custom courses-lists object from what's in the modal
      const newCustomCoursesLists: Record<string, string[]> = {};
      for (const listName in allListsFromModal) {
        if (listName !== MANDATORY_COURSES_LIST_KEY) {
          // Only add non-empty lists to the final custom lists
          if (allListsFromModal[listName] && allListsFromModal[listName].length > 0) {
            newCustomCoursesLists[listName] = allListsFromModal[listName];
          }
          // If a list was emptied in the modal, it won't be added here, effectively deleting it from "courses-lists".
        }
      }

      return {
        ...prevTemplate,
        definedMandatoryCourseIds: newDefinedMandatoryCourseIds,
        "courses-lists": newCustomCoursesLists,
      };
    });
    setIsCourseListEditorModalOpen(false); // Explicitly close modal here
  }, [setDegreeTemplate, setIsCourseListEditorModalOpen]);

  // Callback for editing consolidated rules
  const handleEditRule = useCallback((ruleId: string) => {
    if (!degreeTemplate || !degreeTemplate.rules) return;

    if (ruleId === CONSOLIDATED_RULES_NODE_ID) {
      const consolidatedRuleTypes = new Set([
        'total_credits', 'credits_from_list', 'min_grade', 'minCredits',
        'minCoursesFromList', 'minCreditsFromMandatory', 'minCreditsFromAnySelectiveList'
      ]);
      const rulesToEdit = degreeTemplate.rules.filter(rule => consolidatedRuleTypes.has(rule.type));
      if (rulesToEdit.length > 0) {
        setRulesForConsolidatedEditing(rulesToEdit);
        setIsConsolidatedRuleModalOpen(true);
      } else {
        console.warn("Consolidated rule node edit triggered, but no matching rules found in template.");
      }
    } else {
      const ruleToEdit = degreeTemplate.rules.find(r => r.id === ruleId);
      if (ruleToEdit) {
        setCurrentRuleForEditing(ruleToEdit);
        setIsRuleEditorModalOpen(true);
      } else {
        console.warn(`Rule with ID ${ruleId} not found for editing.`);
      }
    }
  }, [degreeTemplate]);

  // Callback for saving consolidated rules
  const handleSaveConsolidatedRules = useCallback((updatedRules: DegreeRule[]) => {
    if (!degreeTemplate || !degreeTemplate.rules) return;

    const ruleMap = new Map(updatedRules.map(rule => [rule.id, rule]));
    const newRulesArray = degreeTemplate.rules.map(originalRule => 
      ruleMap.has(originalRule.id) ? ruleMap.get(originalRule.id)! : originalRule
    );

    const newDegreeTemplate = { ...degreeTemplate, rules: newRulesArray };
    setDegreeTemplate(newDegreeTemplate);
    setIsConsolidatedRuleModalOpen(false);
    setRulesForConsolidatedEditing([]);
  }, [degreeTemplate]);

  // Initial Load Effect
  useEffect(() => {
    const loadInitialData = async () => {
      console.log("[DegreePlanView] Initial Load: Starting...");
      setIsLoading(true);
      const courses = await fetchAllCourses();
      console.log("[DegreePlanView] Initial Load: Fetched allCourses:", courses);
      setAllCourses(courses);
      
      let templateForProcessing: DegreeTemplate | undefined = undefined;
      let gradesToSet: Record<string, string> = {};

      console.log("[DegreePlanView] Initial Load: Attempting to load autosaved plan.");
      const loadedAutosavedPlan = loadPlan(); // Use new loadPlan
      console.log("[DegreePlanView] Initial Load: Loaded autosaved plan from storage:", loadedAutosavedPlan);

      if (loadedAutosavedPlan) {
        templateForProcessing = loadedAutosavedPlan.template;
        gradesToSet = loadedAutosavedPlan.grades;
        console.log("[DegreePlanView] Initial Load: Successfully loaded autosaved plan. Template for processing:", templateForProcessing);
      } else {
        console.log("[DegreePlanView] Initial Load: No autosaved plan found, fetching default template.");
        const degreeData = await fetchDegreeTemplates();
        console.log("[DegreePlanView] Initial Load: Fetched degree templates data:", degreeData);
        const firstTemplateId = Object.keys(degreeData)[0];
        console.log("[DegreePlanView] Initial Load: First template ID:", firstTemplateId);
        if (firstTemplateId && degreeData[firstTemplateId]) {
          templateForProcessing = degreeData[firstTemplateId];
          console.log("[DegreePlanView] Initial Load: Set template for processing to default:", templateForProcessing);
        } else {
          console.warn("[DegreePlanView] Initial Load: No default template found or degreeData is empty.");
        }
        // gradesToSet remains {} for a new default template
      }

      // Ensure definedMandatoryCourseIds is populated if it wasn't in the loaded/defaulted template
      if (templateForProcessing && !templateForProcessing.definedMandatoryCourseIds && typeof templateForProcessing.semesters === 'object' && templateForProcessing.semesters !== null) {
        const allMandatoryIdsFromSemesters = [...new Set(Object.values(templateForProcessing.semesters).flat())];
        templateForProcessing = { ...templateForProcessing, definedMandatoryCourseIds: allMandatoryIdsFromSemesters };
        console.log("[DegreePlanView] Initial Load: Populated definedMandatoryCourseIds from semesters:", templateForProcessing.definedMandatoryCourseIds);
      }
      
      setDegreeTemplate(templateForProcessing);
      setGrades(gradesToSet);
      console.log("[DegreePlanView] Initial Load: Final currentTemplate set:", templateForProcessing, "Grades set:", gradesToSet);

      setIsLoading(false);
      console.log("[DegreePlanView] Initial Load: Finished. isLoading: false");
    };
    loadInitialData();
  }, []);

  // Autosave Effect
  useEffect(() => {
    if (isLoading || !degreeTemplate) {
      // If loading or no template, and we were in the process of saving (status was 'saving'),
      // reset to 'idle'. If it was already 'saved', let it persist.
      if (saveStatus === 'saving') {
        setSaveStatus('idle');
      }
      // Also, ensure any pending save operation is cancelled if loading starts.
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
        autosaveTimeoutRef.current = null; // Clear the ref
      }
      return;
    }

    // If we reach here, isLoading is false and currentTemplate exists.

    // Clear any existing timeout to debounce
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    setSaveStatus('saving');
    console.log("[DegreePlanView] Autosave: Change detected. Status: saving. Debouncing save...");

    autosaveTimeoutRef.current = window.setTimeout(() => {
      console.log("[DegreePlanView] Autosave: Debounce timeout reached. Saving plan...");
      // Re-check currentTemplate inside timeout, as it's part of the closure
      if (degreeTemplate) { 
        savePlan(degreeTemplate, grades);
        setSaveStatus('saved'); 
        console.log("[DegreePlanView] Autosave: Plan saved. Status: saved.");
      } else {
        // This case should ideally not be hit if the initial guard is effective
        setSaveStatus('idle');
        console.warn("[DegreePlanView] Autosave: currentTemplate was null during save attempt. Aborted.");
      }
      autosaveTimeoutRef.current = null; // Clear the ref after execution
    }, 1500);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
        autosaveTimeoutRef.current = null; // Ensure ref is cleared on cleanup
      }
    };
  }, [degreeTemplate, grades, isLoading]); // Removed saveStatus from dependencies

  // New useEffect for styling edges based on selection
  useEffect(() => {
    // if (!edges.length && selectedNodes.length === 0) return; 

    const actualSelectedCourseNode = selectedNodes.find(n => n.type === 'course');

    if (actualSelectedCourseNode) {
      const selectedId = actualSelectedCourseNode.id;
      setEdges(prevEdges => 
        prevEdges.map(edge => {
          const isActive = edge.source === selectedId || edge.target === selectedId;
          if (isActive) {
            return {
              ...edge,
              style: { ...edge.style, stroke: '#f59e0b', strokeWidth: 2.5, strokeOpacity: 1 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' }, 
              zIndex: 10, 
            };
          }
          return {
            ...edge,
            style: { ...edge.style, stroke: '#d1d5db', strokeWidth: 1, strokeOpacity: 0.05 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#d1d5db' }, 
            zIndex: 0, 
          };
        })
      );
    } else {
      setEdges(prevEdges => 
        prevEdges.map(edge => ({
          ...edge,
          style: { stroke: '#cccccc', strokeWidth: 1.5, strokeOpacity: 0.2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#cccccc' }, 
          zIndex: 0, 
        }))
      );
    }
  }, [selectedNodes, setEdges]);

  // useEffect to update nodes/edges when data changes (MAIN EFFECT)
  useEffect(() => {
    console.log("[DegreePlanView] Node/Edge Update Effect: Triggered. Dependencies changed.");
    console.log("[DegreePlanView] Node/Edge Update Effect: State before guard - isLoading:", isLoading, "currentTemplate:", degreeTemplate, "allCourses count:", Array.isArray(allCourses) ? allCourses.length : 'not an array');
    
    if (isLoading || !degreeTemplate || !Array.isArray(allCourses) || allCourses.length === 0) {
      console.log("[DegreePlanView] Node/Edge Update Effect: Guarded. Not generating nodes/edges yet.");
      if (isLoading) console.log("Reason: isLoading is true.");
      if (!degreeTemplate) console.log("Reason: currentTemplate is falsy.");
      if (!Array.isArray(allCourses)) console.log("Reason: allCourses is not an array.");
      if (Array.isArray(allCourses) && allCourses.length === 0) console.log("Reason: allCourses is an empty array.");
      // Optionally, if nodes are empty and not loading, set them to empty to clear previous state
      if (!isLoading && nodes.length > 0) {
         console.log("[DegreePlanView] Node/Edge Update Effect: Clearing existing nodes as conditions not met.");
         setNodes([]);
         setEdges([]);
      }
      return;
    }

    console.log("[DegreePlanView] Node/Edge Update Effect: Guard passed. Generating nodes and edges with currentTemplate:", degreeTemplate, "and allCourses count:", allCourses.length);
    const newNodes = transformDataToNodes(
      degreeTemplate,
      allCourses,
      grades,
      handleAddCourseToSemesterCallback,
      handleAddSemesterCallback,
      handleGradeChangeCallback,
      handleRemoveCourseCallback,
      degreeTemplate?.definedMandatoryCourseIds,
      handleCourseNodeDoubleClick,
      handleEditRule,
      handleDeleteRule
    );
    const newEdges = transformDataToEdges(degreeTemplate, allCourses);
    console.log("[DegreePlanView] Node/Edge Update Effect: Generated newNodes count:", newNodes.length, "newEdges count:", newEdges.length);
    // console.log("[DegreePlanView] Node/Edge Update Effect: Generated newNodes content:", JSON.stringify(newNodes, null, 2)); // Potentially very verbose
    setNodes(newNodes);
    setEdges(newEdges); // This sets the base edges
  }, [degreeTemplate, allCourses, grades, setNodes, setEdges, handleAddCourseToSemesterCallback, handleAddSemesterCallback, handleGradeChangeCallback, handleRemoveCourseCallback, isLoading, handleCourseNodeDoubleClick, handleEditRule, handleDeleteRule]);

  const handleSelectionChange = useCallback(({ nodes: selNodes }: { nodes: AppNode[], edges: AppEdge[] }) => {
    setSelectedNodes(selNodes);
  }, []);

  // Filter courses for modal: exclude those already in the current plan
  const availableCoursesForModal = useMemo(() => {
    if (!degreeTemplate || typeof degreeTemplate.semesters !== 'object' || degreeTemplate.semesters === null || !Array.isArray(allCourses)) {
      if (degreeTemplate && (typeof degreeTemplate.semesters !== 'object' || degreeTemplate.semesters === null)) {
        console.warn('Data Structure Warning (availableCoursesForModal): currentTemplate.semesters is not an object!', degreeTemplate.semesters);
      }
      return allCourses || []; // Return allCourses if valid, else empty array
    }
    const coursesInPlan = new Set<string>();
    Object.values(degreeTemplate.semesters).forEach(courseIds => {
      if (Array.isArray(courseIds)) {
        courseIds.forEach((cId: string) => coursesInPlan.add(cId));
      }
    });
    return allCourses.filter(course => !coursesInPlan.has(course._id));
  }, [allCourses, degreeTemplate]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div className="fixed top-4 left-4 z-50 flex items-center">
        {saveStatus === 'saving' && <span className="text-xs text-slate-600 dark:text-slate-300 p-1 bg-slate-200 dark:bg-slate-700 rounded mr-3">שומר...</span>}
        {saveStatus === 'saved' && <span className="text-xs text-green-600 dark:text-green-400 p-1 bg-green-100 dark:bg-green-800 rounded mr-3">נשמר ✓</span>}
        <Logo />
      </div>
      <ThemeToggleButton />
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onSelectionChange={handleSelectionChange}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="top-right"
          colorMode={theme}
          nodesDraggable={false}
          nodesConnectable={false}
          selectNodesOnDrag={false}
          zoomOnDoubleClick={false}
        >
          <Controls />
          {/* <MiniMap /> */}
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
      </ReactFlowProvider>
      <CourseSelectionModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        courses={availableCoursesForModal}
        onSelectCourse={handleSelectCourseFromModal}
        semesterNumber={targetSemesterForModal}
      />
      <CourseDetailModal 
        isOpen={isCourseDetailModalOpen}
        onClose={() => setIsCourseDetailModalOpen(false)}
        course={detailedCourseInfo}
        allCourses={allCourses}
      />
      <RuleEditorModal
        isOpen={isRuleEditorModalOpen}
        rule={currentRuleForEditing}
        onClose={handleCloseRuleEditor}
        onSave={handleSaveRule}
        allCourses={allCourses}
        availableCourseListNames={degreeTemplate && degreeTemplate["courses-lists"] ? Object.keys(degreeTemplate["courses-lists"]) : []}
      />
      <CourseListEditorModal
        isOpen={isCourseListEditorModalOpen}
        onClose={handleToggleCourseListEditorModal}
        allCourses={allCourses}
        currentCourseLists={useMemo(() => {
          const lists = { ...(degreeTemplate?.["courses-lists"] || {}) };
          // Add the definedMandatoryCourseIds as a special list for the editor
          if (degreeTemplate && degreeTemplate.definedMandatoryCourseIds) {
            lists[MANDATORY_COURSES_LIST_KEY] = [...new Set(degreeTemplate.definedMandatoryCourseIds)];
          } else if (degreeTemplate && typeof degreeTemplate.semesters === 'object' && degreeTemplate.semesters !== null) {
            // Fallback for older data or if definedMandatoryCourseIds is somehow not set yet:
            // show current semester courses, but saving will create/update definedMandatoryCourseIds
            // This also ensures the list is shown even if definedMandatoryCourseIds is empty initially
             const allMandatoryIdsFromSemesters = [...new Set(Object.values(degreeTemplate.semesters).flat())];
             lists[MANDATORY_COURSES_LIST_KEY] = allMandatoryIdsFromSemesters;
          } else {
            lists[MANDATORY_COURSES_LIST_KEY] = []; // Ensure the key exists for the modal
          }
          return lists;
        }, [degreeTemplate])}
        onSaveCourseLists={handleSaveCourseLists}
        mandatoryCoursesListKey={MANDATORY_COURSES_LIST_KEY}
      />
      <ConsolidatedRuleEditorModal
        isOpen={isConsolidatedRuleModalOpen}
        rules={rulesForConsolidatedEditing}
        onClose={() => {
          setIsConsolidatedRuleModalOpen(false);
          setRulesForConsolidatedEditing([]);
        }}
        onSave={handleSaveConsolidatedRules}
      />
      <AveragesDisplay
        currentTemplate={degreeTemplate}
        allCourses={allCourses}
        grades={grades}
      />
      <div className="absolute top-16 right-4 z-10 flex flex-col space-y-2">
        <button 
          onClick={handleToggleCourseListEditorModal}
          className="p-2 bg-blue-500 text-white rounded shadow-lg hover:bg-blue-600 transition-colors text-sm"
        >
          ערוך רשימות קורסים
        </button>
      </div>
    </div>
  );
}

export default DegreePlanView;