import React, { useState, useEffect } from 'react';
import { DegreeRule } from '../../types/data';
import BaseModal from './BaseModal';
import CustomNumberInput from './CustomNumberInput';

interface EditableRuleState {
  id: string;
  type: DegreeRule['type'];
  description: string;
  numericValue: string | number;
}

interface ConsolidatedRuleEditorModalProps {
  isOpen: boolean;
  rules: DegreeRule[];
  onClose: () => void;
  onSave: (updatedRules: DegreeRule[]) => void;
}

const ConsolidatedRuleEditorModal: React.FC<ConsolidatedRuleEditorModalProps> = ({
  isOpen,
  rules,
  onClose,
  onSave,
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

        return {
          id: rule.id,
          type: rule.type,
          description: rule.description || '',
          numericValue: numValue !== undefined ? numValue : '',
        };
      });
      setEditableRules(initialEditableStates);
    }
  }, [rules, isOpen]);

  const handleValueChange = (ruleId: string, value: string | number) => {
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
    const updatedRulesData = editableRules.map(editableRule => {
      const originalRule = rules.find(r => r.id === editableRule.id);
      if (!originalRule) {
        console.error(`Original rule not found for ID: ${editableRule.id}`);
        return null;
      }

      const updatedRule: DegreeRule = {
        ...originalRule,
        description: editableRule.description,
      };

      let finalNumericValue: number | undefined = undefined;
      if (editableRule.numericValue === '') {
        finalNumericValue = undefined;
      } else {
        const parsed = parseFloat(String(editableRule.numericValue));
        if (!isNaN(parsed)) {
          finalNumericValue = parsed;
        }
      }

      delete updatedRule.required_credits;
      delete updatedRule.min;
      delete updatedRule.min_grade_value;

      if (finalNumericValue !== undefined) {
        if (editableRule.type === 'total_credits') updatedRule.required_credits = finalNumericValue;
        else if (editableRule.type === 'minCredits') updatedRule.min = finalNumericValue;
        else if (editableRule.type === 'min_grade') updatedRule.min_grade_value = finalNumericValue;
        else if (editableRule.type === 'credits_from_list') updatedRule.required_credits = finalNumericValue;
        else if (editableRule.type === 'minCoursesFromList') updatedRule.min = finalNumericValue;
        else if (editableRule.type === 'minCreditsFromMandatory') updatedRule.min = finalNumericValue;
        else if (editableRule.type === 'minCreditsFromAnySelectiveList') updatedRule.min = finalNumericValue;
      }
      return updatedRule;
    }).filter(Boolean) as DegreeRule[];

    onSave(updatedRulesData);
  };

  const commonInputClass = "mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-slate-900 dark:text-slate-50";

  const getNumericInputLabel = (type: DegreeRule['type']): string => {
    switch (type) {
      case 'total_credits':
      case 'credits_from_list':
      case 'minCredits':
      case 'minCreditsFromMandatory':
      case 'minCreditsFromAnySelectiveList':
        return 'ערך נדרש (נק"ז)';
      case 'min_grade':
        return 'ציון מינימלי';
      case 'minCoursesFromList':
        return 'מספר קורסים נדרש';
      default:
        return 'ערך נדרש';
    }
  };

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
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto p-1">
          {editableRules.map((rule) => {
            const isEditable = editableRuleTypes.includes(rule.type);
            return (
              <div key={rule.id} className="p-3 border border-slate-200 dark:border-slate-700 rounded-md">
                <div className="mb-2">
                  <label htmlFor={`ruleDesc-${rule.id}`} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    תיאור הכלל:
                  </label>
                  <input
                    type="text"
                    id={`ruleDesc-${rule.id}`}
                    value={rule.description}
                    onChange={(e) => handleDescriptionChange(rule.id, e.target.value)}
                    className={`${commonInputClass} text-sm`}
                    required
                  />
                </div>

                {isEditable && (
                  <div className="flex items-center justify-between gap-x-3">
                    <label
                      htmlFor={`ruleValue-${rule.id}`}
                      className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap"
                    >
                      {getNumericInputLabel(rule.type)}:
                    </label>
                    <div className="flex-grow max-w-[150px]">
                      <CustomNumberInput
                        id={`ruleValue-${rule.id}`}
                        value={rule.numericValue}
                        onChange={(val) => handleValueChange(rule.id, val)}
                        className="w-full h-9"
                        inputClassName={commonInputClass.replace('mt-1', '').replace('rounded-md', '').trim() + ' h-full text-sm'}
                        buttonClassName="h-full text-sm"
                        min={0}
                        step={
                          rule.type === 'min_grade' || rule.type === 'minCoursesFromList'
                            ? 1
                            : 0.5
                        }
                        max={rule.type === 'min_grade' ? 100 : undefined}
                      />
                    </div>
                  </div>
                )}
                {!isEditable && (
                   <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">לא ניתן לערוך פרמטרים עבור סוג כלל זה.</p>
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