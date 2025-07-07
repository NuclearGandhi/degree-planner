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
  const [selectedNewRuleType, setSelectedNewRuleType] = useState<string>('');

  useEffect(() => {
    if (rules && isOpen) {
      const initialEditableStates = rules.map(rule => {
        let numValue: number | undefined = undefined;
        if (rule.type === 'total_credits') numValue = rule.required_credits;
        else if (rule.type === 'minCreditsFromMandatory') numValue = rule.min;
        else if (rule.type === 'minCreditsFromAnySelectiveList') numValue = rule.min;
        else if (rule.type === 'minCreditsFromIdPattern') numValue = rule.min;

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

  const handleRemoveRule = (ruleId: string) => {
    setEditableRules(prev => prev.filter(rule => rule.id !== ruleId));
  };

  const generateNewRuleId = (type: DegreeRule['type']): string => {
    return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleAddRule = () => {
    if (!selectedNewRuleType) return;
    
    const newRuleId = generateNewRuleId(selectedNewRuleType as DegreeRule['type']);
    let newRule: EditableRuleState;
    
    // Handle special pattern-based rules
    if (selectedNewRuleType === 'malag_pattern') {
      newRule = {
        id: newRuleId,
        type: 'minCreditsFromIdPattern' as DegreeRule['type'],
        description: 'קורסי מל"ג (הומניטריים)',
        numericValue: 6,
      };
    } else if (selectedNewRuleType === 'sports_pattern') {
      newRule = {
        id: newRuleId,
        type: 'minCreditsFromIdPattern' as DegreeRule['type'],
        description: 'קורסי ספורט',
        numericValue: 2,
      };
    } else {
      newRule = {
        id: newRuleId,
        type: selectedNewRuleType as DegreeRule['type'],
        description: getDefaultDescription(selectedNewRuleType as DegreeRule['type']),
        numericValue: getDefaultValue(),
      };
    }
    
    setEditableRules(prev => [...prev, newRule]);
    setSelectedNewRuleType('');
  };

  const getDefaultDescription = (type: DegreeRule['type']): string => {
    switch (type) {
      case 'total_credits': return 'סה"כ נקודות זכות';
      case 'minCreditsFromMandatory': return 'נקודות זכות מקורסי חובה';
      case 'minCreditsFromAnySelectiveList': return 'נקודות זכות מקורסי בחירה';
      default: return 'כלל חדש';
    }
  };

  const getDefaultValue = (): number => {
    return 0;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const updatedRulesData = editableRules.map(editableRule => {
      const originalRule = rules.find(r => r.id === editableRule.id);
      
      // Create base rule structure
      const updatedRule: DegreeRule = originalRule ? {
        ...originalRule,
        description: editableRule.description,
      } : {
        id: editableRule.id,
        type: editableRule.type,
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

      // Clear existing numeric properties
      delete updatedRule.required_credits;
      delete updatedRule.min;
      delete updatedRule.min_grade_value;

      // Set the appropriate numeric property based on rule type
      if (finalNumericValue !== undefined) {
        if (editableRule.type === 'total_credits') updatedRule.required_credits = finalNumericValue;
        else if (editableRule.type === 'minCreditsFromMandatory') updatedRule.min = finalNumericValue;
        else if (editableRule.type === 'minCreditsFromAnySelectiveList') updatedRule.min = finalNumericValue;
        else if (editableRule.type === 'minCreditsFromIdPattern') {
          updatedRule.min = finalNumericValue;
          // Set pattern and exclusions based on description
          if (editableRule.description.includes('מל"ג') || editableRule.description.includes('הומניטריים')) {
            updatedRule.id_pattern = '0324';
            updatedRule.exclude_courses = ['032411', '032412'];
          } else if (editableRule.description.includes('ספורט')) {
            updatedRule.id_pattern = '039';
          }
        }
      }
      
      return updatedRule;
    });

    onSave(updatedRulesData);
  };

  const commonInputClass = "mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-slate-900 dark:text-slate-50";

  const getNumericInputLabel = (type: DegreeRule['type']): string => {
    switch (type) {
      case 'total_credits':
      case 'minCreditsFromMandatory':
      case 'minCreditsFromAnySelectiveList':
      case 'minCreditsFromIdPattern':
        return 'ערך נדרש (נק"ז)';
      default:
        return 'ערך נדרש';
    }
  };

  // Available rule types for consolidated rules only
  const availableConsolidatedRuleTypes = [
    'total_credits',
    'minCreditsFromMandatory', 
    'minCreditsFromAnySelectiveList',
    'malag_pattern',
    'sports_pattern'
  ];

  const editableRuleTypes: Array<DegreeRule['type']> = [
    'total_credits',
    'minCreditsFromMandatory',
    'minCreditsFromAnySelectiveList',
    'minCreditsFromIdPattern'
  ];

  const ruleTypeLabels: Record<string, string> = {
    'total_credits': 'סה"כ נקודות זכות',
    'minCreditsFromMandatory': 'נקודות זכות מקורסי חובה',
    'minCreditsFromAnySelectiveList': 'נקודות זכות מקורסי בחירה',
    'malag_pattern': 'קורסי מל"ג (הומניטריים)',
    'sports_pattern': 'קורסי ספורט',
  };

  // Get existing rule types to avoid duplicates
  const existingRuleTypes = new Set(editableRules.map(rule => {
    // Map pattern rules back to their special types for duplicate checking
    if (rule.type === 'minCreditsFromIdPattern') {
      if (rule.description.includes('מל"ג') || rule.description.includes('הומניטריים')) {
        return 'malag_pattern';
      } else if (rule.description.includes('ספורט')) {
        return 'sports_pattern';
      }
    }
    return rule.type;
  }));
  
  // Filter out single-instance rules that already exist
  const availableRuleTypes = availableConsolidatedRuleTypes.filter(type => {
    if (type === 'total_credits' || type === 'minCreditsFromMandatory' || type === 'minCreditsFromAnySelectiveList') {
      return !existingRuleTypes.has(type);
    }
    return !existingRuleTypes.has(type);
  });

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="עריכת כללי התקדמות מאוחדים"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit}>
        {/* Add New Rule Section */}
        <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-x-3">
            <label htmlFor="newRuleType" className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
              הוסף כלל חדש:
            </label>
            <select
              id="newRuleType"
              value={selectedNewRuleType}
              onChange={(e) => setSelectedNewRuleType(e.target.value)}
              className={`flex-grow ${commonInputClass}`}
              disabled={availableRuleTypes.length === 0}
            >
              <option value="">
                {availableRuleTypes.length === 0 ? 'כל סוגי הכללים קיימים כבר' : 'בחר סוג כלל'}
              </option>
              {availableRuleTypes.map(ruleType => (
                <option key={ruleType} value={ruleType}>
                  {ruleTypeLabels[ruleType] || ruleType}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddRule}
              disabled={!selectedNewRuleType}
              className="px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              הוסף
            </button>
          </div>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto p-1">
          {editableRules.map((rule) => {
            const isEditable = editableRuleTypes.includes(rule.type);
            return (
              <div key={rule.id} className="p-3 border border-slate-200 dark:border-slate-700 rounded-md">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-grow">
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
                  <button
                    type="button"
                    onClick={() => handleRemoveRule(rule.id)}
                    className="ml-2 p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 focus:outline-none"
                    title="מחק כלל"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
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
          {editableRules.length === 0 && (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <p>אין כללים כרגע. הוסף כלל חדש למעלה.</p>
            </div>
          )}
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