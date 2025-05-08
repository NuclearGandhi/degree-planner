import React, { useCallback, useEffect, useState, useMemo } from 'react';
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
import { AppNode, AppEdge } from '../../types/flow';
import { evaluateRule } from '../../utils/ruleEvaluator';
import { AveragesDisplay } from '../../components/ui/AveragesDisplay';
import { PlanManagement } from '../../components/ui/PlanManagement';
import { savePlanToSlot, loadPlanFromSlot, getActivePlanId } from '../../utils/planStorage';
import { useTheme } from '../../contexts/ThemeContext';
import { numberToHebrewLetter } from '../../utils/hebrewUtils';
import { checkPrerequisites } from '../../utils/prerequisiteChecker';
import { CourseDetailModal } from '../../components/ui/CourseDetailModal';
import RuleEditorModal from '../../components/ui/RuleEditorModal';

const nodeTypes = {
  course: CourseNode,
  rule: RuleNode,
  addCourse: AddCourseNode,
  addSemester: AddSemesterNode,
  semesterTitle: SemesterTitleNode,
};

const COLUMN_WIDTH = 300; // Increased width of a semester column
const NODE_HEIGHT_COURSE = 90; // Increased approximate height of a course node
// const NODE_HEIGHT_RULE = 70; // No longer used directly, height is estimated
const VERTICAL_SPACING_RULE = 60; // Further increased vertical spacing, was 40
const HORIZONTAL_SPACING_SEMESTER = 75; // New: Spacing between semester columns
const SEMESTER_TOP_MARGIN = 100; // Further increased space below rules / above semester titles
const ADD_SEMESTER_NODE_ID = 'add-new-semester-button';
const MAX_SEMESTERS = 16;
const SEMESTER_TITLE_HEIGHT = 40; // Approximate height for the title node + spacing

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
  let currentContentY = VERTICAL_SPACING_RULE; // Initial Y for the topmost content
  let maxEstimatedRuleHeight = 0; // Track max height in the rule row
  const ruleRowStartY = currentContentY; // Capture the starting Y for the rule row

  const allCourseIdsInTemplate = Object.values(template.semesters).flat();
  const coursesInCurrentPlan = (Array.isArray(allCourses) ? allCourseIdsInTemplate
    .map(courseId => allCourses.find(c => c._id === courseId))
    .filter(Boolean) : []) as RawCourseData[];

  // --- Move Semester Calculations Up ---
  const semesterEntries = Object.entries(template.semesters);
  const numExistingSemesters = semesterEntries.length;
  const maxSemesterNum = numExistingSemesters > 0 ? Math.max(...semesterEntries.map((_, i) => i + 1)) : 0; // Use 1-based index for max
  const addSemesterNodeIsVisible = numExistingSemesters < MAX_SEMESTERS;
  const baseSemesterAreaStartX = addSemesterNodeIsVisible ? COLUMN_WIDTH + HORIZONTAL_SPACING_SEMESTER : 0; 
  // --- End Moved Calculations ---

  if (template.rules && Array.isArray(template.rules) && template.rules.length > 0) {
    template.rules.forEach((rule: DegreeRule, index: number) => {
      // Log the rule object being processed
      console.log(`[transformDataToNodes] Processing Rule:`, rule);
      if (!rule || typeof rule.id === 'undefined' || typeof rule.description === 'undefined') {
        console.warn(`[transformDataToNodes] Skipping rule at index ${index} due to missing id or description:`, rule);
        return; // Skip potentially invalid rule object
      }

      const ruleStatus = evaluateRule(
        rule,
        coursesInCurrentPlan,
        grades,
        allCourses,
        template.semesters,
        template["courses-lists"],
        initialMandatoryCourseIds
      );
      const nodeId = `rule-${rule.id || index}`;
      const firstSemesterXPos = baseSemesterAreaStartX + (maxSemesterNum > 0 ? (maxSemesterNum - 1) : 0) * (COLUMN_WIDTH + HORIZONTAL_SPACING_SEMESTER);
      const nodePosition = { x: firstSemesterXPos - index * (COLUMN_WIDTH + HORIZONTAL_SPACING_SEMESTER), y: ruleRowStartY }; // All rules start at the same Y
      
      // Estimate height for vertical spacing calculation
      let estimatedHeight = 120; // Default based on min-h-[120px]
      if (rule.type === 'minCoursesFromMultipleLists' && rule.lists) {
          // Rough estimate: 60px base + 20px per list item
          estimatedHeight = 60 + (rule.lists.length * 20); 
      }
      maxEstimatedRuleHeight = Math.max(maxEstimatedRuleHeight, estimatedHeight);

      console.log(`[transformDataToNodes] Creating Rule Node: ID=${nodeId}, Position=`, nodePosition);
      flowNodes.push({
        id: nodeId,
        type: 'rule',
        position: nodePosition,
        data: {
          id: rule.id || `rule_data_${index}`,
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
    // Advance Y below the rule area based on the tallest rule + margin
    currentContentY = ruleRowStartY + maxEstimatedRuleHeight + SEMESTER_TOP_MARGIN; 
  } else {
    // If no rules, ensure minimum top margin
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
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<AppEdge>([]);
  const [selectedNodes, setSelectedNodes] = useState<AppNode[]>([]); // Added state for selected nodes
  
  const { theme } = useTheme();

  // State for loaded data
  const [allCourses, setAllCourses] = useState<RawCourseData[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<DegreeTemplate | undefined>(undefined);
  const [initialMandatoryCourseIdsFromTemplateDefinition, setInitialMandatoryCourseIdsFromTemplateDefinition] = useState<string[] | undefined>(undefined); // NEW STATE
  const [grades, setGrades] = useState<Record<string, string>>({});

  // State for course selection modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetSemesterForModal, setTargetSemesterForModal] = useState<number | null>(null);

  // State for course detail modal
  const [isCourseDetailModalOpen, setIsCourseDetailModalOpen] = useState(false);
  const [detailedCourseInfo, setDetailedCourseInfo] = useState<RawCourseData | null>(null);

  // State for Rule Editor Modal
  const [isRuleEditorModalOpen, setIsRuleEditorModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DegreeRule | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true); // Loading state

  const handleAddCourseToSemesterCallback = useCallback((semesterNumber: number) => {
    console.log(`DegreePlanView: Request to add course to semester: ${semesterNumber}`);
    setTargetSemesterForModal(semesterNumber);
    setIsModalOpen(true);
  }, []);

  const handleAddSemesterCallback = useCallback(() => {
    console.log('DegreePlanView: Add new semester');
    setCurrentTemplate(prevTemplate => {
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
    if (targetSemesterForModal === null || !currentTemplate) return;

    setCurrentTemplate(prevTemplate => {
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
  }, [targetSemesterForModal, currentTemplate]);

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
    setCurrentTemplate(prevTemplate => {
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
  }, [setCurrentTemplate, setGrades, setSelectedNodes]); // Added setSelectedNodes to dependencies

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
    if (currentTemplate && currentTemplate.rules) {
      const ruleToEdit = currentTemplate.rules.find(r => r.id === ruleId);
      if (ruleToEdit) {
        setEditingRule(ruleToEdit);
        setIsRuleEditorModalOpen(true);
      } else {
        console.warn(`Rule with id ${ruleId} not found.`);
      }
    }
  }, [currentTemplate]);

  const handleCloseRuleEditor = useCallback(() => {
    setEditingRule(null);
    setIsRuleEditorModalOpen(false);
  }, []);

  const handleSaveRule = useCallback((updatedRule: DegreeRule) => {
    setCurrentTemplate(prevTemplate => {
      if (!prevTemplate || !prevTemplate.rules) return prevTemplate;
      const updatedRules = prevTemplate.rules.map(r => 
        r.id === updatedRule.id ? updatedRule : r
      );
      return { ...prevTemplate, rules: updatedRules };
    });
    handleCloseRuleEditor();
  }, [setCurrentTemplate, handleCloseRuleEditor]);

  const handleDeleteRule = useCallback((ruleId: string) => {
    // Consider adding a window.confirm here for user confirmation
    if (window.confirm("האם אתה בטוח שברצונך למחוק כלל זה?")) {
      setCurrentTemplate(prevTemplate => {
        if (!prevTemplate || !prevTemplate.rules) return prevTemplate;
        const updatedRules = prevTemplate.rules.filter(r => r.id !== ruleId);
        return { ...prevTemplate, rules: updatedRules };
      });
    }
  }, [setCurrentTemplate]);

  // Save/Load Callbacks
  const handleSavePlan = useCallback((slotId: number) => {
    if (currentTemplate) {
      savePlanToSlot(slotId, currentTemplate, grades);
      alert(`Plan saved to Slot ${slotId}`); // Simple feedback
    } else {
      alert("No plan data to save.");
    }
  }, [currentTemplate, grades]);

  const handleLoadPlan = useCallback((slotId: number) => {
    const loadedPlan = loadPlanFromSlot(slotId);
    if (loadedPlan) {
      setCurrentTemplate(loadedPlan.template);
      // Populate initial mandatory course IDs from the loaded template's semesters
      if (loadedPlan.template && typeof loadedPlan.template.semesters === 'object' && loadedPlan.template.semesters !== null) {
        setInitialMandatoryCourseIdsFromTemplateDefinition(Object.values(loadedPlan.template.semesters).flat());
      } else {
        setInitialMandatoryCourseIdsFromTemplateDefinition(undefined);
      }
      setGrades(loadedPlan.grades);
      alert(`Plan loaded from Slot ${slotId}`);
    } else {
      alert(`No plan found in Slot ${slotId}.`);
    }
  }, []);

  // Initial Load Effect (tries to load active plan or default)
  useEffect(() => {
    const loadInitialData = async () => {
      console.log("[DegreePlanView] Initial Load: Starting...");
      setIsLoading(true);
      const courses = await fetchAllCourses();
      console.log("[DegreePlanView] Initial Load: Fetched allCourses:", courses);
      setAllCourses(courses);
      
      const activeId = getActivePlanId();
      let loadedSuccessfully = false;
      let templateForInitialMandatoryIds: DegreeTemplate | undefined = undefined;

      if (activeId !== null) {
        console.log(`[DegreePlanView] Initial Load: Attempting to load active plan from slot: ${activeId}`);
        const loadedPlan = loadPlanFromSlot(activeId);
        console.log("[DegreePlanView] Initial Load: Loaded plan from storage:", loadedPlan);
        if (loadedPlan) {
          setCurrentTemplate(loadedPlan.template);
          setGrades(loadedPlan.grades);
          templateForInitialMandatoryIds = loadedPlan.template;
          loadedSuccessfully = true;
          console.log("[DegreePlanView] Initial Load: Successfully loaded plan from slot. currentTemplate:", loadedPlan.template);
        }
      }
      if (!loadedSuccessfully) {
        console.log("[DegreePlanView] Initial Load: No active plan loaded or load failed, fetching default template.");
        const degreeData = await fetchDegreeTemplates();
        console.log("[DegreePlanView] Initial Load: Fetched degree templates data:", degreeData);
        const firstTemplateId = Object.keys(degreeData)[0];
        console.log("[DegreePlanView] Initial Load: First template ID:", firstTemplateId);
        if (firstTemplateId && degreeData[firstTemplateId]) {
          setCurrentTemplate(degreeData[firstTemplateId]);
          templateForInitialMandatoryIds = degreeData[firstTemplateId];
          console.log("[DegreePlanView] Initial Load: Set currentTemplate to default:", degreeData[firstTemplateId]);
        } else {
          console.warn("[DegreePlanView] Initial Load: No default template found or degreeData is empty.");
        }
        setGrades({});
      }

      // Set initial mandatory course IDs based on the loaded/default template
      if (templateForInitialMandatoryIds && typeof templateForInitialMandatoryIds.semesters === 'object' && templateForInitialMandatoryIds.semesters !== null) {
        setInitialMandatoryCourseIdsFromTemplateDefinition(Object.values(templateForInitialMandatoryIds.semesters).flat());
      } else {
        setInitialMandatoryCourseIdsFromTemplateDefinition(undefined);
      }

      setIsLoading(false);
      console.log("[DegreePlanView] Initial Load: Finished. isLoading: false");
    };
    loadInitialData();
  }, []);

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
    console.log("[DegreePlanView] Node/Edge Update Effect: State before guard - isLoading:", isLoading, "currentTemplate:", currentTemplate, "allCourses count:", Array.isArray(allCourses) ? allCourses.length : 'not an array', "initialMandatoryCourseIds:", initialMandatoryCourseIdsFromTemplateDefinition);
    
    if (isLoading || !currentTemplate || !Array.isArray(allCourses) || allCourses.length === 0) {
      console.log("[DegreePlanView] Node/Edge Update Effect: Guarded. Not generating nodes/edges yet.");
      if (isLoading) console.log("Reason: isLoading is true.");
      if (!currentTemplate) console.log("Reason: currentTemplate is falsy.");
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

    console.log("[DegreePlanView] Node/Edge Update Effect: Guard passed. Generating nodes and edges with currentTemplate:", currentTemplate, "and allCourses count:", allCourses.length);
    const newNodes = transformDataToNodes(
      currentTemplate,
      allCourses,
      grades,
      handleAddCourseToSemesterCallback,
      handleAddSemesterCallback,
      handleGradeChangeCallback,
      handleRemoveCourseCallback,
      initialMandatoryCourseIdsFromTemplateDefinition,
      handleCourseNodeDoubleClick,
      handleOpenRuleEditor,
      handleDeleteRule
    );
    const newEdges = transformDataToEdges(currentTemplate, allCourses);
    console.log("[DegreePlanView] Node/Edge Update Effect: Generated newNodes count:", newNodes.length, "newEdges count:", newEdges.length);
    // console.log("[DegreePlanView] Node/Edge Update Effect: Generated newNodes content:", JSON.stringify(newNodes, null, 2)); // Potentially very verbose
    setNodes(newNodes);
    setEdges(newEdges); // This sets the base edges
  }, [currentTemplate, allCourses, grades, setNodes, setEdges, handleAddCourseToSemesterCallback, handleAddSemesterCallback, handleGradeChangeCallback, handleRemoveCourseCallback, isLoading, initialMandatoryCourseIdsFromTemplateDefinition, handleCourseNodeDoubleClick, handleOpenRuleEditor, handleDeleteRule]);

  const handleSelectionChange = useCallback(({ nodes: selNodes }: { nodes: AppNode[], edges: AppEdge[] }) => {
    setSelectedNodes(selNodes);
  }, []);

  // Filter courses for modal: exclude those already in the current plan
  const availableCoursesForModal = useMemo(() => {
    if (!currentTemplate || typeof currentTemplate.semesters !== 'object' || currentTemplate.semesters === null || !Array.isArray(allCourses)) {
      if (currentTemplate && (typeof currentTemplate.semesters !== 'object' || currentTemplate.semesters === null)) {
        console.warn('Data Structure Warning (availableCoursesForModal): currentTemplate.semesters is not an object!', currentTemplate.semesters);
      }
      return allCourses || []; // Return allCourses if valid, else empty array
    }
    const coursesInPlan = new Set<string>();
    Object.values(currentTemplate.semesters).forEach(courseIds => {
      if (Array.isArray(courseIds)) {
        courseIds.forEach((cId: string) => coursesInPlan.add(cId));
      }
    });
    return allCourses.filter(course => !coursesInPlan.has(course._id));
  }, [allCourses, currentTemplate]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
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
        rule={editingRule}
        onClose={handleCloseRuleEditor}
        onSave={handleSaveRule}
        allCourses={allCourses}
      />
      <AveragesDisplay
        currentTemplate={currentTemplate}
        allCourses={allCourses}
        grades={grades}
      />
      <PlanManagement
        onSavePlan={handleSavePlan}
        onLoadPlan={handleLoadPlan}
      />
    </div>
  );
}

export default DegreePlanView;