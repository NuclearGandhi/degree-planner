import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  MarkerType,
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnSelectionChangeParams,
  NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import CourseNode from './customNodes/CourseNode';
import RuleNode from './customNodes/RuleNode';
import AddCourseNode from './customNodes/AddCourseNode';
import AddSemesterNode from './customNodes/AddSemesterNode';
import SemesterTitleNode from './customNodes/SemesterTitleNode';
import EditCoursesNode from './customNodes/EditCoursesNode';
import { CourseSelectionModal } from '../../components/ui/CourseSelectionModal';
import { fetchAllCourses, fetchDegreeTemplates } from '../../utils/dataLoader';
import { DegreeTemplate, RawCourseData, DegreeRule, PrerequisiteItem, PrerequisiteGroup } from '../../types/data';
import { CourseNodeData, RuleNodeData } from '../../types/flow';
import { evaluateRule } from '../../utils/ruleEvaluator';
import { AveragesDisplay } from '../../components/ui/AveragesDisplay';
import { savePlan, loadPlan, StoredPlan } from '../../utils/planStorage';
import { useTheme } from '../../hooks/useTheme';
import { numberToHebrewLetter } from '../../utils/hebrewUtils';
import { checkPrerequisites, PrereqStatus } from '../../utils/prerequisiteChecker';
import { CourseDetailModal } from '../../components/ui/CourseDetailModal';
import RuleEditorModal from '../../components/ui/RuleEditorModal';
import CourseListEditorModal from '../../components/ui/CourseListEditorModal';
import Logo from '../../components/ui/Logo';

import ConsolidatedRuleEditorModal from '../../components/ui/ConsolidatedRuleEditorModal';
import { useAuth } from '../../hooks/useAuth';
import { savePlanToFirestore, loadPlanFromFirestore } from '../../utils/firestoreUtils';
import AuthButtons from '../ui/AuthButtons';
import { TemplateSelectionModal } from '../../components/ui/TemplateSelectionModal';
import { ConfirmModal } from '../ui/ConfirmModal';
import { AlertModal } from '../ui/AlertModal';

const nodeTypes = {
  course: CourseNode,
  rule: RuleNode,
  addCourse: AddCourseNode,
  addSemester: AddSemesterNode,
  semesterTitle: SemesterTitleNode,
  editCourses: EditCoursesNode,
};

const COLUMN_WIDTH = 340;
const NODE_HEIGHT_COURSE = 90;
const VERTICAL_SPACING_RULE = 60;
const HORIZONTAL_SPACING_SEMESTER = 75;
const HORIZONTAL_SPACING_RULE_GROUPS = 45; // Smaller spacing between rule groups
const SEMESTER_TOP_MARGIN = 120;
const ADD_SEMESTER_NODE_ID = 'add-new-semester-button';
const MAX_SEMESTERS = 16;
const SEMESTER_TITLE_HEIGHT = 40;
const MANDATORY_COURSES_LIST_KEY = "רשימת קורסי חובה";
const CONSOLIDATED_RULES_NODE_ID = 'consolidated-rules-node';
const GLOBAL_RULES_NODE_ID_PREFIX = 'global-rule-';

type SaveStatus = 'idle' | 'saving' | 'saved';

interface DegreePlanViewProps {
  allTemplatesData: Record<string, DegreeTemplate> | null;
}

interface CourseDetailModalData {
  course: RawCourseData;
  coursesInPlanIds: Set<string>;
}

interface CourseDetailModalDataWithSemesters extends CourseDetailModalData {
  semesters?: Record<string, string[]>;
  targetCourseSemesterKey?: string;
}

const initialClassificationCheckedState: Record<string, boolean> = {};

