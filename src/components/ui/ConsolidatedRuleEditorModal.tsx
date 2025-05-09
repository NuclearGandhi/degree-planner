import React, { useState, useEffect } from 'react';
import { DegreeRule } from '../../types/data';
import BaseModal from './BaseModal';

interface EditableRuleState {
  id: string; // Original rule ID
  type: DegreeRule['type'];
  description: string;
  // Store numeric values as string to handle empty input, convert to number on save
  numericValue: string | undefined; 
}

interface ConsolidatedRuleEditorModalProps {
  isOpen: boolean;
  rules: DegreeRule[];
  onClose: () => void;
  onSave: (updatedRules: DegreeRule[]) => void;
  // availableCourseListNames: string[]; // Might be needed if list rules are part of consolidated
}

const ConsolidatedRuleEditorModal: React.FC<ConsolidatedRuleEditorModalProps> = ({
  isOpen,
  rules,
  onClose,
  onSave,
  // availableCourseListNames,
}) => {
  const [editableRules, setEditableRules] = useState<EditableRuleState[]>([]);

  useEffect(() => {
    if (rules && isOpen) {
      const initialEditableStates = rules.map(rule => {
        let numValue: number | undefined = undefined;
        if (rule.type === 'total_credits') numValue = rule.required_credits;
        else if (rule.type === 'minCredits') numValue = rule.min;
        else if (rule.type === 'min_grade') numValue = rule.min_grade_value;
        else if (rule.type === 'credits_from_list') numValue = rule.required_credits;
        else if (rule.type === 'minCoursesFromList') numValue = rule.min;
        else if (rule.type === 'minCreditsFromMandatory') numValue = rule.min;
        else if (rule.type === 'minCreditsFromAnySelectiveList') numValue = rule.min;
        // Add other types if they become editable in consolidated view

        return {
          id: rule.id,
          type: rule.type,
          description: rule.description || '',
          numericValue: numValue !== undefined ? String(numValue) : undefined,
        };
      });
      setEditableRules(initialEditableStates);
    }
  }, [rules, isOpen]);

  const handleValueChange = (ruleId: string, value: string) => {
    setEditableRules(prev =>
      prev.map(rule =>
        rule.id === ruleId ? { ...rule, numericValue: value } : rule
      )
    );
  };
  
  const handleDescriptionChange = (ruleId: string, newDescription: string) => {
    setEditableRules(prev =>
      prev.map(rule =>
        rule.id === ruleId ? { ...rule, description: newDescription } : rule
      )
    );
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const updatedRules: DegreeRule[] = editableRules.map(editableRule => {
      const originalRule = rules.find(r => r.id === editableRule.id);
      if (!originalRule) {
        console.error(`Original rule not found for ID: ${editableRule.id}`);
        return null; 
      }

      const updatedRule: DegreeRule = { 
        ...originalRule, 
        description: editableRule.description 
      };
      
      const numericValue = editableRule.numericValue !== undefined && editableRule.numericValue.trim() !== '' 
        ? parseInt(editableRule.numericValue, 10) 
        : undefined;

      // Clear potentially irrelevant fields before setting new ones based on type
      delete updatedRule.required_credits;
      delete updatedRule.min;
      delete updatedRule.min_grade_value;
      // For list rules, if they were part of this, we might need to preserve course_list_name
      // delete updatedRule.course_list_name; 
      
      if (numericValue !== undefined) {
        if (editableRule.type === 'total_credits') updatedRule.required_credits = numericValue;
        else if (editableRule.type === 'minCredits') updatedRule.min = numericValue;
        else if (editableRule.type === 'min_grade') updatedRule.min_grade_value = numericValue;
        else if (editableRule.type === 'credits_from_list') updatedRule.required_credits = numericValue;
        else if (editableRule.type === 'minCoursesFromList') updatedRule.min = numericValue;
        else if (editableRule.type === 'minCreditsFromMandatory') updatedRule.min = numericValue;
        else if (editableRule.type === 'minCreditsFromAnySelectiveList') updatedRule.min = numericValue;
      }
      return updatedRule;
    }).filter(Boolean) as DegreeRule[]; // Filter out any nulls

    onSave(updatedRules);
  };

  const commonInputClass = "mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-slate-900 dark:text-slate-50";

  const getNumericInputLabel = (type: DegreeRule['type']): string => {
    switch (type) {
      case 'total_credits':
      case 'credits_from_list':
      case 'minCredits':
      case 'minCreditsFromMandatory':
      case 'minCreditsFromAnySelectiveList':
        return 'ערך נדרש (נק\\"ז)';
      case 'min_grade':
        return 'ציון מינימלי';
      case 'minCoursesFromList':
        return 'מספר קורסים נדרש';
      default:
        return 'ערך נדרש';
    }
  };
  
  // Only allow editing of rules that have a numeric value field
  const editableRuleTypes: Array<DegreeRule['type']> = [
    'total_credits', 
    'minCredits', 
    'min_grade', 
    'credits_from_list', 
    'minCoursesFromList',
    'minCreditsFromMandatory',
    'minCreditsFromAnySelectiveList'
  ];

  return (
    <BaseModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="עריכת כללי התקדמות מאוחדים"
      maxWidth="max-w-xl" // Slightly wider for multiple rules
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
          {editableRules.map((rule) => {
            const isEditable = editableRuleTypes.includes(rule.type);
            return (
              <div key={rule.id} className="p-3 border border-slate-200 dark:border-slate-700 rounded-md">
                <div className="mb-2">
                  <label htmlFor={`ruleDesc-${rule.id}`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">תיאור הכלל</label>
                  <input
                    type="text"
                    id={`ruleDesc-${rule.id}`}
                    value={rule.description}
                    onChange={(e) => handleDescriptionChange(rule.id, e.target.value)}
                    className={commonInputClass}
                    required
                  />
                </div>

                {isEditable && (
                  <div className="mb-2">
                    <label 
                      htmlFor={`ruleValue-${rule.id}`} 
                      className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      {getNumericInputLabel(rule.type)}
                    </label>
                    <input
                      type="number"
                      id={`ruleValue-${rule.id}`}
                      value={rule.numericValue ?? ''}
                      onChange={(e) => handleValueChange(rule.id, e.target.value)}
                      className={commonInputClass}
                      min="0"
                      // Consider adding max for grade if type is 'min_grade'
                      max={rule.type === 'min_grade' ? "100" : undefined}
                    />
                  </div>
                )}
                {/* Add other specific fields if necessary, e.g., for list selection if list rules are consolidated */}
                {!isEditable && (
                   <p className="text-sm text-slate-500 dark:text-slate-400">לא ניתן לערוך פרמטרים עבור סוג כלל זה דרך ממשק זה.</p>
                )}
              </div>
            );
          })}
        </div>
        
        <div className="flex justify-end gap-x-2 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            ביטול
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            שמור את כל השינויים
          </button>
        </div>
      </form>
    </BaseModal>
  );
};

export default ConsolidatedRuleEditorModal; 