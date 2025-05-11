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
import { DegreeTemplate, RawCourseData, DegreeRule, PrerequisiteItem, PrerequisiteGroup, DegreesFileStructure } from '../../types/data';
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
const GLOBAL_RULES_NODE_ID_PREFIX = 'global-rule-'; // Prefix for global rule node IDs

type SaveStatus = 'idle' | 'saving' | 'saved'; // New type for save status

interface CourseDetailModalData {
  course: RawCourseData;
  coursesInPlanIds: Set<string>;
}

// NEW STATE for classification course checkboxes
const initialClassificationCheckedState: Record<string, boolean> = {};

const transformDataToNodes = (
  template: DegreeTemplate | undefined,
  allCourses: RawCourseData[],
  grades: Record<string, string>,
  onAddCourseToSemesterCallback: (semesterNumber: number) => void,
  onAddSemesterCallbackParam: () => void,
  onGradeChangeCallback: (courseId: string, grade: string) => void,
  onRemoveCourseCallback: (courseId: string) => void,
  classificationCheckedState: Record<string, boolean>,
  onClassificationToggleCallback: (courseId: string) => void,
  classificationCreditsState: Record<string, number>,
  onClassificationCreditsChangeCallback: (courseId: string, credits: number) => void,
  globalRules: DegreeRule[], // Added globalRules parameter
  initialMandatoryCourseIds?: string[],
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
  let totalRuleGroups = 0;
  const templateOtherRulesForCount: DegreeRule[] = [];
  let templateHasConsolidatedGroup = false;
  let globalHasClassificationRule = false;

  if (Array.isArray(globalRules)) {
    if (globalRules.some(rule => rule.type === 'classification_courses')) {
      globalHasClassificationRule = true;
      totalRuleGroups++;
    }
    // Add counts for other global rule types if they are to be displayed as separate nodes
  }

  if (template.rules && Array.isArray(template.rules)) {
    const consolidatedRuleTypes = new Set([
      'total_credits', 'credits_from_list', 'min_grade', 'minCredits',
      'minCoursesFromList', 'minCreditsFromMandatory', 'minCreditsFromAnySelectiveList'
    ]);
    let tempConsolidatedExists = false;
    template.rules.forEach(rule => {
      if (!rule || typeof rule.id === 'undefined' || typeof rule.description === 'undefined') return;
      if (rule.type === 'classification_courses') return; // Already counted if global

      if (consolidatedRuleTypes.has(rule.type)) {
        tempConsolidatedExists = true;
      } else {
        templateOtherRulesForCount.push(rule);
      }
    });
    if (tempConsolidatedExists) {
      templateHasConsolidatedGroup = true;
      totalRuleGroups++;
    }
    totalRuleGroups += templateOtherRulesForCount.length;
  }

  let currentRuleNodeDisplayIndex = 0; // Visual index from left (0) to right (totalRuleGroups - 1)

  // 1. Process Global "פטורים" Node (if it exists) - This should be leftmost
  if (globalHasClassificationRule) {
    const classificationRule = globalRules.find(rule => rule.type === 'classification_courses');
    if (classificationRule && classificationRule.courses) {
      const nodeId = `${GLOBAL_RULES_NODE_ID_PREFIX}${classificationRule.id}`;
      const xOffsetFactor = totalRuleGroups - 1 - currentRuleNodeDisplayIndex; // Leftmost gets highest factor
      const nodePosition = { x: (firstSemesterXPos - ruleNodeBaseXAdjustment) - xOffsetFactor * (COLUMN_WIDTH + HORIZONTAL_SPACING_SEMESTER), y: ruleRowStartY };

      const detailsForNode = classificationRule.courses.map(course => ({
        id: course.id,
        name: course.name,
        checked: classificationCheckedState[course.id] || false,
        credits: classificationCreditsState[course.id],
        creditInput: course.creditInput,
      }));

      const estimatedHeightClassification = 70 + (detailsForNode.length * 35);
      maxEstimatedRuleHeight = Math.max(maxEstimatedRuleHeight, estimatedHeightClassification);

      flowNodes.push({
        id: nodeId,
        type: 'rule',
        position: nodePosition,
        data: {
          id: classificationRule.id, // Original rule ID for data consistency
          description: "פטורים",
          currentProgress: "בחר פטורים שהושלמו",
          isSatisfied: false, // Neutral styling
          classificationCourseDetails: detailsForNode,
          onClassificationToggle: onClassificationToggleCallback,
          onClassificationCreditsChange: onClassificationCreditsChangeCallback,
          // Global rules are generally not editable/deletable in this context
        },
      });
      currentRuleNodeDisplayIndex++; // Increment after placing the node
    }
  }

  // 2. Process Other Template-Specific Rules (e.g., minCoursesFromMultipleLists)
  // This section is MOVED UP to be processed before the Consolidated Rule Node.
  const otherRules = template.rules!.filter(rule => {
    const consolidatedRuleTypes = new Set([
      'total_credits', 'credits_from_list', 'min_grade', 'minCredits',
      'minCoursesFromList', 'minCreditsFromMandatory', 'minCreditsFromAnySelectiveList'
    ]);
    return rule.type !== 'classification_courses' && !consolidatedRuleTypes.has(rule.type) && rule.id && rule.description;
  });

  otherRules.forEach((rule) => {
    const ruleStatus = evaluateRule(
      rule, coursesInCurrentPlan, grades, allCourses,
      template.semesters, template["courses-lists"], initialMandatoryCourseIds,
      classificationCheckedState, classificationCreditsState
    );
    const nodeId = `rule-${rule.id}`;
    
    let estimatedHeight = 120; 
    if (rule.type === 'minCoursesFromMultipleLists' && rule.lists) {
      estimatedHeight = 70 + (rule.lists.length * 50); 
    }
    maxEstimatedRuleHeight = Math.max(maxEstimatedRuleHeight, estimatedHeight);

    const xOffsetFactor = totalRuleGroups - 1 - currentRuleNodeDisplayIndex;
    flowNodes.push({
      id: nodeId,
      type: 'rule',
      position: { x: (firstSemesterXPos - ruleNodeBaseXAdjustment) - xOffsetFactor * (COLUMN_WIDTH + HORIZONTAL_SPACING_SEMESTER), y: ruleRowStartY },
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
    currentRuleNodeDisplayIndex++;
  });

  // 3. Process Template-Specific Consolidated Rule Node (if it exists) - Now processed last among rule groups
  if (templateHasConsolidatedGroup) {
    const rulesToConsolidate = template.rules!.filter(rule => {
      const consolidatedRuleTypes = new Set([
        'total_credits', 'credits_from_list', 'min_grade', 'minCredits',
        'minCoursesFromList', 'minCreditsFromMandatory', 'minCreditsFromAnySelectiveList'
      ]);
      return rule.type !== 'classification_courses' && consolidatedRuleTypes.has(rule.type);
    });

    if (rulesToConsolidate.length > 0) {
      const consolidatedNodeId = CONSOLIDATED_RULES_NODE_ID;
      const consolidatedRuleDetails: RuleNodeData['consolidatedRules'] = [];
      let allConsolidatedSatisfied = true;

      rulesToConsolidate.forEach(rule => {
        const ruleStatus = evaluateRule(
          rule, coursesInCurrentPlan, grades, allCourses,
          template.semesters, template["courses-lists"], initialMandatoryCourseIds,
          classificationCheckedState, classificationCreditsState
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
      
      const estimatedHeightConsolidated = 60 + consolidatedRuleDetails!.length * 60;
      maxEstimatedRuleHeight = Math.max(maxEstimatedRuleHeight, estimatedHeightConsolidated);

      const xOffsetFactor = totalRuleGroups - 1 - currentRuleNodeDisplayIndex;
      flowNodes.push({
        id: consolidatedNodeId,
        type: 'rule',
        position: { x: (firstSemesterXPos - ruleNodeBaseXAdjustment) - xOffsetFactor * (COLUMN_WIDTH + HORIZONTAL_SPACING_SEMESTER), y: ruleRowStartY },
        data: {
          id: consolidatedNodeId,
          description: "התקדמות אקדמית כללית",
          currentProgress: `${consolidatedRuleDetails!.filter((r: NonNullable<RuleNodeData['consolidatedRules']>[number]) => r.isSatisfied).length} / ${consolidatedRuleDetails!.length} תתי-כללים הושלמו`,
          isSatisfied: allConsolidatedSatisfied,
          consolidatedRules: consolidatedRuleDetails,
          onEditRule: onEditRuleCallback,
          onDeleteRule: onDeleteRuleCallback,
        },
      });
      currentRuleNodeDisplayIndex++;
    }
  }

  currentContentY = ruleRowStartY + maxEstimatedRuleHeight + SEMESTER_TOP_MARGIN;

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
      if (!courseData) {
        console.warn(`[transformDataToNodes] Course data not found for courseId: ${courseId}`);
        return;
      }

      const prereqsMet = checkPrerequisites(
        courseData, 
        semesterNumberForLayout, 
        template.semesters, 
        allCourses,
        classificationCheckedState
      );

      const nodeId = courseId;
      const nodePosition = { x: semesterXPos, y: currentYInSemester };
      console.log(`[transformDataToNodes] Creating Course Node: ID=${nodeId}, Position=`, nodePosition);
      
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

  if (currentRuleNodeDisplayIndex > 0) { // If any rule nodes were processed
    currentContentY = ruleRowStartY + maxEstimatedRuleHeight + SEMESTER_TOP_MARGIN;
  } else { // No rules at all
    currentContentY = Math.max(currentContentY, SEMESTER_TOP_MARGIN);
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
  const edgeIdSet = new Set<string>(); // Track unique edge IDs
  const allCourseIdsInPlan = Object.values(template.semesters).flat();
  console.log('[transformDataToEdges] All course IDs in current plan:', allCourseIdsInPlan);

  const isCourseInPlan = (courseId: string): boolean => {
    const result = allCourseIdsInPlan.includes(courseId);
    return result;
  };

  allCourseIdsInPlan.forEach(courseId => {
    const course = allCourses.find(c => c._id === courseId);
    if (course && course.prereqTree) {
      const processPrerequisites = (prereq: PrerequisiteItem | PrerequisiteGroup | { or?: (PrerequisiteItem | PrerequisiteGroup)[], and?: (PrerequisiteItem | PrerequisiteGroup)[] }, targetCourseId: string) => {
        if (typeof prereq === 'string') {
          const edgeId = `edge-${prereq}-${targetCourseId}`;
          if (isCourseInPlan(prereq) && !edgeIdSet.has(edgeId)) {
            edges.push({
              id: edgeId,
              source: prereq,
              target: targetCourseId,
              type: 'default',
              markerEnd: { type: MarkerType.ArrowClosed, color: '#cccccc' },
              animated: false,
              style: { stroke: '#cccccc', strokeWidth: 1.5, strokeOpacity: 0.2 },
              pathOptions: { curvature: 0.25 }
            });
            edgeIdSet.add(edgeId);
          }
        } else if (prereq && typeof prereq === 'object') {
          let itemsToProcess: (PrerequisiteItem | PrerequisiteGroup)[] = [];
          if (Array.isArray((prereq as { or?: [] }).or)) {
            itemsToProcess = (prereq as { or: [] }).or;
          } else if (Array.isArray((prereq as { and?: [] }).and)) {
            itemsToProcess = (prereq as { and: [] }).and;
          } else if (Array.isArray((prereq as PrerequisiteGroup).list)) {
            itemsToProcess = (prereq as PrerequisiteGroup).list;
          }
          if (itemsToProcess.length > 0) {
            itemsToProcess.forEach(item => processPrerequisites(item, targetCourseId));
          }
        }
      };
      processPrerequisites(course.prereqTree, courseId);
    }
  });
  console.log('[transformDataToEdges] Finished. Total edges generated:', edges.length);
  return edges;
};

function DegreePlanView() {
  const { theme } = useTheme();
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<AppEdge>([]);
  const [allCoursesData, setAllCoursesData] = useState<RawCourseData[]>([]);
  const [degreeTemplate, setDegreeTemplate] = useState<DegreeTemplate | undefined>(undefined);
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [semesterToAddCourseTo, setSemesterToAddCourseTo] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [courseDetailModalData, setCourseDetailModalData] = useState<CourseDetailModalData | null>(null);
  const [editingRule, setEditingRule] = useState<DegreeRule | null>(null);
  const [isRuleEditorOpen, setIsRuleEditorOpen] = useState(false);
  const [isCourseListEditorOpen, setIsCourseListEditorOpen] = useState(false);
  // const reactFlowWrapper = useRef<HTMLDivElement>(null); // Commented out - unused
  const [isConsolidatedRuleEditorOpen, setIsConsolidatedRuleEditorOpen] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState<AppNode[]>([]);
  // State for consolidated rule editing (was missing)
  const [rulesForConsolidatedEditing, setRulesForConsolidatedEditing] = useState<DegreeRule[]>([]);
  const [currentGlobalRules, setCurrentGlobalRules] = useState<DegreeRule[]>([]); // New state for global rules

  // Moved isLoading, setIsLoading, and autosaveTimeoutRef to the top with other hooks
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const autosaveTimeoutRef = useRef<number | null>(null);

  // NEW STATE and HANDLER for classification checkboxes
  const [classificationChecked, setClassificationChecked] = useState<Record<string, boolean>>(initialClassificationCheckedState);
  const [classificationCredits, setClassificationCredits] = useState<Record<string, number>>({});

  const handleClassificationToggle = useCallback((courseId: string) => {
    setClassificationChecked(prev => {
      const newState = { ...prev, [courseId]: !prev[courseId] };
      // If 'miluim_exemption' is being unchecked, reset its credits
      if (courseId === 'miluim_exemption' && !newState[courseId]) {
        setClassificationCredits(creditPrev => ({ ...creditPrev, [courseId]: 0 }));
      }
      return newState;
    });
  }, []);

  const handleClassificationCreditsChange = useCallback((courseId: string, credits: number) => {
    setClassificationCredits(prev => ({ ...prev, [courseId]: credits }));
  }, []);

  // Derived state for courses in plan to pass to modal
  const coursesInPlanFlatIds = useMemo(() => {
    if (!degreeTemplate || !degreeTemplate.semesters) return new Set<string>();
    return new Set(Object.values(degreeTemplate.semesters).flat().filter(id => typeof id === 'string')) as Set<string>;
  }, [degreeTemplate]);

  const initialMandatoryCourseIds = useMemo(() => {
    if (!degreeTemplate) return undefined;

    // Prioritize explicitly defined mandatory courses
    if (Array.isArray(degreeTemplate.definedMandatoryCourseIds) && degreeTemplate.definedMandatoryCourseIds.length > 0) {
      return degreeTemplate.definedMandatoryCourseIds;
    }

    // Fallback: Derive from all courses listed in semesters if not explicitly defined
    if (typeof degreeTemplate.semesters === 'object' && degreeTemplate.semesters !== null) {
      const allSemesterCourses = Object.values(degreeTemplate.semesters).flat().filter(id => typeof id === 'string');
      if (allSemesterCourses.length > 0) {
        return allSemesterCourses as string[];
      }
    }
    
    return undefined; // Return undefined if no mandatory courses can be determined
  }, [degreeTemplate]);

  const handleAddCourseToSemesterCallback = useCallback((semesterNumber: number) => {
    console.log(`DegreePlanView: Request to add course to semester: ${semesterNumber}`);
    setSemesterToAddCourseTo(semesterNumber);
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
    if (semesterToAddCourseTo === null || !degreeTemplate) return;

    setDegreeTemplate(prevTemplate => {
      if (!prevTemplate || typeof prevTemplate.semesters !== 'object') return prevTemplate;

      const semesterEntries = Object.entries(prevTemplate.semesters);
      // semesterToAddCourseTo is 1-based
      if (semesterToAddCourseTo <= 0 || semesterToAddCourseTo > semesterEntries.length) {
        console.warn(`Invalid semesterToAddCourseTo: ${semesterToAddCourseTo}, current semester count: ${semesterEntries.length}`);
        return prevTemplate;
      }

      const targetSemesterKey = semesterEntries[semesterToAddCourseTo - 1][0]; // Get the key of the target semester

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
    setSemesterToAddCourseTo(null);
  }, [semesterToAddCourseTo, degreeTemplate]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSemesterToAddCourseTo(null);
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

  // Node double-click handler
  const handleNodeDoubleClick = useCallback((_event: React.MouseEvent, node: AppNode) => {
    console.log('[DegreePlanView] handleNodeDoubleClick called with node:', node);
    if (node.type === 'course' && node.data) {
      const courseId = node.data.courseId as string;
      const foundCourse = allCoursesData.find(c => c._id === courseId);
      if (foundCourse) {
        setCourseDetailModalData({ course: foundCourse, coursesInPlanIds: coursesInPlanFlatIds });
        // setIsCourseDetailModalOpen(true); // Removed, covered by setCourseDetailModalData
      }
    }
    if (node.type === 'rule' && node.data && node.data.id) {
      const ruleId = node.data.id as string;
      if (ruleId === CONSOLIDATED_RULES_NODE_ID) {
        const rulesToEdit = degreeTemplate?.rules?.filter(rule =>
          new Set([
            'total_credits', 'credits_from_list', 'min_grade', 'minCredits',
            'minCoursesFromList', 'minCreditsFromMandatory', 'minCreditsFromAnySelectiveList'
          ]).has(rule.type)
        ) || [];
        if (rulesToEdit.length > 0) {
          setRulesForConsolidatedEditing(rulesToEdit);
          setIsConsolidatedRuleEditorOpen(true);
        }
      } else {
        const ruleToEdit = degreeTemplate?.rules?.find(r => r.id === ruleId);
        if (ruleToEdit) {
          setEditingRule(ruleToEdit);
          setIsRuleEditorOpen(true);
        }
      }
    }
  }, [allCoursesData, coursesInPlanFlatIds, degreeTemplate, /* setIsCourseDetailModalOpen, */ setCourseDetailModalData, setEditingRule, setIsRuleEditorOpen, setRulesForConsolidatedEditing, setIsConsolidatedRuleEditorOpen]);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: AppNode) => {
    console.log('[DegreePlanView] handleNodeClick called with node:', node);
  }, []);

  // Rule Editor Handlers
  const handleCloseRuleEditor = useCallback(() => {
    setEditingRule(null);
    setIsRuleEditorOpen(false);
  }, []);

  const handleSaveRule = useCallback((updatedRule: DegreeRule) => {
    if (!degreeTemplate || !degreeTemplate.rules) return;
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
    setIsCourseListEditorOpen(prev => !prev);
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
    setIsCourseListEditorOpen(false); // Explicitly close modal here
  }, [setDegreeTemplate, setIsCourseListEditorOpen]);

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
        setIsConsolidatedRuleEditorOpen(true);
      } else {
        console.warn("Consolidated rule node edit triggered, but no matching rules found in template.");
      }
    } else {
      const ruleToEdit = degreeTemplate.rules.find(r => r.id === ruleId);
      if (ruleToEdit) {
        setEditingRule(ruleToEdit);
        setIsRuleEditorOpen(true);
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
    setIsConsolidatedRuleEditorOpen(false);
    setRulesForConsolidatedEditing([]);
  }, [degreeTemplate]);

  // Autosave Effect
  useEffect(() => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }
    autosaveTimeoutRef.current = window.setTimeout(() => {
      if (degreeTemplate && !isLoading) { // Ensure template is loaded and not in initial loading phase
        console.log("[DegreePlanView] Autosaving plan...");
        savePlan(degreeTemplate, grades, classificationChecked, classificationCredits); // Pass classificationChecked and classificationCredits
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000); // Reset status after 2s
      }
    }, 1500); // Autosave 1.5 seconds after last relevant change

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [degreeTemplate, grades, classificationChecked, classificationCredits, isLoading]); // Added classificationChecked, classificationCredits and isLoading

  // Initial Data Load Effect
  useEffect(() => {
    const loadInitialData = async () => {
      console.log("[DegreePlanView] Initial Load: Starting data fetch and plan load.");
      setIsLoading(true); // Set loading true at the start
      try {
        const courses = await fetchAllCourses();
        console.log("[DegreePlanView] Initial Load: Fetched allCourses:", courses);
        setAllCoursesData(courses);
        
        let fetchedDegreeFileData: DegreesFileStructure | undefined = undefined;
        let templateForProcessing: DegreeTemplate | undefined = undefined;
        let globalRulesForProcessing: DegreeRule[] = [];
        let gradesForProcessing: Record<string, string> = {};
        let classificationCheckedForProcessing: Record<string, boolean> = {}; // Initialize
        let classificationCreditsForProcessing: Record<string, number> = {}; // Initialize

        const savedPlanData = loadPlan();
        if (savedPlanData) {
          console.log("[DegreePlanView] Initial Load: Found saved plan.", savedPlanData);
          // Saved plan only contains the specific template, global rules are re-fetched
          templateForProcessing = savedPlanData.template;
          gradesForProcessing = savedPlanData.grades || {};
          classificationCheckedForProcessing = savedPlanData.classificationChecked || {};
          classificationCreditsForProcessing = savedPlanData.classificationCredits || {};

          // Fetch all degree data to get global rules, even when loading a saved plan
          fetchedDegreeFileData = await fetchDegreeTemplates();
          globalRulesForProcessing = fetchedDegreeFileData?.globalRules || [];

          // Restore initial mandatory courses from the saved template if they exist
          if (savedPlanData.template?.definedMandatoryCourseIds) {
            // setInitialMandatoryCourses(savedPlanData.template.definedMandatoryCourseIds); // Commented out
          }
        } else {
          console.log("[DegreePlanView] Initial Load: No saved plan found, fetching default template and global rules.");
          fetchedDegreeFileData = await fetchDegreeTemplates();
          const defaultTemplateId = 'mechanical-engineering-general'; 
          templateForProcessing = fetchedDegreeFileData[defaultTemplateId] as DegreeTemplate | undefined;
          globalRulesForProcessing = fetchedDegreeFileData?.globalRules || [];
          
          if (templateForProcessing?.definedMandatoryCourseIds) {
            // setInitialMandatoryCourses(templateForProcessing.definedMandatoryCourseIds); // Commented out
          } else if (templateForProcessing) {
            // Fallback: if definedMandatoryCourseIds is not present, derive from semesters
            // const mandatoryIds = Object.values(templateForProcessing.semesters || {}).flat(); // Commented out - unused
            // setInitialMandatoryCourses(mandatoryIds); // Commented out
            // Optionally, add it to the template for future saves if this logic is desired persist
            // templateForProcessing.definedMandatoryCourseIds = mandatoryIds; 
          }
        }

        if (templateForProcessing) {
          console.log("[DegreePlanView] Initial Load: Setting degree template:", templateForProcessing);
          setDegreeTemplate(templateForProcessing);
          setCurrentGlobalRules(globalRulesForProcessing); // Set global rules
          setGrades(gradesForProcessing);
          setClassificationChecked(classificationCheckedForProcessing);
          setClassificationCredits(classificationCreditsForProcessing);
        } else {
          console.error("[DegreePlanView] Initial Load: No template could be loaded (neither saved nor default).");
          // Handle error case: set some default empty state or show error message
        }
      } catch (error) {
        console.error("[DegreePlanView] Initial Load: Error loading initial data:", error);
        // Handle error appropriately
      } finally {
        console.log("[DegreePlanView] Initial Load: Finished. Setting isLoading to false.");
        setIsLoading(false); // Set loading to false after all operations
      }
    };

    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, []); // Runs once on mount

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
    console.log("[DegreePlanView] Node/Edge Update Effect: State before guard - isLoading:", isLoading, "currentTemplate:", degreeTemplate, "allCourses count:", Array.isArray(allCoursesData) ? allCoursesData.length : 'not an array');
    
    if (isLoading || !degreeTemplate || !Array.isArray(allCoursesData) || allCoursesData.length === 0) {
      console.log("[DegreePlanView] Node/Edge Update Effect: Guarded. Not generating nodes/edges yet.");
      if (isLoading) console.log("Reason: isLoading is true.");
      if (!degreeTemplate) console.log("Reason: currentTemplate is falsy.");
      if (!Array.isArray(allCoursesData)) console.log("Reason: allCourses is not an array.");
      if (Array.isArray(allCoursesData) && allCoursesData.length === 0) console.log("Reason: allCourses is an empty array.");
      // Optionally, if nodes are empty and not loading, set them to empty to clear previous state
      if (!isLoading && nodes.length > 0) {
         console.log("[DegreePlanView] Node/Edge Update Effect: Clearing existing nodes as conditions not met.");
         setNodes([]);
         setEdges([]);
      }
      return;
    }

    console.log("[DegreePlanView] Node/Edge Update Effect: Guard passed. Generating nodes and edges with currentTemplate:", degreeTemplate, "and allCourses count:", allCoursesData.length);
    const newNodes = transformDataToNodes(
      degreeTemplate,
      allCoursesData,
      grades,
      handleAddCourseToSemesterCallback,
      handleAddSemesterCallback,
      handleGradeChangeCallback,
      handleRemoveCourseCallback,
      classificationChecked,
      handleClassificationToggle,
      classificationCredits,
      handleClassificationCreditsChange,
      currentGlobalRules, // Pass global rules
      initialMandatoryCourseIds,
      handleEditRule,
      handleDeleteRule
    );
    const newEdges = transformDataToEdges(degreeTemplate, allCoursesData);
    console.log("[DegreePlanView] Node/Edge Update Effect: Generated newNodes count:", newNodes.length, "newEdges count:", newEdges.length);
    // console.log("[DegreePlanView] Node/Edge Update Effect: Generated newNodes content:", JSON.stringify(newNodes, null, 2)); // Potentially very verbose
    setNodes(newNodes);
    setEdges(newEdges); // This sets the base edges
  }, [degreeTemplate, allCoursesData, grades, setNodes, setEdges, handleAddCourseToSemesterCallback, handleAddSemesterCallback, handleGradeChangeCallback, handleRemoveCourseCallback, isLoading, handleEditRule, handleDeleteRule, initialMandatoryCourseIds, classificationChecked, handleClassificationToggle, classificationCredits, handleClassificationCreditsChange, currentGlobalRules]); // Added currentGlobalRules

  const handleSelectionChange = useCallback(({ nodes: selNodes }: { nodes: AppNode[], edges: AppEdge[] }) => {
    setSelectedNodes(selNodes);
  }, []);

  // Filter courses for modal: exclude those already in the current plan AND classification courses
  const availableCoursesForModal = useMemo(() => {
    if (!degreeTemplate || typeof degreeTemplate.semesters !== 'object' || degreeTemplate.semesters === null || !Array.isArray(allCoursesData)) {
      if (degreeTemplate && (typeof degreeTemplate.semesters !== 'object' || degreeTemplate.semesters === null)) {
        console.warn('Data Structure Warning (availableCoursesForModal): currentTemplate.semesters is not an object!', degreeTemplate.semesters);
      }
      // Filter out classification courses even if other checks fail, provided allCoursesData is an array
      return Array.isArray(allCoursesData) ? allCoursesData.filter(course => !course.isClassificationCourse) : [];
    }
    const coursesInPlan = new Set<string>();
    Object.values(degreeTemplate.semesters).forEach(semesterCourseList => {
      semesterCourseList.forEach(id => coursesInPlan.add(id));
    });
    // Filter out courses already in plan AND classification courses
    return allCoursesData.filter(course => !coursesInPlan.has(course._id) && !course.isClassificationCourse);
  }, [allCoursesData, degreeTemplate]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div className="fixed top-4 left-4 z-50 flex flex-row-reverse items-center gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2">
        {/* Leftmost: Logo (no shadow) */}
        <Logo />
        {/* Theme Toggle */}
        <ThemeToggleButton />
        <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2" />
        {/* Save Status */}
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && <span className="text-xs text-slate-600 dark:text-slate-300 p-1 bg-slate-200 dark:bg-slate-700 rounded">שומר...</span>}
          {saveStatus === 'saved' && <span className="text-xs text-green-600 dark:text-green-400 p-1 bg-green-100 dark:bg-green-800 rounded">נשמר ✓</span>}
        </div>
        <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2" />
        {/* Rightmost: Edit Course List Button */}
        <button 
          onClick={handleToggleCourseListEditorModal}
          className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
        >
          ערוך רשימות קורסים
        </button>
      </div>
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
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodeClick={handleNodeClick}
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
        semesterNumber={semesterToAddCourseTo}
      />
      {courseDetailModalData && courseDetailModalData.course && (
        <CourseDetailModal
          isOpen={!!courseDetailModalData} // Changed from isCourseDetailModalOpen
          onClose={() => {
            // setIsCourseDetailModalOpen(false); // Removed, covered by setCourseDetailModalData(null)
            setCourseDetailModalData(null); // Clear the whole object
          }}
          course={courseDetailModalData.course} // This is now guaranteed to be RawCourseData
          allCourses={allCoursesData}
          coursesInPlanIds={courseDetailModalData.coursesInPlanIds}
        />
      )}
      <RuleEditorModal
        isOpen={isRuleEditorOpen}
        rule={editingRule}
        onClose={handleCloseRuleEditor}
        onSave={handleSaveRule}
        availableCourseListNames={degreeTemplate && degreeTemplate["courses-lists"] ? Object.keys(degreeTemplate["courses-lists"]) : []}
      />
      <CourseListEditorModal
        isOpen={isCourseListEditorOpen}
        onClose={handleToggleCourseListEditorModal}
        allCourses={allCoursesData}
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
        isOpen={isConsolidatedRuleEditorOpen}
        rules={rulesForConsolidatedEditing}
        onClose={() => {
          setIsConsolidatedRuleEditorOpen(false);
          setRulesForConsolidatedEditing([]);
        }}
        onSave={handleSaveConsolidatedRules}
      />
      <AveragesDisplay
        currentTemplate={degreeTemplate}
        allCourses={allCoursesData}
        grades={grades}
      />
    </div>
  );
}

export default DegreePlanView;