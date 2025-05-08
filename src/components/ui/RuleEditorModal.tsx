import React, { useState, useEffect } from 'react';
import { DegreeRule, RawCourseData } from '../../types/data';
import BaseModal from './BaseModal';

interface RuleEditorModalProps {
  isOpen: boolean;
  rule: DegreeRule | null;
  onClose: () => void;
  onSave: (updatedRule: DegreeRule) => void;
  allCourses: RawCourseData[]; // For potential future use with course selection
}

const RuleEditorModal: React.FC<RuleEditorModalProps> = ({ isOpen, rule, onClose, onSave, allCourses }) => {
  const [description, setDescription] = useState('');
  const [requiredCredits, setRequiredCredits] = useState<number | undefined>(undefined);
  const [minGrade, setMinGrade] = useState<number | undefined>(undefined);
  // TODO: Add state for other rule types (e.g., course lists for 'credits_from_list')

  useEffect(() => {
    if (rule) {
      setDescription(rule.description || '');
      if (rule.type === 'total_credits' || rule.type === 'minCredits') {
        setRequiredCredits(rule.required_credits ?? rule.min ?? undefined);
      } else {
        setRequiredCredits(undefined);
      }
      if (rule.type === 'min_grade') {
        setMinGrade(rule.min_grade_value ?? undefined);
      } else {
        setMinGrade(undefined);
      }
    } else {
      // Reset fields when rule is null (modal closed or new rule)
      setDescription('');
      setRequiredCredits(undefined);
      setMinGrade(undefined);
    }
  }, [rule]);

  if (!rule) {
    if (isOpen) console.warn("RuleEditorModal: rule is null while modal is open.");
    return null;
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!rule) return;

    const updatedRule: DegreeRule = {
      ...rule,
      description,
    };

    if (rule.type === 'total_credits' || rule.type === 'minCredits') {
      updatedRule.required_credits = requiredCredits; // Or handle 'min' based on original structure
      if (rule.type === 'minCredits') updatedRule.min = requiredCredits;
    }

    if (rule.type === 'min_grade') {
      updatedRule.min_grade_value = minGrade;
    }

    onSave(updatedRule);
  };

  return (
    <BaseModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="עריכת כלל" 
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="ruleDescription" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">תיאור הכלל</label>
          <input
            type="text"
            id="ruleDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-slate-900 dark:text-slate-50"
            required
          />
        </div>

        {(rule.type === 'total_credits' || rule.type === 'minCredits') && (
          <div className="mb-4">
            <label htmlFor="requiredCredits" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {rule.type === 'minCredits' ? 'מינימום נ"ז' : 'סה"כ נ"ז נדרשות'}
            </label>
            <input
              type="number"
              id="requiredCredits"
              value={requiredCredits ?? ''}
              onChange={(e) => setRequiredCredits(e.target.value ? parseInt(e.target.value, 10) : undefined)}
              className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-slate-900 dark:text-slate-50"
              min="0"
            />
          </div>
        )}

        {rule.type === 'min_grade' && (
          <div className="mb-4">
            <label htmlFor="minGrade" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">ציון מינימלי</label>
            <input
              type="number"
              id="minGrade"
              value={minGrade ?? ''}
              onChange={(e) => setMinGrade(e.target.value ? parseInt(e.target.value, 10) : undefined)}
              className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-slate-900 dark:text-slate-50"
              min="0"
              max="100"
            />
          </div>
        )}
        
        {/* Placeholder for other rule types */}
        {!(rule.type === 'total_credits' || rule.type === 'minCredits' || rule.type === 'min_grade') && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            כרגע אין אפשרות לערוך פרמטרים נוספים עבור סוג כלל זה ({rule.type}).
          </p>
        )}

        <div className="flex justify-end gap-x-2 mt-6">
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
            שמור שינויים
          </button>
        </div>
      </form>
    </BaseModal>
  );
};

export default RuleEditorModal;

// We need RawCourseData for future course selection features within the modal
// For now, it's passed as a prop but not actively used in this initial version.
/*
export interface RawCourseData {
  _id: string;
  name: string;
  english_name: string;
  credits: number;
  // ... other fields as defined in src/types/data.ts
  [key: string]: unknown;
}
*/ 