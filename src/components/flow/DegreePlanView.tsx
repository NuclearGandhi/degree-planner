import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Background,
  // MiniMap, // Commented out as it's no longer used
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  Connection,
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

const nodeTypes = {
  course: CourseNode,
  rule: RuleNode,
  addCourse: AddCourseNode,
  addSemester: AddSemesterNode,
  semesterTitle: SemesterTitleNode,
};

const COLUMN_WIDTH = 300; // Increased width of a semester column
const NODE_HEIGHT_COURSE = 90; // Increased approximate height of a course node
const NODE_HEIGHT_RULE = 70;
const VERTICAL_SPACING_RULE = 40; // Further increased vertical spacing
const HORIZONTAL_SPACING_SEMESTER = 50; // New: Spacing between semester columns
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
  onRemoveCourseCallback: (courseId: string) => void
): AppNode[] => {
  if (!template || typeof template.semesters !== 'object' || template.semesters === null) {
    if (template && (typeof template.semesters !== 'object' || template.semesters === null)) {
      console.warn('Data Structure Warning (transformDataToNodes): template.semesters is not an object!', template.semesters);
    }
    return [];
  }

  const flowNodes: AppNode[] = [];
  let currentContentY = VERTICAL_SPACING_RULE; // Initial Y for the topmost content (rules or semester titles)

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
        template["courses-lists"]
      );
      const nodeId = `rule-${rule.id || index}`;
      const firstSemesterXPos = baseSemesterAreaStartX + (maxSemesterNum > 0 ? (maxSemesterNum - 1) : 0) * (COLUMN_WIDTH + HORIZONTAL_SPACING_SEMESTER);
      const nodePosition = { x: firstSemesterXPos - index * (COLUMN_WIDTH + HORIZONTAL_SPACING_SEMESTER), y: currentContentY };
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
        },
      });
    });
    currentContentY += NODE_HEIGHT_RULE + SEMESTER_TOP_MARGIN; // Advance Y below the rule area
  } else {
    // If no rules, ensure semester titles still respect a top margin.
    // If VERTICAL_SPACING_RULE is already >= SEMESTER_TOP_MARGIN, this might be redundant,
    // but it ensures SEMESTER_TOP_MARGIN is the effective minimum if VERTICAL_SPACING_RULE is smaller.
    currentContentY = Math.max(currentContentY, SEMESTER_TOP_MARGIN);
  }

  // Semester Title and Course Node Generation (uses already calculated values)
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
      // Position it in the first (rightmost in RTL) column, vertically aligned with semester content start
      position: { x: HORIZONTAL_SPACING_SEMESTER / 2, y: currentContentY },
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

  const isCourseInPlan = (courseId: string): boolean => {
    return allCourseIdsInPlan.includes(courseId);
  };

  // Iterate over each course in the plan to find its prerequisites
  allCourseIdsInPlan.forEach(courseId => {
    const course = allCourses.find(c => c._id === courseId);
    if (course && course.prerequisites) {
      const processPrerequisites = (prereq: PrerequisiteItem | PrerequisiteGroup, targetCourseId: string) => {
        if (typeof prereq === 'string') { // Prereq is a course ID
          if (isCourseInPlan(prereq)) { // Check if the prerequisite course is also in the plan
            edges.push({
              id: `edge-${prereq}-${targetCourseId}`,
              source: prereq,
              target: targetCourseId,
              type: 'smoothstep',
              markerEnd: { type: MarkerType.ArrowClosed },
              animated: false,
              style: { stroke: '#888' },
            });
          }
        } else if (prereq && typeof prereq === 'object' && Array.isArray((prereq as PrerequisiteGroup).list)) { // Prereq is a group
          (prereq as PrerequisiteGroup).list.forEach(item => processPrerequisites(item, targetCourseId));
        }
      };
      processPrerequisites(course.prerequisites, courseId);
    }
  });
  return edges;
};

function DegreePlanView() {
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<AppEdge>([]);
  
  const { theme } = useTheme();

  // State for loaded data
  const [allCourses, setAllCourses] = useState<RawCourseData[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<DegreeTemplate | undefined>(undefined);
  const [grades, setGrades] = useState<Record<string, string>>({});

  // State for course selection modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetSemesterForModal, setTargetSemesterForModal] = useState<number | null>(null);

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
  }, []);

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
      if (activeId !== null) {
        console.log(`[DegreePlanView] Initial Load: Attempting to load active plan from slot: ${activeId}`);
        const loadedPlan = loadPlanFromSlot(activeId);
        console.log("[DegreePlanView] Initial Load: Loaded plan from storage:", loadedPlan);
        if (loadedPlan) {
          setCurrentTemplate(loadedPlan.template);
          setGrades(loadedPlan.grades);
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
          console.log("[DegreePlanView] Initial Load: Set currentTemplate to default:", degreeData[firstTemplateId]);
        } else {
          console.warn("[DegreePlanView] Initial Load: No default template found or degreeData is empty.");
        }
        setGrades({});
      }
      setIsLoading(false);
      console.log("[DegreePlanView] Initial Load: Finished. isLoading: false");
    };
    loadInitialData();
  }, []);

  // useEffect to update nodes/edges when data changes
  useEffect(() => {
    console.log("[DegreePlanView] Node/Edge Update Effect: Triggered. Dependencies changed.");
    console.log("[DegreePlanView] Node/Edge Update Effect: State before guard - isLoading:", isLoading, "currentTemplate:", currentTemplate, "allCourses count:", Array.isArray(allCourses) ? allCourses.length : 'not an array');
    
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
      handleRemoveCourseCallback
    );
    const newEdges = transformDataToEdges(currentTemplate, allCourses);
    console.log("[DegreePlanView] Node/Edge Update Effect: Generated newNodes count:", newNodes.length, "newEdges count:", newEdges.length);
    // console.log("[DegreePlanView] Node/Edge Update Effect: Generated newNodes content:", JSON.stringify(newNodes, null, 2)); // Potentially very verbose
    setNodes(newNodes);
    setEdges(newEdges);
  }, [currentTemplate, allCourses, grades, setNodes, setEdges, handleAddCourseToSemesterCallback, handleAddSemesterCallback, handleGradeChangeCallback, handleRemoveCourseCallback, isLoading]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

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
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="top-right"
          colorMode={theme}
          nodesDraggable={false}
          nodesConnectable={false}
          selectNodesOnDrag={false}
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