const transformDataToNodes = (
  template: DegreeTemplate | undefined,
  allCourses: RawCourseData[],
  currentGrades: Record<string, string>,
  currentBinaryStates: Record<string, boolean>,
  handleBinaryChange: (courseId: string, isBinary: boolean) => void,
  onAddCourseToSemesterCallback: (semesterNumber: number) => void,
  onAddSemesterCallbackParam: () => void,
  onGradeChangeCallback: (courseId: string, grade: string) => void,
  onRemoveCourseCallback: (courseId: string) => void,
  classificationCheckedState: Record<string, boolean>,
  onClassificationToggleCallback: (courseId: string) => void,
  classificationCreditsState: Record<string, number>,
  onClassificationCreditsChangeCallback: (courseId: string, credits: number) => void,
  globalRules: DegreeRule[],
  allTemplatesData: Record<string, DegreeTemplate> | null,
  onEditRuleCallback?: (ruleId: string) => void,
  onDeleteRuleCallback?: (ruleId: string) => void,
  onSyncRulesCallback?: (ruleId: string) => void,
  onEditCoursesCallback?: () => void,
  onRemoveSemesterCallback?: (semesterKey: string) => void
): Node[] => {
  // --- BEGIN MORE BASIC DEBUG LOG ---
  if (import.meta.env.DEV) {
    console.debug(
      '[transformDataToNodes] Entry. template.id:',
      template?.id,
      'allTemplatesData is null?:',
      allTemplatesData === null,
      'allTemplatesData keys:',
      allTemplatesData ? Object.keys(allTemplatesData) : 'N/A',
      'template.id in allTemplatesData?:',
      template && allTemplatesData ? !!allTemplatesData[template.id] : 'N/A'
    );
  }
  // --- END MORE BASIC DEBUG LOG ---

  // --- BEGIN DEBUG LOG ---
  if (import.meta.env.DEV && template && allTemplatesData && allTemplatesData[template.id]) {
    const pristineInTransform = allTemplatesData[template.id];
    if (pristineInTransform && pristineInTransform.semesters) {
        const mandatoryFromPristineInTransform = Object.values(pristineInTransform.semesters).flat();
        console.debug(`[transformDataToNodes] Checking allTemplatesData[${template.id}].semesters directly. Count:`, mandatoryFromPristineInTransform.length, mandatoryFromPristineInTransform);
    }
  }
  // --- END DEBUG LOG ---
  if (import.meta.env.DEV) {
    console.log('[transformDataToNodes] Function called. import.meta.env.DEV:', import.meta.env.DEV);
  }

  if (!template || typeof template.semesters !== 'object' || template.semesters === null) {
    if (template && (typeof template.semesters !== 'object' || template.semesters === null)) {
      console.warn('Data Structure Warning (transformDataToNodes): template.semesters is not an object!', template.semesters);
    }
    return [];
  }

  const flowNodes: Node[] = [];
  let currentContentY = VERTICAL_SPACING_RULE;
  let maxEstimatedRuleHeight = 0;
  const ruleRowStartY = currentContentY;

  const allCourseIdsInTemplate = Object.values(template.semesters).flat();
  const coursesInCurrentPlan = (Array.isArray(allCourses) ? allCourseIdsInTemplate
    .map(courseId => allCourses.find(c => c._id === courseId))
    .filter(Boolean) : []) as RawCourseData[];

  // Sort semesters by their Hebrew letter to ensure consistent ordering
  const sortSemesterEntries = (entries: [string, string[]][]): [string, string[]][] => {
    const hebrewLetterOrder = [
      'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 
      'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת'
    ];
    
    return entries.sort((a, b) => {
      // Extract Hebrew letter from semester name (e.g., "סמסטר א'" -> "א")
      const getHebrewLetter = (semesterName: string): string => {
        const match = semesterName.match(/([א-ת])['׳]?$/);
        return match ? match[1] : '';
      };
      
      const letterA = getHebrewLetter(a[0]);
      const letterB = getHebrewLetter(b[0]);
      
      const indexA = hebrewLetterOrder.indexOf(letterA);
      const indexB = hebrewLetterOrder.indexOf(letterB);
      
      // If letters are not found in the order array, maintain original order
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      
      return indexA - indexB;
    });
  };
  
  const semesterEntries = sortSemesterEntries(Object.entries(template.semesters));
  if (import.meta.env.DEV) {
    console.debug('[DEBUG transformDataToNodes] Semester entries order:', semesterEntries.map(e => e[0]));
  }
  const numExistingSemesters = semesterEntries.length;
  const maxSemesterNum = numExistingSemesters > 0 ? Math.max(...semesterEntries.map((_, i) => i + 1)) : 0;
  const addSemesterNodeIsVisible = numExistingSemesters < MAX_SEMESTERS;
  const baseSemesterAreaStartX = addSemesterNodeIsVisible ? COLUMN_WIDTH + HORIZONTAL_SPACING_SEMESTER : 0;
  const firstSemesterXPos = baseSemesterAreaStartX + (maxSemesterNum > 0 ? (maxSemesterNum - 1) : 0) * (COLUMN_WIDTH + HORIZONTAL_SPACING_SEMESTER);

  const ruleNodeBaseXAdjustment = 98;
  
  // Hard-coded rule positioning constants with width information
  const RULE_POSITIONS = {
    CONSOLIDATED: { order: 0, width: 400 },        // התקדמות אקדמית כללית - leftmost position, wider
    SELECTIVE_LISTS: { order: 1, width: 340 },     // קורסים מרשימות בחירה
    COMBINED_SELECTIVE: { order: 2, width: 400 },  // דרישות מרוכבות מרשימות בחירה - wider
    CLASSIFICATION: { order: 3, width: 340 },      // פטורים - rightmost position
  } as const;

  // Check what rule types exist first
  let globalHasClassificationRule = false;
  let templateHasConsolidatedGroup = false;
  
  if (Array.isArray(globalRules)) {
    if (globalRules.some(rule => rule.type === 'classification_courses')) {
      globalHasClassificationRule = true;
    }
  }

  if (template.rules && Array.isArray(template.rules)) {
    const consolidatedRuleTypes = new Set([
      'total_credits', 'credits_from_list', 'min_grade', 'minCredits',
      'minCoursesFromList', 'minCreditsFromMandatory', 'minCreditsFromAnySelectiveList', 'minCreditsFromIdPattern'
    ]);
    templateHasConsolidatedGroup = template.rules.some(rule => 
      rule && consolidatedRuleTypes.has(rule.type)
    );
  }

  if (import.meta.env.DEV) {
    console.debug('[Rule Detection] globalHasClassificationRule:', globalHasClassificationRule);
    console.debug('[Rule Detection] templateHasConsolidatedGroup:', templateHasConsolidatedGroup);
    console.debug('[Rule Detection] template.rules:', template.rules?.map(r => ({ id: r.id, type: r.type, description: r.description })));
    console.debug('[Rule Detection] globalRules:', globalRules?.map(r => ({ id: r.id, type: r.type })));
  }

  // Helper function to determine what rules exist and their actual order and widths
  const getActualRuleLayout = () => {
    const ruleLayout: Array<{ order: number; width: number; key: string }> = [];
    
    // Add consolidated rule if it exists
    if (templateHasConsolidatedGroup) {
      ruleLayout.push({ order: 0, width: 400, key: 'consolidated' });
    }
    
    // Check for selective lists rules
    const hasSelectiveListsRule = template.rules?.some(rule => 
      rule.description?.includes('קורסים מרשימות בחירה') || rule.type === 'minCoursesFromMultipleLists'
    );
    if (hasSelectiveListsRule) {
      ruleLayout.push({ order: 1, width: 340, key: 'selective' });
    }
    
    // Check for combined selective rules
    const hasCombinedSelectiveRule = template.rules?.some(rule => 
      rule.description?.includes('דרישות מרוכבות') || rule.type === 'minCreditsFromSelectedLists'
    );
    if (hasCombinedSelectiveRule) {
      ruleLayout.push({ order: 2, width: 400, key: 'combined' });
    }
    
    // Add classification rule if it exists
    if (globalHasClassificationRule) {
      ruleLayout.push({ order: 3, width: 340, key: 'classification' });
    }
    
    const sortedLayout = ruleLayout.sort((a, b) => a.order - b.order);
    
    if (import.meta.env.DEV) {
      console.debug(`[getActualRuleLayout] Detected rules:`, sortedLayout);
    }
    
    return sortedLayout;
  };

  // Helper function to calculate where each rule's LEFT edge should be positioned
  const calculateRulePosition = (ruleOrder: number): number => {
    const actualRules = getActualRuleLayout();
    
    if (import.meta.env.DEV) {
      console.debug(`[calculateRulePosition] For order ${ruleOrder}, actualRules:`, actualRules);
    }
    
    // Calculate position by working backwards from the right
    const currentRule = actualRules.find(r => r.order === ruleOrder);
    if (!currentRule) {
      if (import.meta.env.DEV) {
        console.debug(`[calculateRulePosition] Rule not found for order ${ruleOrder}`);
      }
      return 0;
    }
    
    // Start from the base position and work leftward
    let rightEdgePosition = 0; // This will be relative to the base position
    
    // Calculate where this rule's right edge should be
    for (const ruleInfo of actualRules) {
      if (ruleInfo.order < ruleOrder) {
        rightEdgePosition -= ruleInfo.width + HORIZONTAL_SPACING_RULE_GROUPS;
        if (import.meta.env.DEV) {
          console.debug(`[calculateRulePosition] Rule ${ruleInfo.key} pushes right edge left by ${ruleInfo.width + HORIZONTAL_SPACING_RULE_GROUPS}, now at: ${rightEdgePosition}`);
        }
      }
    }
    
    // The left edge is the right edge minus this rule's width
    const leftEdgeOffset = rightEdgePosition - currentRule.width;
    
    if (import.meta.env.DEV) {
      console.debug(`[calculateRulePosition] Rule ${currentRule.key}: right edge at ${rightEdgePosition}, left edge at ${leftEdgeOffset} (width: ${currentRule.width})`);
    }
    
    // Return the absolute offset from the base position
    return Math.abs(leftEdgeOffset);
  };

  // Debug summary of expected rule bounds
  if (import.meta.env.DEV) {
    const allRuleLayout = getActualRuleLayout();
    console.debug('\n=== EXPECTED RULE BOUNDS SUMMARY ===');
    allRuleLayout.forEach(rule => {
      const offset = calculateRulePosition(rule.order);
      const baseX = firstSemesterXPos - ruleNodeBaseXAdjustment;
      const finalX = baseX - offset;
      console.debug(`${rule.key.toUpperCase()} (order ${rule.order}): x=${finalX}, bounds=[${finalX} to ${finalX + rule.width}], width=${rule.width}px`);
    });
    console.debug('=== END SUMMARY ===\n');
  }

  // Add edit courses button node above rules, aligned to the right of "קורסים מרשימות בחירה" rule
  if (onEditCoursesCallback) {
    // Hard-coded position for selective lists rule
    const targetRuleXOffset = calculateRulePosition(RULE_POSITIONS.SELECTIVE_LISTS.order);
    const targetRuleX = (firstSemesterXPos - ruleNodeBaseXAdjustment) - targetRuleXOffset;
    const targetRuleRightEdge = targetRuleX + RULE_POSITIONS.SELECTIVE_LISTS.width;
    const editButtonWidth = 200; // min-w-[200px] from EditCoursesNode
    const editButtonX = targetRuleRightEdge - editButtonWidth; // Align right edges
    
    if (import.meta.env.DEV) {
      console.log(`[transformDataToNodes] Edit button aligned with selective lists rule at position: ${RULE_POSITIONS.SELECTIVE_LISTS.order}`);
    }
    
    flowNodes.push({
      id: 'edit-courses-button',
      type: 'editCourses',
      position: { x: editButtonX, y: ruleRowStartY - 80 },
      data: { onEditCourses: onEditCoursesCallback },
      draggable: false,
      selectable: false,
    });
  }

  if (globalHasClassificationRule) {
    const classificationRule = globalRules.find(rule => rule.type === 'classification_courses');
    if (classificationRule && classificationRule.courses) {
      const nodeId = `${GLOBAL_RULES_NODE_ID_PREFIX}${classificationRule.id}`;
      const xOffsetFactor = calculateRulePosition(RULE_POSITIONS.CLASSIFICATION.order);
      const nodePosition = { x: (firstSemesterXPos - ruleNodeBaseXAdjustment) - xOffsetFactor, y: ruleRowStartY };
      
      if (import.meta.env.DEV) {
        console.debug('[Classification Rule] xOffsetFactor:', xOffsetFactor);
        console.debug('[Classification Rule] firstSemesterXPos:', firstSemesterXPos);
        console.debug('[Classification Rule] ruleNodeBaseXAdjustment:', ruleNodeBaseXAdjustment);
        console.debug('[Classification Rule] Final position:', nodePosition);
        console.debug('[Classification Rule] Expected bounds: left=' + nodePosition.x + ' right=' + (nodePosition.x + 340));
      }

      const detailsForNode = classificationRule.courses.map(course => ({
        id: course.id,
        name: course.name,
        checked: classificationCheckedState[course.id] || false,
        credits: classificationCreditsState[course.id],
        creditInput: course.creditInput,
      }));

      const estimatedHeightClassification = 70 + (detailsForNode.length * 35);
      maxEstimatedRuleHeight = Math.max(maxEstimatedRuleHeight, estimatedHeightClassification);

      const classificationNodeData: RuleNodeData = {
        id: classificationRule.id,
        description: "פטורים",
        currentProgress: "בחר פטורים שהושלמו",
        isSatisfied: false,
        classificationCourseDetails: detailsForNode,
        onClassificationToggle: onClassificationToggleCallback,
        onClassificationCreditsChange: onClassificationCreditsChangeCallback,
      };
      flowNodes.push({
        id: nodeId,
        type: 'rule',
        position: nodePosition,
        data: classificationNodeData,
      });
    }
  }

  const otherRules = template.rules!.filter(rule => {
    const consolidatedRuleTypes = new Set([
      'total_credits', 'credits_from_list', 'min_grade', 'minCredits',
      'minCoursesFromList', 'minCreditsFromMandatory', 'minCreditsFromAnySelectiveList', 'minCreditsFromIdPattern'
    ]);
    return rule.type !== 'classification_courses' && !consolidatedRuleTypes.has(rule.type) && rule.id && rule.description;
  });

  let effectiveMandatoryCourseIds: string[] | undefined = undefined;
  if (template) {
    effectiveMandatoryCourseIds = template.definedMandatoryCourseIds;
    if (import.meta.env.DEV) {
      console.debug('[transformDataToNodes] Using template.definedMandatoryCourseIds for effectiveMandatoryCourseIds:', effectiveMandatoryCourseIds);
    }
    if (effectiveMandatoryCourseIds === undefined) {
        effectiveMandatoryCourseIds = [];
        if (import.meta.env.DEV) {
            console.warn('[transformDataToNodes] effectiveMandatoryCourseIds was undefined, defaulting to empty array.');
        }
    }
  } else {
    if (import.meta.env.DEV) {
      console.warn('[transformDataToNodes] Template is undefined. effectiveMandatoryCourseIds will be empty array.');
    }
    effectiveMandatoryCourseIds = [];
  }

  // Helper function to determine rule position based on type and description
  const getRulePosition = (rule: DegreeRule): number => {
    // Check by description patterns first (more specific)
    if (rule.description?.includes('קורסים מרשימות בחירה') || rule.type === 'minCoursesFromMultipleLists') {
      return calculateRulePosition(RULE_POSITIONS.SELECTIVE_LISTS.order);
    }
    if (rule.description?.includes('דרישות מרוכבות') || rule.type === 'minCreditsFromSelectedLists') {
      return calculateRulePosition(RULE_POSITIONS.COMBINED_SELECTIVE.order);
    }
    
    // Default position for unrecognized rules - use a consistent order beyond classification
    const defaultOrder = 4; // Place after classification (order 3)
    return calculateRulePosition(defaultOrder);
  };

  otherRules.forEach((rule) => {
    const ruleStatus = evaluateRule(
      rule, coursesInCurrentPlan, currentGrades, 
      currentBinaryStates,
      template["courses-lists"], 
      effectiveMandatoryCourseIds,
      classificationCheckedState, 
      classificationCreditsState
    );
    const nodeId = `rule-${rule.id}`;
    
    let estimatedHeight = 120; 
    if (rule.type === 'minCoursesFromMultipleLists' && rule.lists) {
      estimatedHeight = 70 + (rule.lists.length * 50); 
    } else if (rule.type === 'minCreditsFromSelectedLists' && rule.combinedRules) {
      estimatedHeight = 70 + (rule.combinedRules.length * 35); // Slightly smaller since it's just a list display
    }
    maxEstimatedRuleHeight = Math.max(maxEstimatedRuleHeight, estimatedHeight);

    const xOffsetFactor = getRulePosition(rule);
    
    if (import.meta.env.DEV) {
      const finalX = (firstSemesterXPos - ruleNodeBaseXAdjustment) - xOffsetFactor;
      const nodeWidth = rule.type === 'minCreditsFromSelectedLists' ? 400 : 340;
      console.debug(`[Other Rule - ${rule.type}] Rule:`, { id: rule.id, type: rule.type, description: rule.description });
      console.debug(`[Other Rule - ${rule.type}] xOffsetFactor:`, xOffsetFactor);
      console.debug(`[Other Rule - ${rule.type}] Final position:`, { x: finalX, y: ruleRowStartY });
      console.debug(`[Other Rule - ${rule.type}] Expected bounds: left=${finalX} right=${finalX + nodeWidth} width=${nodeWidth}`);
    }
    
    const ruleNodeData: RuleNodeData = {
      id: rule.id,
      description: rule.description || "כלל ללא תיאור",
      type: rule.type,
      currentProgress: ruleStatus.currentProgressString,
      targetProgress: ruleStatus.requiredValue,
      isSatisfied: ruleStatus.isSatisfied,
      listName: rule.listName || rule.course_list_name,
      minGrade: rule.min_grade_value,
      minCourses: (rule.type === 'minCoursesFromList' || rule.type === 'minCoursesFromMultipleLists') ? rule.min : undefined,
      minCredits: (rule.type === 'credits_from_list' || rule.type === 'minCredits' || rule.type === 'minCreditsFromMandatory' || rule.type === 'minCreditsFromAnySelectiveList' || rule.type === 'total_credits' || rule.type === 'minCreditsFromSelectedLists') ? (rule.min ?? rule.required_credits) : undefined,
      listProgressDetails: ruleStatus.listProgressDetails ?? undefined,
      onEditRule: () => onEditRuleCallback?.(rule.id),
      onDeleteRule: () => onDeleteRuleCallback?.(rule.id),
      onSyncRules: () => onSyncRulesCallback?.(rule.id),
    };

    flowNodes.push({
      id: nodeId,
      type: 'rule',
      position: { 
        x: (firstSemesterXPos - ruleNodeBaseXAdjustment) - xOffsetFactor, 
        y: ruleRowStartY 
      },
      data: ruleNodeData,
    });
  });

  if (templateHasConsolidatedGroup) {
    const rulesToConsolidate = template.rules!.filter(rule => {
      const consolidatedRuleTypes = new Set([
        'total_credits', 'credits_from_list', 'min_grade', 'minCredits',
        'minCoursesFromList', 'minCreditsFromMandatory', 'minCreditsFromAnySelectiveList', 'minCreditsFromIdPattern'
      ]);
      return rule.type !== 'classification_courses' && consolidatedRuleTypes.has(rule.type);
    });

    if (rulesToConsolidate.length > 0) {
      const consolidatedNodeId = CONSOLIDATED_RULES_NODE_ID;
      const consolidatedRuleDetails: RuleNodeData['consolidatedRules'] = [];
      let allConsolidatedSatisfied = true;

      rulesToConsolidate.forEach(rule => {
        const ruleStatus = evaluateRule(
          rule, coursesInCurrentPlan, currentGrades, 
          currentBinaryStates,
          template["courses-lists"], 
          effectiveMandatoryCourseIds,
          classificationCheckedState, 
          classificationCreditsState
        );
        consolidatedRuleDetails.push({
          id: rule.id,
          description: rule.description || `חוק ${rule.type}`,
          currentProgress: ruleStatus.currentProgressString,
          isSatisfied: ruleStatus.isSatisfied,
          currentValuePlanned: ruleStatus.currentValuePlanned ?? undefined,
          currentValueDone: ruleStatus.currentValueDone ?? undefined,
          requiredValue: ruleStatus.requiredValue ?? undefined,
        });
        if (!ruleStatus.isSatisfied) {
          allConsolidatedSatisfied = false;
        }
      });
      
      const estimatedHeightConsolidated = 90 + consolidatedRuleDetails.length * 60; // Increased from 60 to 90 to account for legend on separate line
      maxEstimatedRuleHeight = Math.max(maxEstimatedRuleHeight, estimatedHeightConsolidated);

      const xOffsetFactor = calculateRulePosition(RULE_POSITIONS.CONSOLIDATED.order);
      
      if (import.meta.env.DEV) {
        const finalX = (firstSemesterXPos - ruleNodeBaseXAdjustment) - xOffsetFactor;
        console.debug('[Consolidated Rule] xOffsetFactor:', xOffsetFactor);
        console.debug('[Consolidated Rule] firstSemesterXPos:', firstSemesterXPos);
        console.debug('[Consolidated Rule] ruleNodeBaseXAdjustment:', ruleNodeBaseXAdjustment);
        console.debug('[Consolidated Rule] Final position:', { x: finalX, y: ruleRowStartY });
        console.debug('[Consolidated Rule] Expected bounds: left=' + finalX + ' right=' + (finalX + 400));
      }
      
      const consolidatedNodeData: RuleNodeData = {
        id: consolidatedNodeId,
        description: "התקדמות אקדמית כללית",
        type: "consolidated",
        isSatisfied: allConsolidatedSatisfied,
        currentProgress: `${consolidatedRuleDetails.filter(r => r.isSatisfied).length} / ${consolidatedRuleDetails.length} תתי-כללים הושלמו`,
        targetProgress: consolidatedRuleDetails.length,
        isConsolidated: true,
        consolidatedRules: consolidatedRuleDetails,
        onEditRule: onEditRuleCallback,
        onDeleteRule: onDeleteRuleCallback,
        onSyncRules: onSyncRulesCallback,
      };
      flowNodes.push({
        id: consolidatedNodeId,
        type: 'rule',
        position: { x: (firstSemesterXPos - ruleNodeBaseXAdjustment) - xOffsetFactor, y: ruleRowStartY },
        data: consolidatedNodeData,
      });
    }
  }

  currentContentY = ruleRowStartY + maxEstimatedRuleHeight + SEMESTER_TOP_MARGIN;

  // Calculate tabIndex for keyboard navigation through grade inputs
  let globalTabIndex = 1;

  semesterEntries.forEach(([semesterName, courseIds], semesterIndex) => {
    const semesterNumberForLayout = semesterIndex + 1;
    const semesterXPos = baseSemesterAreaStartX + (maxSemesterNum - semesterNumberForLayout) * (COLUMN_WIDTH + HORIZONTAL_SPACING_SEMESTER);

    flowNodes.push({
      id: `title-sem-${semesterNumberForLayout}`,
      type: 'semesterTitle',
      position: { x: semesterXPos, y: currentContentY },
      data: { 
        title: semesterName,
        semesterKey: semesterName,
        isEmpty: courseIds.length === 0,
        onRemoveSemester: onRemoveSemesterCallback
      },
      draggable: false,
      selectable: false,
    });

    let currentYInSemester = currentContentY + SEMESTER_TITLE_HEIGHT;

    courseIds.forEach((courseId) => {
      if (typeof courseId !== 'string' || !courseId) {
        console.warn(`[transformDataToNodes] Skipping invalid courseId: ${courseId} in semesterIndex ${semesterIndex}`);
        return;
      }

      const courseData = allCourses.find(c => c._id === courseId);
      if (!courseData) {
        console.warn(`[transformDataToNodes] Course data not found for courseId: ${courseId}`);
        return;
      }

      if (import.meta.env.DEV) {
        console.debug(`[transformDataToNodes] Checking prerequisites for course: ${courseData._id} (${courseData.name}) in semester ${semesterNumberForLayout}. Inputs:`, {
          courseData,
          semesterNumberForLayout,
          semesters: template.semesters,
          // allCourses, // Avoid logging allCourses repeatedly, it's large
          classificationCheckedState
        });
      }

      const prereqStatusResult: PrereqStatus = checkPrerequisites(
        courseData, 
        semesterNumberForLayout, 
        template.semesters, 
        allCourses,
        classificationCheckedState
      );

      if (import.meta.env.DEV) {
        console.debug(`[transformDataToNodes] Prereq status for ${courseData._id}: ${prereqStatusResult}`);
      }

      const nodeId = courseId;
      const nodePosition = { x: semesterXPos, y: currentYInSemester };
      
      const courseNodeData: CourseNodeData = {
        label: courseData.name || courseId,
        courseId: courseData._id,
        credits: courseData.credits !== undefined ? courseData.credits : 'N/A',
        grade: currentGrades[courseId] || '',
        onGradeChange: onGradeChangeCallback,
        onRemoveCourse: onRemoveCourseCallback,
        prerequisitesMet: prereqStatusResult,
        isBinary: currentBinaryStates[courseId] || false,
        onBinaryChange: handleBinaryChange,
        tabIndex: globalTabIndex++,
      };

      flowNodes.push({
        id: nodeId,
        type: 'course',
        position: nodePosition,
        data: courseNodeData,
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

  // Set content Y position after rules
  currentContentY = ruleRowStartY + maxEstimatedRuleHeight + SEMESTER_TOP_MARGIN;

  return flowNodes;
};

const transformDataToEdges = (
  template: DegreeTemplate | undefined,
  allCourses: RawCourseData[]
): Edge[] => {
  if (import.meta.env.DEV) {
    console.log('[transformDataToEdges] Starting. Template defined:', !!template, 'AllCourses count:', Array.isArray(allCourses) ? allCourses.length : 'N/A');
  }
  if (!template || typeof template.semesters !== 'object' || template.semesters === null || !Array.isArray(allCourses)) {
    if (template && (typeof template.semesters !== 'object' || template.semesters === null)) {
      console.warn('Data Structure Warning (transformDataToEdges): template.semesters is not an object!', template.semesters);
    }
    if (!Array.isArray(allCourses)) {
      console.warn('Data Input Warning (transformDataToEdges): allCourses is not an array!', allCourses);
    }
    return [];
  }

  const edges: Edge[] = [];
  const edgeIdSet = new Set<string>();
  const allCourseIdsInPlan = Object.values(template.semesters).flat();
  if (import.meta.env.DEV) {
    console.log('[transformDataToEdges] All course IDs in current plan:', allCourseIdsInPlan);
  }

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
  if (import.meta.env.DEV) {
    console.log('[transformDataToEdges] Finished. Total edges generated:', edges.length);
  }
  return edges;
};

function DegreePlanView({ allTemplatesData }: DegreePlanViewProps) {
  const { theme } = useTheme();
  const { currentUser, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [binaryStates, setBinaryStates] = useState<Record<string, boolean>>({});
  const [allCoursesData, setAllCoursesData] = useState<RawCourseData[]>([]);
  const [degreeTemplate, setDegreeTemplate] = useState<DegreeTemplate | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [semesterToAddCourseTo, setSemesterToAddCourseTo] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [courseDetailModalData, setCourseDetailModalData] = useState<CourseDetailModalDataWithSemesters | null>(null);
  const [editingRule, setEditingRule] = useState<DegreeRule | null>(null);
  const [isRuleEditorOpen, setIsRuleEditorOpen] = useState(false);
  const [isCourseListEditorOpen, setIsCourseListEditorOpen] = useState(false);
  const [isConsolidatedRuleEditorOpen, setIsConsolidatedRuleEditorOpen] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [rulesForConsolidatedEditing, setRulesForConsolidatedEditing] = useState<DegreeRule[]>([]);
  const [currentGlobalRules, setCurrentGlobalRules] = useState<DegreeRule[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [hasUserMadeChanges, setHasUserMadeChanges] = useState<boolean>(false);
  const autosaveTimeoutRef = useRef<number | null>(null);
  const classificationCreditsDebounceTimeoutRef = useRef<number | null>(null);

  const [classificationChecked, setClassificationChecked] = useState<Record<string, boolean>>(initialClassificationCheckedState);
  const [classificationCredits, setClassificationCredits] = useState<Record<string, number>>({});

  const [showTemplateSelection, setShowTemplateSelection] = useState(false);
  const [isSwitchingTemplate, setIsSwitchingTemplate] = useState(false);
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
  const [showSignInConfirm, setShowSignInConfirm] = useState(false);

  const [showDeleteSemesterConfirm, setShowDeleteSemesterConfirm] = useState(false);
  const [semesterToDelete, setSemesterToDelete] = useState<string | null>(null);

  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title?: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    buttonText?: string;
  }>({ message: '' });

  const [showDeleteRuleConfirm, setShowDeleteRuleConfirm] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);

  const [showSyncRulesConfirm, setShowSyncRulesConfirm] = useState(false);
  const [showSyncTemplateSelection, setShowSyncTemplateSelection] = useState(false);
  const [selectedSyncTemplate, setSelectedSyncTemplate] = useState<DegreeTemplate | null>(null);

  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [importData, setImportData] = useState<{
    degreeTemplate?: DegreeTemplate;
    grades?: Record<string, string>;
    classificationChecked?: Record<string, boolean>;
    classificationCredits?: Record<string, number>;
    binaryStates?: Record<string, boolean>;
    exportDate?: string;
  } | null>(null);

  const handleClassificationToggle = useCallback((courseId: string) => {
    setClassificationChecked(prev => {
      const newState = { ...prev, [courseId]: !prev[courseId] };
      if (courseId === 'miluim_exemption' && !newState[courseId]) {
        setClassificationCredits(creditPrev => ({ ...creditPrev, [courseId]: 0 }));
      }
      return newState;
    });
  }, []);

  const handleClassificationCreditsChange = useCallback((courseId: string, credits: number) => {
    if (classificationCreditsDebounceTimeoutRef.current) {
      clearTimeout(classificationCreditsDebounceTimeoutRef.current);
    }

    classificationCreditsDebounceTimeoutRef.current = window.setTimeout(() => {
      setClassificationCredits(prev => ({ ...prev, [courseId]: credits }));
    }, 100);
  }, []);

  const coursesInPlanFlatIds = useMemo(() => {
    if (!degreeTemplate || !degreeTemplate.semesters) return new Set<string>();
    return new Set(Object.values(degreeTemplate.semesters).flat().filter(id => typeof id === 'string')) as Set<string>;
  }, [degreeTemplate]);

  const handleAddCourseToSemesterCallback = useCallback((semesterNumber: number) => {
    if (import.meta.env.DEV) {
      console.log(`DegreePlanView: Request to add course to semester: ${semesterNumber}`);
    }
    setSemesterToAddCourseTo(semesterNumber);
    setIsModalOpen(true);
  }, []);

  const handleAddSemesterCallback = useCallback(() => {
    if (import.meta.env.DEV) {
      console.log('DegreePlanView: Add new semester');
    }
    setDegreeTemplate(prevTemplate => {
      if (!prevTemplate || typeof prevTemplate.semesters !== 'object') return prevTemplate;
      const semesterKeys = Object.keys(prevTemplate.semesters);
      if (semesterKeys.length >= MAX_SEMESTERS) return prevTemplate;

      const nextSemesterNum = semesterKeys.length + 1;
      const nextSemesterName = `סמסטר ${numberToHebrewLetter(nextSemesterNum)}`;

      return {
        ...prevTemplate,
        semesters: {
          ...prevTemplate.semesters,
          [nextSemesterName]: []
        }
      };
    });
  }, []);

  const handleRemoveSemesterCallback = useCallback((semesterKey: string) => {
    setSemesterToDelete(semesterKey);
    setShowDeleteSemesterConfirm(true);
  }, []);

  const handleSelectCourseFromModal = useCallback((selectedCourse: RawCourseData) => {
    if (semesterToAddCourseTo === null || !degreeTemplate) return;

    setDegreeTemplate(prevTemplate => {
      if (!prevTemplate || typeof prevTemplate.semesters !== 'object') return prevTemplate;

      const semesterEntries = Object.entries(prevTemplate.semesters);
      if (semesterToAddCourseTo <= 0 || semesterToAddCourseTo > semesterEntries.length) {
        console.warn(`Invalid semesterToAddCourseTo: ${semesterToAddCourseTo}, current semester count: ${semesterEntries.length}`);
        return prevTemplate;
      }

      const targetSemesterKey = semesterEntries[semesterToAddCourseTo - 1][0];

      const updatedSemesters = { ...prevTemplate.semesters };
      const currentCoursesInTargetSemester = updatedSemesters[targetSemesterKey] || [];

      if (!currentCoursesInTargetSemester.includes(selectedCourse._id)) {
        updatedSemesters[targetSemesterKey] = [...currentCoursesInTargetSemester, selectedCourse._id];
      } else {
        if (import.meta.env.DEV) {
          console.log(`Course ${selectedCourse._id} already in semester ${targetSemesterKey}`);
        }
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

  const handleGradeChange = useCallback((courseId: string, grade: string) => {
    setGrades((prevGrades: Record<string, string>) => ({ ...prevGrades, [courseId]: grade }));
    if (grade !== '') {
      setBinaryStates((prevStates: Record<string, boolean>) => { 
        if (prevStates[courseId]) { 
          const newStates = { ...prevStates };
          newStates[courseId] = false; 
          return newStates;
        }
        return prevStates; 
      });
    }
  }, [setGrades, setBinaryStates]);

  const handleBinaryChange = useCallback((courseId: string, isBinary: boolean) => {
    setBinaryStates((prevStates: Record<string, boolean>) => ({ ...prevStates, [courseId]: isBinary }));
    if (isBinary) {
      setGrades((prevGrades: Record<string, string>) => ({
        ...prevGrades,
        [courseId]: '', 
      }));
    }
  }, [setBinaryStates, setGrades]);

  const handleRemoveCourseCallback = useCallback((courseIdToRemove: string) => {
    if (import.meta.env.DEV) {
      console.log(`DegreePlanView: Remove course: ${courseIdToRemove}`);
    }
    setDegreeTemplate(prevTemplate => {
      if (!prevTemplate || typeof prevTemplate.semesters !== 'object') return undefined;

      const updatedSemesters: Record<string, string[]> = {};
      for (const [semesterKey, courseIds] of Object.entries(prevTemplate.semesters)) {
        updatedSemesters[semesterKey] = (courseIds as string[]).filter((id: string) => id !== courseIdToRemove);
      }
      return { ...prevTemplate, semesters: updatedSemesters };
    });
    setGrades(prevGrades => {
      const newGrades = { ...prevGrades };
      delete newGrades[courseIdToRemove];
      return newGrades;
    });
    setSelectedNodes(prevSelected => prevSelected.filter(node => node.id !== courseIdToRemove));
  }, [setDegreeTemplate, setGrades, setSelectedNodes]);

  const handleNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (import.meta.env.DEV) {
      console.log('[DegreePlanView] handleNodeDoubleClick called with node:', node);
    }
    
    // Check if the double-click target is an input element or its descendant
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.closest('input')) {
      if (import.meta.env.DEV) {
        console.log('[DegreePlanView] handleNodeDoubleClick: Ignoring double-click on input element');
      }
      return; // Don't open modal when double-clicking on input elements
    }
    
    if (node.type === 'course' && node.data) {
      const courseData = node.data as CourseNodeData;
      const courseId = courseData.courseId;
      const foundCourse = allCoursesData.find(c => c._id === courseId);
      if (foundCourse) {
        let targetSemesterKey: string | undefined = undefined;
        if (degreeTemplate && degreeTemplate.semesters) {
          for (const [key, courseIdsInSem] of Object.entries(degreeTemplate.semesters)) {
            if (courseIdsInSem.includes(courseId)) {
              targetSemesterKey = key;
              break;
            }
          }
        }
        setCourseDetailModalData({
          course: foundCourse,
          coursesInPlanIds: coursesInPlanFlatIds,
          semesters: degreeTemplate?.semesters,
          targetCourseSemesterKey: targetSemesterKey,
        });
      }
    }
    if (node.type === 'rule' && node.data) {
      const ruleData = node.data as RuleNodeData;
      const ruleId = ruleData.id;
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
  }, [allCoursesData, coursesInPlanFlatIds, degreeTemplate, setCourseDetailModalData, setEditingRule, setIsRuleEditorOpen, setRulesForConsolidatedEditing, setIsConsolidatedRuleEditorOpen]);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (import.meta.env.DEV) {
      console.log('[DegreePlanView] handleNodeClick called with node:', node);
    }
  }, []);

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
    setRuleToDelete(ruleId);
    setShowDeleteRuleConfirm(true);
  }, []);

  const handleSyncRules = useCallback(() => {
    // Show template selection modal first
    setShowSyncTemplateSelection(true);
  }, []);

  const handleConfirmSyncRules = useCallback(() => {
    if (!selectedSyncTemplate) {
      setAlertConfig({ message: "לא נבחרה תכנית לסנכרון", type: 'error' });
      setShowAlert(true);
      return;
    }

    try {
      // Preserve current semester courses
      const currentSemesters = degreeTemplate?.semesters || {};
      
      // Sync rules and course lists from selected template, but keep current semesters
      const syncedTemplate: DegreeTemplate = {
        ...selectedSyncTemplate,
        semesters: currentSemesters // Preserve user's semester course selections
      };

      // Update the degree template with synced rules and lists but preserved semesters
      setDegreeTemplate(syncedTemplate);
      
      // Mark that user has made changes to enable autosave
      setHasUserMadeChanges(true);
      
      setShowSyncRulesConfirm(false);
      setSelectedSyncTemplate(null);
      setAlertConfig({ message: `כללים ורשימות סונכרנו בהצלחה מתכנית "${selectedSyncTemplate.name}"!`, type: 'success' });
      setShowAlert(true);
    } catch (error) {
      console.error('Error during sync:', error);
      setAlertConfig({ message: "שגיאה בסנכרון הכללים", type: 'error' });
      setShowAlert(true);
    }
  }, [selectedSyncTemplate, degreeTemplate, setDegreeTemplate, setHasUserMadeChanges]);

  const handleToggleCourseListEditorModal = useCallback(() => {
    setIsCourseListEditorOpen(prev => !prev);
  }, []);

  const handleSaveCourseLists = useCallback((allListsFromModal: Record<string, string[]>) => {
    if (import.meta.env.DEV) {
      console.debug('[DegreePlanView handleSaveCourseLists] Called with lists:', Object.keys(allListsFromModal));
      console.debug('[DegreePlanView handleSaveCourseLists] Current state - isInitialLoad:', isInitialLoad, 'isLoading:', isLoading);
      console.debug('[DegreePlanView handleSaveCourseLists] Received from modal:', JSON.parse(JSON.stringify(allListsFromModal)));
      console.debug('[DegreePlanView handleSaveCourseLists] MANDATORY_COURSES_LIST_KEY is:', MANDATORY_COURSES_LIST_KEY);
      console.debug('[DegreePlanView handleSaveCourseLists] Mandatory list from modal:', allListsFromModal[MANDATORY_COURSES_LIST_KEY]);
    }

    // Mark that user has made changes to allow autosave even during initial load
    setHasUserMadeChanges(true);
    setDegreeTemplate(prevTemplate => {
      if (!prevTemplate) {
        if (import.meta.env.DEV) console.warn('[DegreePlanView handleSaveCourseLists] prevTemplate is undefined');
        return undefined;
      }
      if (import.meta.env.DEV) {
        console.debug('[DegreePlanView handleSaveCourseLists] prevTemplate.definedMandatoryCourseIds before update:', prevTemplate.definedMandatoryCourseIds);
      }

      const newDefinedMandatoryCourseIds = allListsFromModal[MANDATORY_COURSES_LIST_KEY] !== undefined
        ? allListsFromModal[MANDATORY_COURSES_LIST_KEY]
        : prevTemplate.definedMandatoryCourseIds;
      
      if (import.meta.env.DEV) {
        console.debug('[DegreePlanView handleSaveCourseLists] newDefinedMandatoryCourseIds chosen:', newDefinedMandatoryCourseIds);
      }

      const newCustomCoursesLists: Record<string, string[]> = {};
      for (const listName in allListsFromModal) {
        if (listName !== MANDATORY_COURSES_LIST_KEY) {
          if (allListsFromModal[listName] && allListsFromModal[listName].length > 0) {
            newCustomCoursesLists[listName] = allListsFromModal[listName];
          }
        }
      }

      return {
        ...prevTemplate,
        definedMandatoryCourseIds: newDefinedMandatoryCourseIds,
        "courses-lists": newCustomCoursesLists,
      };
    });
    setIsCourseListEditorOpen(false);
  }, [setDegreeTemplate, setIsCourseListEditorOpen, isInitialLoad, isLoading, setHasUserMadeChanges]);

  const handleEditRule = useCallback((ruleId: string) => {
    if (!degreeTemplate || !degreeTemplate.rules) return;

    if (ruleId === CONSOLIDATED_RULES_NODE_ID) {
      const consolidatedRuleTypes = new Set([
        'total_credits', 'credits_from_list', 'min_grade', 'minCredits',
        'minCoursesFromList', 'minCreditsFromMandatory', 'minCreditsFromAnySelectiveList', 'minCreditsFromIdPattern'
      ]);
      const rulesToEdit = degreeTemplate.rules.filter(rule => consolidatedRuleTypes.has(rule.type));
      if (rulesToEdit.length > 0) {
        setRulesForConsolidatedEditing(rulesToEdit);
        setIsConsolidatedRuleEditorOpen(true);
      } else {
        if (import.meta.env.DEV) {
          console.warn("Consolidated rule node edit triggered, but no matching rules found in template.");
        }
      }
    } else {
      const ruleToEdit = degreeTemplate.rules.find(r => r.id === ruleId);
      if (ruleToEdit) {
        setEditingRule(ruleToEdit);
        setIsRuleEditorOpen(true);
      } else {
        if (import.meta.env.DEV) {
          console.warn(`Rule with ID ${ruleId} not found for editing.`);
        }
      }
    }
  }, [degreeTemplate]);

  const handleSaveConsolidatedRules = useCallback((updatedRules: DegreeRule[]) => {
    if (!degreeTemplate) return;

    if (import.meta.env.DEV) {
      console.log('[handleSaveConsolidatedRules] Called with rules:', updatedRules.map(r => ({ id: r.id, type: r.type, description: r.description })));
      console.log('[handleSaveConsolidatedRules] Current state - isInitialLoad:', isInitialLoad, 'isLoading:', isLoading);
      console.log('[handleSaveConsolidatedRules] Current user:', !!currentUser, 'UID:', currentUser?.uid);
    }

    // Mark that user has made changes to allow autosave even during initial load
    setHasUserMadeChanges(true);

    // Initialize rules array if it doesn't exist
    const currentRules = degreeTemplate.rules || [];
    
    // Define consolidated rule types that can be edited
    const consolidatedRuleTypes = new Set([
      'total_credits', 'credits_from_list', 'min_grade', 'minCredits',
      'minCoursesFromList', 'minCreditsFromMandatory', 'minCreditsFromAnySelectiveList', 'minCreditsFromIdPattern'
    ]);
    
    const ruleMap = new Map(updatedRules.map(rule => [rule.id, rule]));
    const existingRuleIds = new Set(currentRules.map(rule => rule.id));
    
    // Keep non-consolidated rules unchanged, and update/remove consolidated rules based on updatedRules
    const newRulesArray = currentRules.filter(originalRule => {
      // Keep non-consolidated rules
      if (!consolidatedRuleTypes.has(originalRule.type)) {
        return true;
      }
      // For consolidated rules, only keep those that still exist in updatedRules
      return ruleMap.has(originalRule.id);
    }).map(originalRule => {
      // Update consolidated rules with new data if available
      return ruleMap.has(originalRule.id) ? ruleMap.get(originalRule.id)! : originalRule;
    });
    
    // Add completely new rules that weren't in the original rules array
    updatedRules.forEach(rule => {
      if (!existingRuleIds.has(rule.id)) {
        newRulesArray.push(rule);
      }
    });

    const newDegreeTemplate = { ...degreeTemplate, rules: newRulesArray };
    
    if (import.meta.env.DEV) {
      console.log('[handleSaveConsolidatedRules] About to save template with rules:');
      console.log('[handleSaveConsolidatedRules] Original rules count:', currentRules.length);
      console.log('[handleSaveConsolidatedRules] Updated rules count:', updatedRules.length);
      console.log('[handleSaveConsolidatedRules] Final rules count:', newRulesArray.length);
      console.log('[handleSaveConsolidatedRules] Final rule IDs:', newRulesArray.map(r => r.id));
      console.log('[handleSaveConsolidatedRules] Final newDegreeTemplate object:', JSON.parse(JSON.stringify(newDegreeTemplate)));
    }
    
    setDegreeTemplate(newDegreeTemplate);
    
    if (import.meta.env.DEV) {
      console.log('[handleSaveConsolidatedRules] setDegreeTemplate called. This should trigger autosave effect.');
    }
    
    setIsConsolidatedRuleEditorOpen(false);
    setRulesForConsolidatedEditing([]);
  }, [degreeTemplate, isInitialLoad, isLoading, currentUser, setHasUserMadeChanges]);

  const handleExportPlan = useCallback(() => {
    if (!degreeTemplate) {
      showAlertMessage('אין תוכנית לימודים לייצוא', 'error');
      return;
    }

    const exportData = {
      degreeTemplate,
      grades,
      classificationChecked,
      classificationCredits,
      binaryStates,
      timestamp: Date.now(),
      exportDate: new Date().toISOString(),
      appVersion: '1.0.0', // You can update this as needed
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `degree-plan-${degreeTemplate.name || 'unknown'}-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }, [degreeTemplate, grades, classificationChecked, classificationCredits, binaryStates]);

  const handleImportPlan = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target?.result as string);
        
        if (!importedData.degreeTemplate) {
          showAlertMessage('קובץ לא תקין: חסרה תוכנית לימודים', 'error');
          return;
        }

        setImportData(importedData);
        setShowImportConfirm(true);
      } catch (error) {
        console.error('Error importing plan:', error);
        showAlertMessage('שגיאה בייבוא הקובץ: הקובץ פגום או לא תקין', 'error');
      }
    };
    reader.readAsText(file);
  }, []);

  // Function to restore proper semester ordering after loading from Firestore
  const fixSemesterOrdering = (template: DegreeTemplate): DegreeTemplate => {
    if (!template.semesters || typeof template.semesters !== 'object') {
      return template;
    }

    const hebrewLetterOrder = [
      'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 
      'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת'
    ];
    
    const getHebrewLetter = (semesterName: string): string => {
      const match = semesterName.match(/([א-ת])['׳]?$/);
      return match ? match[1] : '';
    };
    
    if (import.meta.env.DEV) {
      console.debug('[DEBUG] Original semester names:', Object.keys(template.semesters));
    }
    
    const semesterEntries = Object.entries(template.semesters).sort((a, b) => {
      const letterA = getHebrewLetter(a[0]);
      const letterB = getHebrewLetter(b[0]);
      
      if (import.meta.env.DEV) {
        console.debug(`[DEBUG] Comparing "${a[0]}" (${letterA}) vs "${b[0]}" (${letterB})`);
      }
      
      const indexA = hebrewLetterOrder.indexOf(letterA);
      const indexB = hebrewLetterOrder.indexOf(letterB);
      
      if (import.meta.env.DEV) {
        console.debug(`[DEBUG] Indices: ${indexA} vs ${indexB}`);
      }
      
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      
      return indexA - indexB;
    });
    
    if (import.meta.env.DEV) {
      console.debug('[DEBUG] Sorted semester names:', semesterEntries.map(e => e[0]));
    }
    
    // Rebuild the semesters object with proper ordering
    const orderedSemesters: Record<string, string[]> = {};
    semesterEntries.forEach(([semesterName, courseIds]) => {
      orderedSemesters[semesterName] = courseIds;
    });
    
    if (import.meta.env.DEV) {
      console.debug('[DEBUG] Final ordered semester names:', Object.keys(orderedSemesters));
    }
    
    return {
      ...template,
      semesters: orderedSemesters
    };
  };

  useEffect(() => {
    // Don't autosave during initial load unless user has made changes
    if (isLoading || !degreeTemplate || (isInitialLoad && !hasUserMadeChanges)) {
      if (import.meta.env.DEV) {
        console.log("[DegreePlanView] Autosave effect: Skipped due to guard conditions. isLoading:", isLoading, "degreeTemplate:", !!degreeTemplate, "isInitialLoad:", isInitialLoad, "hasUserMadeChanges:", hasUserMadeChanges);
        if (degreeTemplate?.rules) {
          console.log("[DegreePlanView] Autosave skipped but template has rules:", degreeTemplate.rules.map(r => r.id));
        }
      }
      return;
    }

    if (import.meta.env.DEV) {
      console.log("[DegreePlanView] Autosave effect: Triggered! Current semesters:", Object.keys(degreeTemplate.semesters || {}));
      console.log("[DegreePlanView] Autosave triggered with template rules:", degreeTemplate.rules?.map(r => r.id) || []);
      console.log("[DegreePlanView] Autosave - degreeTemplate object hash:", JSON.stringify(degreeTemplate).substring(0, 100) + '...');
    }

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    setSaveStatus('saving');

    autosaveTimeoutRef.current = window.setTimeout(() => {
      if (import.meta.env.DEV) {
        console.log("[DegreePlanView] Autosave timeout executed! CurrentUser:", !!currentUser, "UID:", currentUser?.uid);
        console.log("[DegreePlanView] Template semesters at save time:", Object.keys(degreeTemplate.semesters || {}));
      }
      
      if (currentUser && currentUser.uid) {
        if (import.meta.env.DEV) {
          console.log("[DegreePlanView] Autosaving plan to Firestore for user:", currentUser.uid);
          console.log("[DegreePlanView] Autosave - Template rules being saved:", degreeTemplate.rules?.map(r => r.id) || []);
        }
        savePlanToFirestore(
          currentUser.uid,
          degreeTemplate,
          grades,
          classificationChecked,
          classificationCredits,
          binaryStates
        ).then(() => {
          if (import.meta.env.DEV) {
            console.log("[DegreePlanView] Firestore save completed successfully");
            console.log("[DegreePlanView] Firestore save - Template rules that were saved:", degreeTemplate.rules?.map(r => r.id) || []);
          }
          setSaveStatus('saved');
        }).catch(error => {
          if (import.meta.env.DEV) {
            console.error("[DegreePlanView] Error autosaving to Firestore:", error);
          }
          setSaveStatus('idle');
        });
      } else {
        if (import.meta.env.DEV) {
          console.log("[DegreePlanView] Autosaving plan to local storage (no user logged in)...");
        }
        savePlan(degreeTemplate, grades, classificationChecked, classificationCredits, binaryStates);
        setSaveStatus('saved');
      }
    }, 1500);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [degreeTemplate, grades, classificationChecked, classificationCredits, binaryStates, currentUser, authLoading, setSaveStatus, isLoading, isInitialLoad, hasUserMadeChanges]);

  useEffect(() => {
    const loadInitialData = async () => {
      if (import.meta.env.DEV) {
        console.log("[DegreePlanView] Initial Load Effect Triggered. Auth Loading:", authLoading, "CurrentUser:", !!currentUser);
      }
  
      if (authLoading) {
        if (import.meta.env.DEV) {
          console.log("[DegreePlanView] Initial Load: Waiting for auth state...");
        }
        setIsLoading(true);
        return;
      }
  
      setIsLoading(true);
  
      try {
        const courses = await fetchAllCourses();
        if (import.meta.env.DEV) {
          console.log("[DegreePlanView] Initial Load: Fetched allCourses:", courses.length);
        }
        setAllCoursesData(courses);
  
        const fetchedDegreeFileData = await fetchDegreeTemplates();
        if (import.meta.env.DEV) {
          console.log("[DegreePlanView] Initial Load: Fetched degree file data.");
        }
  
        let templateForProcessing: DegreeTemplate | undefined = undefined;
        const globalRulesForProcessing: DegreeRule[] = fetchedDegreeFileData?.globalRules || [];
        let gradesForProcessing: Record<string, string> = {};
        let classificationCheckedForProcessing: Record<string, boolean> = {};
        let classificationCreditsForProcessing: Record<string, number> = {};
        let binaryStatesForProcessing: Record<string, boolean> = {};
        let loadedFrom: 'firestore' | 'local' | 'default' = 'default';
  
        if (currentUser && currentUser.uid) {
          if (import.meta.env.DEV) {
            console.log("[DegreePlanView] Initial Load: User logged in (" + currentUser.uid + "). Trying Firestore...");
          }
          const firestorePlan = await loadPlanFromFirestore(currentUser.uid);
  
          if (firestorePlan && firestorePlan.degreeTemplate) {
            if (import.meta.env.DEV) {
              console.log("[DegreePlanView] Initial Load: Found plan in Firestore.");
            }
            loadedFrom = 'firestore';
            templateForProcessing = fixSemesterOrdering(firestorePlan.degreeTemplate);
            
            // Ensure ID exists, especially for older Firestore plans
            if (!templateForProcessing.id && fetchedDegreeFileData) {
              for (const key in fetchedDegreeFileData) {
                if (key !== 'globalRules') {
                  const pristineTemplate = fetchedDegreeFileData[key] as DegreeTemplate;
                  if (pristineTemplate.name === templateForProcessing.name) {
                    templateForProcessing.id = pristineTemplate.id; // Which is 'key'
                    if (import.meta.env.DEV) {
                      console.log(`[DegreePlanView] Initial Load: Assigned missing ID '${templateForProcessing.id}' to Firestore template based on name match.`);
                    }
                    break;
                  }
                }
              }
            }
            
            // Only use fresh rules if no rules exist or rules are empty, preserve user customizations
            if (templateForProcessing.id && fetchedDegreeFileData && fetchedDegreeFileData[templateForProcessing.id]) {
              if (!templateForProcessing.rules || templateForProcessing.rules.length === 0) {
                const freshTemplate = fetchedDegreeFileData[templateForProcessing.id] as DegreeTemplate;
                templateForProcessing.rules = freshTemplate.rules;
                if (import.meta.env.DEV) {
                  console.log(`[DegreePlanView] Initial Load: Used fresh rules from template file for '${templateForProcessing.id}' (no existing rules)`);
                }
              } else {
                if (import.meta.env.DEV) {
                  console.log(`[DegreePlanView] Initial Load: Preserved user customized rules for '${templateForProcessing.id}' (${templateForProcessing.rules.length} rules)`);
                }
              }
            }
            gradesForProcessing = firestorePlan.grades || {};
            classificationCheckedForProcessing = firestorePlan.classificationChecked || {};
            classificationCreditsForProcessing = firestorePlan.classificationCredits || {};
            binaryStatesForProcessing = firestorePlan.binaryStates || {};
          } else {
            if (import.meta.env.DEV) {
              console.log("[DegreePlanView] Initial Load: No plan found in Firestore for user. Loading default template.");
            }
            loadedFrom = 'default';
            const defaultTemplateId = 'mechanical-engineering-general';
            templateForProcessing = fetchedDegreeFileData?.[defaultTemplateId] as DegreeTemplate | undefined;
            gradesForProcessing = {};
            classificationCheckedForProcessing = {};
            classificationCreditsForProcessing = {};
            binaryStatesForProcessing = {};
  
            if (templateForProcessing) {
              if (import.meta.env.DEV) {
                console.log("[DegreePlanView] Initial Load: Triggering initial save of default template to Firestore for user:", currentUser.uid);
              }
              await savePlanToFirestore(
                currentUser.uid,
                templateForProcessing,
                gradesForProcessing,
                classificationCheckedForProcessing,
                classificationCreditsForProcessing,
                binaryStatesForProcessing
              );
            }
          }
        } else {
          if (import.meta.env.DEV) {
            console.log("[DegreePlanView] Initial Load: No user logged in. Trying local storage...");
          }
          const savedPlanData: StoredPlan | null = loadPlan();
          if (savedPlanData && savedPlanData.template) {
            if (import.meta.env.DEV) {
              console.log("[DegreePlanView] Initial Load: Found plan in local storage.");
            }
            loadedFrom = 'local';
            templateForProcessing = fixSemesterOrdering(savedPlanData.template);
            // Ensure ID exists, especially for older local storage plans
            if (import.meta.env.DEV) {
                console.debug('[DegreePlanView Initial Load] Local plan loaded, template.id BEFORE potential fix:', templateForProcessing?.id);
            }
            if (!templateForProcessing.id && fetchedDegreeFileData) {
              for (const key in fetchedDegreeFileData) {
                if (key !== 'globalRules') {
                  const pristineTemplate = fetchedDegreeFileData[key] as DegreeTemplate;
                  // Ensure pristineTemplate and its name are defined
                  if (pristineTemplate && pristineTemplate.name && pristineTemplate.id && templateForProcessing.name === pristineTemplate.name) {
                    templateForProcessing.id = pristineTemplate.id; // pristineTemplate.id should be 'key' due to dataLoader changes
                    if (import.meta.env.DEV) {
                      console.log(`[DegreePlanView] Initial Load: Assigned missing ID '${templateForProcessing.id}' to local storage template '${templateForProcessing.name}' based on name match with pristine template '${key}'.`);
                    }
                    break;
                  }
                }
              }
            }
            if (import.meta.env.DEV) {
                console.debug('[DegreePlanView Initial Load] Local plan loaded, template.id AFTER potential fix:', templateForProcessing?.id);
            }

            // Only use fresh rules if no rules exist or rules are empty, preserve user customizations
            if (templateForProcessing.id && fetchedDegreeFileData && fetchedDegreeFileData[templateForProcessing.id]) {
              if (!templateForProcessing.rules || templateForProcessing.rules.length === 0) {
                const freshTemplate = fetchedDegreeFileData[templateForProcessing.id] as DegreeTemplate;
                templateForProcessing.rules = freshTemplate.rules;
                if (import.meta.env.DEV) {
                  console.log(`[DegreePlanView] Initial Load: Used fresh rules from template file for '${templateForProcessing.id}' (from local storage, no existing rules)`);
                }
              } else {
                if (import.meta.env.DEV) {
                  console.log(`[DegreePlanView] Initial Load: Preserved user customized rules for '${templateForProcessing.id}' from local storage (${templateForProcessing.rules.length} rules)`);
                }
              }
            }

            gradesForProcessing = savedPlanData.grades || {};
            classificationCheckedForProcessing = savedPlanData.classificationChecked || {};
            classificationCreditsForProcessing = savedPlanData.classificationCredits || {};
            binaryStatesForProcessing = savedPlanData.binaryStates || {};
          } else {
            if (import.meta.env.DEV) {
              console.log("[DegreePlanView] Initial Load: No plan found in local storage. Loading default template.");
            }
            loadedFrom = 'default';
            const defaultTemplateId = 'mechanical-engineering-general';
            templateForProcessing = fetchedDegreeFileData?.[defaultTemplateId] as DegreeTemplate | undefined;
            gradesForProcessing = {};
            classificationCheckedForProcessing = {};
            classificationCreditsForProcessing = {};
            binaryStatesForProcessing = {};
          }
        }
  
        if (templateForProcessing) {
          if (import.meta.env.DEV) {
            console.log(`[DegreePlanView] Initial Load: Setting state. Loaded from: ${loadedFrom}`);
          }
          if (import.meta.env.DEV) {
            console.debug('[DegreePlanView Initial Load] templateForProcessing right before processing definedMandatoryCourseIds:', JSON.parse(JSON.stringify(templateForProcessing)));
          }

          // Ensure definedMandatoryCourseIds is populated if missing
          if (!templateForProcessing.definedMandatoryCourseIds || templateForProcessing.definedMandatoryCourseIds.length === 0) {
            if (templateForProcessing.semesters && Object.keys(templateForProcessing.semesters).length > 0) {
              const semesterBasedMandatoryIds = Object.values(templateForProcessing.semesters).flat().filter(id => typeof id === 'string');
              templateForProcessing.definedMandatoryCourseIds = semesterBasedMandatoryIds;
              if (import.meta.env.DEV) {
                console.debug('[DegreePlanView Initial Load] Populated templateForProcessing.definedMandatoryCourseIds from semesters:', semesterBasedMandatoryIds);
              }
            } else {
              templateForProcessing.definedMandatoryCourseIds = []; // Default to empty if no semesters either
              if (import.meta.env.DEV) {
                console.debug('[DegreePlanView Initial Load] Initialized templateForProcessing.definedMandatoryCourseIds as empty (no pre-existing and no semesters).');
              }
            }
          } else {
            if (import.meta.env.DEV) {
              console.debug('[DegreePlanView Initial Load] templateForProcessing already had definedMandatoryCourseIds:', templateForProcessing.definedMandatoryCourseIds);
            }
          }

                  setDegreeTemplate(templateForProcessing);
        setCurrentGlobalRules(globalRulesForProcessing);
        setGrades(gradesForProcessing);
        setClassificationChecked(classificationCheckedForProcessing);
        setClassificationCredits(classificationCreditsForProcessing);
        setBinaryStates(binaryStatesForProcessing);
        
        // Only show template selection if this is a first-time user with no saved plan
        if (loadedFrom === 'default' && !currentUser) {
          setShowTemplateSelection(true);
          setIsSwitchingTemplate(false);
        }
      } else {
        if (import.meta.env.DEV) {
          console.error("[DegreePlanView] Initial Load: No template could be loaded (neither saved nor default).");
        }
        // No template could be loaded - show template selection
        setShowTemplateSelection(true);
        setIsSwitchingTemplate(false);
      }
  
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("[DegreePlanView] Initial Load: Error loading initial data:", error);
        }
      } finally {
        if (import.meta.env.DEV) {
          console.log("[DegreePlanView] Initial Load: Finished processing. Setting isLoading to false.");
        }
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    };
  
    loadInitialData();
  }, [currentUser, authLoading]);

  useEffect(() => {
    const selectedCourseNodes = selectedNodes.filter(n => n.type === 'course');

    if (selectedCourseNodes.length > 0) {
      const selectedIds = new Set(selectedCourseNodes.map(node => node.id));
      
      // Update edges with highlighting and collect relevant course IDs
      const relevantCourseIds = new Set(selectedIds);
      
      setEdges(prevEdges => {
        const updatedEdges = prevEdges.map(edge => {
          const isLeadingToSelected = selectedIds.has(edge.target);
          const isGoingOutFromSelected = selectedIds.has(edge.source);
          
          if (isLeadingToSelected) {
            // Collect relevant course IDs from edges leading to selected courses
            relevantCourseIds.add(edge.source);
            relevantCourseIds.add(edge.target);
            
            return {
              ...edge,
              style: { ...edge.style, stroke: '#ef4444', strokeWidth: 2.5, strokeOpacity: 1 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#ef4444' }, 
              zIndex: 10, 
            };
          } else if (isGoingOutFromSelected) {
            // Collect relevant course IDs from edges going out from selected courses
            relevantCourseIds.add(edge.source);
            relevantCourseIds.add(edge.target);
            
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
        });
        
        // Update nodes with opacity changes after we've collected relevant IDs
        setNodes(prevNodes => 
          prevNodes.map(node => {
            if (node.type !== 'course') {
              return node; // Don't modify non-course nodes
            }
            
            const isRelevant = relevantCourseIds.has(node.id);
            
            return {
              ...node,
              style: {
                ...node.style,
                opacity: isRelevant ? 1 : 0.3, // Significantly lower opacity for irrelevant courses
              }
            };
          })
        );
        
        return updatedEdges;
      });
    } else {
      // Reset both edges and nodes when no course is selected
      setEdges(prevEdges => 
        prevEdges.map(edge => ({
          ...edge,
          style: { stroke: '#cccccc', strokeWidth: 1.5, strokeOpacity: 0.2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#cccccc' }, 
          zIndex: 0, 
        }))
      );
      
      setNodes(prevNodes => 
        prevNodes.map(node => ({
          ...node,
          style: {
            ...node.style,
            opacity: 1, // Reset all nodes to full opacity
          }
        }))
      );
    }
  }, [selectedNodes, setEdges, setNodes]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("[DegreePlanView] Node/Edge Update Effect: Triggered. import.meta.env.DEV:", import.meta.env.DEV);
      console.log("[DegreePlanView] Node/Edge Update Effect: Guard conditions - isLoading:", isLoading, "!degreeTemplate:", !degreeTemplate, "!Array.isArray(allCoursesData):", !Array.isArray(allCoursesData), "allCoursesData.length === 0:", Array.isArray(allCoursesData) && allCoursesData.length === 0);
    }
    
    if (isLoading || !degreeTemplate || !Array.isArray(allCoursesData) || allCoursesData.length === 0) {
      if (import.meta.env.DEV) {
        console.log("[DegreePlanView] Node/Edge Update Effect: Guarded. Not generating nodes/edges yet.");
        if (isLoading) console.log("Reason: isLoading is true.");
        if (!degreeTemplate) console.log("Reason: currentTemplate is falsy.");
        if (!Array.isArray(allCoursesData)) console.log("Reason: allCourses is not an array.");
        if (Array.isArray(allCoursesData) && allCoursesData.length === 0) console.log("Reason: allCourses is an empty array.");
      }
      if (!isLoading && nodes.length > 0) {
         if (import.meta.env.DEV) {
           console.log("[DegreePlanView] Node/Edge Update Effect: Clearing existing nodes as conditions not met.");
         }
         setNodes([]);
         setEdges([]);
      }
      return;
    }

    if (import.meta.env.DEV) {
      console.log("[DegreePlanView] Node/Edge Update Effect: Guard passed. Generating nodes and edges...");
    }
    const newNodes = transformDataToNodes(
      degreeTemplate,
      allCoursesData,
      grades, 
      binaryStates,
      handleBinaryChange, 
      handleAddCourseToSemesterCallback, 
      handleAddSemesterCallback,
      handleGradeChange,
      handleRemoveCourseCallback,
      classificationChecked,
      handleClassificationToggle,
      classificationCredits,
      handleClassificationCreditsChange,
      currentGlobalRules,
      allTemplatesData,
      handleEditRule,
      handleDeleteRule,
      handleSyncRules,
      handleToggleCourseListEditorModal,
      handleRemoveSemesterCallback
    );
    const newEdges = transformDataToEdges(degreeTemplate, allCoursesData);
    if (import.meta.env.DEV) {
      console.log("[DegreePlanView] Node/Edge Update Effect: Generated newNodes count:", newNodes.length, "newEdges count:", newEdges.length);
    }
    
    setNodes(() => newNodes);
    setEdges(() => newEdges);
  }, [
    degreeTemplate, allCoursesData, grades, binaryStates, classificationChecked, 
    classificationCredits, currentGlobalRules,
    handleAddCourseToSemesterCallback, handleAddSemesterCallback, handleGradeChange, 
    handleRemoveCourseCallback, handleBinaryChange, handleClassificationToggle, 
    handleClassificationCreditsChange, handleEditRule, handleDeleteRule, handleSyncRules, handleToggleCourseListEditorModal,
    handleRemoveSemesterCallback, setNodes, setEdges, isLoading, allTemplatesData
  ]);

  const handleSelectionChange = useCallback(({ nodes: selNodes }: OnSelectionChangeParams) => {
    setSelectedNodes(selNodes);
  }, [setSelectedNodes]);

  const { availableCoursesForModal, alreadyTakenCoursesForModal } = useMemo(() => {
    if (!degreeTemplate || typeof degreeTemplate.semesters !== 'object' || degreeTemplate.semesters === null || !Array.isArray(allCoursesData)) {
      if (degreeTemplate && (typeof degreeTemplate.semesters !== 'object' || degreeTemplate.semesters === null)) {
        console.warn('Data Structure Warning (availableCoursesForModal): currentTemplate.semesters is not an object!', degreeTemplate.semesters);
      }
      return {
        availableCoursesForModal: Array.isArray(allCoursesData) ? allCoursesData.filter(course => !course.isClassificationCourse) : [],
        alreadyTakenCoursesForModal: []
      };
    }
    const coursesInPlan = new Set<string>();
    Object.values(degreeTemplate.semesters).forEach(semesterCourseList => {
      semesterCourseList.forEach(id => coursesInPlan.add(id));
    });
    
    const available = allCoursesData.filter(course => !coursesInPlan.has(course._id) && !course.isClassificationCourse);
    const alreadyTaken = allCoursesData.filter(course => coursesInPlan.has(course._id) && !course.isClassificationCourse);
    
    return {
      availableCoursesForModal: available,
      alreadyTakenCoursesForModal: alreadyTaken
    };
  }, [allCoursesData, degreeTemplate]);

  const applyLoadedData = (
    template: DegreeTemplate | undefined,
    grades: Record<string, string>,
    checked: Record<string, boolean>,
    credits: Record<string, number>,
    binaries: Record<string, boolean>,
    globals: DegreeRule[]
  ) => {
    setDegreeTemplate(template);
    setGrades(grades);
    setClassificationChecked(checked);
    setClassificationCredits(credits);
    setBinaryStates(binaries);
    setCurrentGlobalRules(globals);
  };

  const handleSelectTemplate = useCallback((selectedTemplate: DegreeTemplate) => {
    applyLoadedData(
      selectedTemplate,
      {}, // reset grades
      {}, // reset classificationChecked
      {}, // reset classificationCredits
      {}, // reset binaryStates
      currentGlobalRules // keep global rules
    );
    setShowTemplateSelection(false);
    // Trigger save
    setSaveStatus('saving');
    localStorage.setItem('hasSelectedTemplate', 'true');
  }, [currentGlobalRules]);

  const showAlertMessage = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', title?: string) => {
    setAlertConfig({ message, type, title });
    setShowAlert(true);
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {/* Top-left: Logo */}
      <div className="fixed top-4 left-4 z-50 items-center gap-2 flex flex-row-reverse bg-slate-50/60 dark:bg-gray-800/60 rounded-lg shadow-md backdrop-blur-sm p-2">
        <Logo />
      </div>
      
      {/* Top-right: Save Status and Profile */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-slate-50/60 dark:bg-gray-800/60 rounded-lg shadow-md backdrop-blur-sm p-2">
        <AuthButtons
          currentUser={currentUser}
          onSignIn={() => setShowSignInConfirm(true)}
          onSignOut={async () => { await signOut(); }}
          onExportPlan={handleExportPlan}
          onImportPlan={handleImportPlan}
          onSwitchTemplate={() => setShowSwitchConfirm(true)}
        />
        <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
        <div className="flex items-center justify-center min-w-[50px] text-center p-2">
          {saveStatus === 'saving' && <span className="text-xs text-slate-600 dark:text-slate-300 p-1 bg-slate-200 dark:bg-slate-700 rounded">שומר...</span>}
          {saveStatus === 'saved' && <span className="text-xs text-green-600 dark:text-green-400 p-1 bg-green-100 dark:bg-green-800 rounded">נשמר ✓</span>}
        </div>
      </div>
              <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange as OnNodesChange<Node>}
          onEdgesChange={onEdgesChange as OnEdgesChange<Edge>}
          onSelectionChange={handleSelectionChange}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="top-right"
          colorMode={theme}
          nodesDraggable={false}
          nodesConnectable={false}
          selectNodesOnDrag={false}
          zoomOnDoubleClick={false}
          onNodeDoubleClick={handleNodeDoubleClick as NodeMouseHandler<Node>}
          onNodeClick={handleNodeClick as NodeMouseHandler<Node>}
        >
          <Controls />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
      </ReactFlowProvider>
      <CourseSelectionModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        courses={availableCoursesForModal}
        onSelectCourse={handleSelectCourseFromModal}
        semesterNumber={semesterToAddCourseTo}
        alreadyTakenCourses={alreadyTakenCoursesForModal}
      />
      {courseDetailModalData && courseDetailModalData.course && (
        <CourseDetailModal
          isOpen={!!courseDetailModalData}
          onClose={() => {
            setCourseDetailModalData(null);
          }}
          course={courseDetailModalData.course}
          allCourses={allCoursesData}
          coursesInPlanIds={courseDetailModalData.coursesInPlanIds}
          semesters={courseDetailModalData.semesters}
          targetCourseSemesterKey={courseDetailModalData.targetCourseSemesterKey}
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
          if (degreeTemplate && degreeTemplate.definedMandatoryCourseIds) {
            lists[MANDATORY_COURSES_LIST_KEY] = [...new Set(degreeTemplate.definedMandatoryCourseIds)];
          } else if (degreeTemplate && typeof degreeTemplate.semesters === 'object' && degreeTemplate.semesters !== null) {
             const allMandatoryIdsFromSemesters = [...new Set(Object.values(degreeTemplate.semesters).flat())];
             lists[MANDATORY_COURSES_LIST_KEY] = allMandatoryIdsFromSemesters;
          } else {
            lists[MANDATORY_COURSES_LIST_KEY] = [];
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
      <TemplateSelectionModal
        isOpen={showTemplateSelection}
        onClose={() => setShowTemplateSelection(false)}
        templates={Object.values(allTemplatesData || {})}
        onSelectTemplate={handleSelectTemplate}
        isSwitching={isSwitchingTemplate}
        customTitle={isSwitchingTemplate ? 'החלף תכנית לימודים' : 'בחר תכנית לימודים ראשונית'}
        onExport={handleExportPlan}
      />
      <ConfirmModal
        isOpen={showSwitchConfirm}
        onClose={() => setShowSwitchConfirm(false)}
        message="החלפת תכנית תמחק את התכנית הנוכחית. האם לייצא קודם?"
        onConfirm={() => {
          setIsSwitchingTemplate(true);
          setShowTemplateSelection(true);
        }}
        confirmText="המשך ללא ייצוא"
        onExport={handleExportPlan}
      />
      <ConfirmModal
        isOpen={showSignInConfirm}
        onClose={() => setShowSignInConfirm(false)}
        message="התחברות תטען את התכנית מהענן, מה שעשוי למחוק שינויים מקומיים. האם לייצא קודם?"
        onConfirm={async () => { await signInWithGoogle(); }}
        onExport={handleExportPlan}
        confirmText="המשך ללא ייצוא"
      />
      <ConfirmModal
        isOpen={showDeleteSemesterConfirm}
        onClose={() => {
          setShowDeleteSemesterConfirm(false);
          setSemesterToDelete(null);
        }}
        message={`האם אתה בטוח שברצונך למחוק את ${semesterToDelete}?`}
        onConfirm={() => {
          if (semesterToDelete) {
            setDegreeTemplate(prevTemplate => {
              if (!prevTemplate || typeof prevTemplate.semesters !== 'object') return prevTemplate;
              const updatedSemesters = { ...prevTemplate.semesters };
              delete updatedSemesters[semesterToDelete];
              const newTemplate = { ...prevTemplate, semesters: updatedSemesters };
              if (import.meta.env.DEV) {
                console.log(`DegreePlanView: Semester ${semesterToDelete} removed. Updated template:`, newTemplate);
                console.log(`DegreePlanView: Remaining semesters:`, Object.keys(updatedSemesters));
              }
              return newTemplate;
            });
          }
          setShowDeleteSemesterConfirm(false);
          setSemesterToDelete(null);
        }}
        confirmText="מחק בכל זאת"
        confirmVariant="danger"
      />
      <AlertModal
        isOpen={showAlert}
        onClose={() => setShowAlert(false)}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttonText={alertConfig.buttonText}
      />
      <ConfirmModal
        isOpen={showDeleteRuleConfirm}
        onClose={() => {
          setShowDeleteRuleConfirm(false);
          setRuleToDelete(null);
        }}
        title="מחיקת כלל"
        message="האם אתה בטוח שברצונך למחוק כלל זה?"
        confirmText="מחק"
        confirmVariant="danger"
        onConfirm={() => {
          if (ruleToDelete) {
            setDegreeTemplate(prevTemplate => {
              if (!prevTemplate || !prevTemplate.rules) return prevTemplate;
              const updatedRules = prevTemplate.rules.filter(r => r.id !== ruleToDelete);
              return { ...prevTemplate, rules: updatedRules };
            });
          }
          setShowDeleteRuleConfirm(false);
          setRuleToDelete(null);
        }}
      />
      <ConfirmModal
        isOpen={showImportConfirm}
        onClose={() => {
          setShowImportConfirm(false);
          setImportData(null);
        }}
        title="ייבוא תוכנית"
        message={importData ? `האם אתה בטוח שברצונך לייבא את התוכנית "${importData.degreeTemplate?.name || 'לא ידוע'}" מתאריך ${importData.exportDate ? new Date(importData.exportDate).toLocaleDateString('he-IL') : 'לא ידוע'}?\nפעולה זו תחליף את התוכנית הנוכחית.` : ''}
        confirmText="ייבא"
        confirmVariant="primary"
        onConfirm={() => {
          if (importData) {
            setDegreeTemplate(importData.degreeTemplate);
            setGrades(importData.grades || {});
            setClassificationChecked(importData.classificationChecked || {});
            setClassificationCredits(importData.classificationCredits || {});
            setBinaryStates(importData.binaryStates || {});
            
            showAlertMessage(`התוכנית "${importData.degreeTemplate?.name || 'לא ידוע'}" יובאה בהצלחה!`, 'success');
          }
          setShowImportConfirm(false);
          setImportData(null);
        }}
      />

      {/* Sync Rules Template Selection Modal */}
      <TemplateSelectionModal
        isOpen={showSyncTemplateSelection}
        onClose={() => setShowSyncTemplateSelection(false)}
        templates={Object.values(allTemplatesData || {})}
        onSelectTemplate={(template: DegreeTemplate) => {
          setSelectedSyncTemplate(template);
          setShowSyncTemplateSelection(false);
          setShowSyncRulesConfirm(true);
        }}
        isSwitching={false}
        customTitle="בחר תכנית לסנכרון כללים"
        onExport={handleExportPlan}
      />

      {/* Sync Rules Confirmation Modal */}
      <ConfirmModal
        isOpen={showSyncRulesConfirm}
        onClose={() => setShowSyncRulesConfirm(false)}
        message="סנכרון הכללים ירשום מחדש את כל הכללים והרשימות מהתכנית שנבחרה, אך ישמור על הקורסים בסמסטרים. האם להמשיך?"
        onConfirm={handleConfirmSyncRules}
        onExport={handleExportPlan}
        confirmText="המשך ללא ייצוא"
      />
    </div>
  );
}

export default DegreePlanView;