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
};

const COLUMN_WIDTH = 250; // Width of a semester column
const NODE_HEIGHT_COURSE = 80; // Approximate height of a course node for vertical spacing
const NODE_HEIGHT_RULE = 70; // Approximate height of a rule node
const HORIZONTAL_SPACING_RULE = 50;
const VERTICAL_SPACING_RULE = 20;
const SEMESTER_TOP_MARGIN = 50; // Space below rules / above first course in a semester
const ADD_SEMESTER_NODE_ID = 'add-new-semester-button';
const MAX_SEMESTERS = 16;

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
  let yPosRules = VERTICAL_SPACING_RULE;

  const allCourseIdsInTemplate = Object.values(template.semesters).flat();
  const coursesInCurrentPlan = (Array.isArray(allCourses) ? allCourseIdsInTemplate
    .map(courseId => allCourses.find(c => c._id === courseId))
    .filter(Boolean) : []) as RawCourseData[];

  if (template.rules && Array.isArray(template.rules)) {
    template.rules.forEach((rule: DegreeRule, index: number) => {
      const ruleStatus = evaluateRule(
        rule,
        coursesInCurrentPlan,
        grades,
        allCourses,
        template["courses-lists"] || []
      );
      flowNodes.push({
        id: `rule-${rule.id || index}`,
        type: 'rule',
        position: { x: HORIZONTAL_SPACING_RULE + index * (COLUMN_WIDTH + 20), y: yPosRules },
        data: {
          id: rule.id || `rule_data_${index}`,
          description: rule.description,
          currentProgress: ruleStatus.currentProgressString,
          isSatisfied: ruleStatus.isSatisfied,
        },
      });
    });
    yPosRules += template.rules.length > 0 ? NODE_HEIGHT_RULE + SEMESTER_TOP_MARGIN : SEMESTER_TOP_MARGIN;
  } else if (template.rules) {
    console.warn('Data Structure Warning (transformDataToNodes): template.rules is not an array!', template.rules);
  }

  const semesterEntries = Object.entries(template.semesters);
  const numExistingSemesters = semesterEntries.length;
  const maxSemesterNum = numExistingSemesters;
  const semesterAreaStartX = numExistingSemesters < MAX_SEMESTERS ? COLUMN_WIDTH : 0;

  semesterEntries.forEach(([, courseIds], semesterIndex) => {
    const semesterNumberForLayout = semesterIndex + 1;
    let currentYInSemester = yPosRules;
    const semesterXPos = semesterAreaStartX + (maxSemesterNum - semesterNumberForLayout) * COLUMN_WIDTH;

    courseIds.forEach((courseId) => {
      const courseData = allCourses.find(c => c._id === courseId);
      if (courseData) {
        flowNodes.push({
          id: courseId,
          type: 'course',
          position: { x: semesterXPos, y: currentYInSemester },
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
      }
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
      position: { x: 0, y: yPosRules + NODE_HEIGHT_COURSE / 2 },
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
      setIsLoading(true);
      const courses = await fetchAllCourses();
      setAllCourses(courses); // Need all courses regardless
      
      const activeId = getActivePlanId();
      let loadedSuccessfully = false;
      if (activeId !== null) {
        console.log(`Attempting to load active plan from slot: ${activeId}`);
        const loadedPlan = loadPlanFromSlot(activeId);
        if (loadedPlan) {
          setCurrentTemplate(loadedPlan.template);
          setGrades(loadedPlan.grades);
          loadedSuccessfully = true;
        }
      }
      if (!loadedSuccessfully) {
        console.log("No active plan loaded, fetching default template.");
        const degreeData = await fetchDegreeTemplates();
        const firstTemplateId = Object.keys(degreeData)[0];
        if (firstTemplateId) {
          setCurrentTemplate(degreeData[firstTemplateId]);
        }
        setGrades({}); // Reset grades if loading default
      }
      setIsLoading(false);
    };
    loadInitialData();
  }, []); // Run only once on mount

  // useEffect to update nodes/edges when data changes
  useEffect(() => {
    // Don't run node/edge generation if initial data is still loading
    // or if allCourses is not yet populated as an array, or currentTemplate not set
    if (isLoading || !currentTemplate || !Array.isArray(allCourses)) {
        return;
    }

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
    setNodes(newNodes);
    setEdges(newEdges);
  }, [currentTemplate, allCourses, grades, setNodes, setEdges, handleAddCourseToSemesterCallback, handleAddSemesterCallback, handleGradeChangeCallback, handleRemoveCourseCallback, isLoading]); // Added isLoading dependency

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