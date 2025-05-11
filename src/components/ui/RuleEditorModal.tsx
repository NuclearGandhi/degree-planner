import React, { useState, useEffect } from 'react';
// import { DegreeRule, RawCourseData } from '../../types/data'; // RawCourseData removed
import { DegreeRule } from '../../types/data';
import BaseModal from './BaseModal';
import CustomNumberInput from './CustomNumberInput';

// For minCoursesFromMultipleLists items during editing
interface EditableListItem {
  id: string; // Temporary ID for React key
  listName: string;
  min: number;
}

interface RuleEditorModalProps {
  isOpen: boolean;
  rule: DegreeRule | null;
  onClose: () => void;
  onSave: (updatedRule: DegreeRule) => void;
  availableCourseListNames: string[]; // New prop
}

const RuleEditorModal: React.FC<RuleEditorModalProps> = ({ 
  isOpen, 
  rule, 
  onClose, 
  onSave, 
  availableCourseListNames 
}) => {
  const [description, setDescription] = useState('');
  const [generalRequiredCredits, setGeneralRequiredCredits] = useState<string | number>('');
  const [minGradeValue, setMinGradeValue] = useState<string | number>('');
  const [selectedCourseListName, setSelectedCourseListName] = useState<string>('');
  const [listRuleNumericValue, setListRuleNumericValue] = useState<string | number>('');
  const [multiListItems, setMultiListItems] = useState<EditableListItem[]>([]);

  useEffect(() => {
    if (rule) {
      setDescription(rule.description || '');
      setGeneralRequiredCredits(rule.required_credits ?? rule.min ?? '');
      setMinGradeValue(rule.min_grade_value ?? '');
      setSelectedCourseListName(availableCourseListNames.length > 0 ? availableCourseListNames[0] : '');
      
      let initialListNumericValue: string | number = '';
      if (rule.type === 'credits_from_list') {
        initialListNumericValue = rule.required_credits ?? '';
      } else if (rule.type === 'minCoursesFromList') {
        initialListNumericValue = rule.min ?? '';
      }
      setListRuleNumericValue(initialListNumericValue);
      
      setMultiListItems([]); 

      if (rule.type === 'total_credits' || rule.type === 'minCredits' || rule.type === 'minCreditsFromMandatory' || rule.type === 'minCreditsFromAnySelectiveList') {
        setGeneralRequiredCredits(rule.required_credits ?? rule.min ?? '');
      } else if (rule.type === 'min_grade') {
        setMinGradeValue(rule.min_grade_value ?? '');
      } else if (rule.type === 'credits_from_list') {
        setSelectedCourseListName(rule.course_list_name || (availableCourseListNames.length > 0 ? availableCourseListNames[0] : ''));
        setListRuleNumericValue(rule.required_credits ?? '');
      } else if (rule.type === 'minCoursesFromList') {
        setSelectedCourseListName(rule.course_list_name || (availableCourseListNames.length > 0 ? availableCourseListNames[0] : ''));
        setListRuleNumericValue(rule.min ?? '');
      } else if (rule.type === 'minCoursesFromMultipleLists') {
        const initialMultiListItems = (rule.lists || []).map((item, index) => ({
          ...item,
          id: `item-${Date.now()}-${index}` 
        }));
        setMultiListItems(initialMultiListItems);
      }
    } else {
      setDescription('');
      setGeneralRequiredCredits('');
      setMinGradeValue('');
      setSelectedCourseListName(availableCourseListNames.length > 0 ? availableCourseListNames[0] : '');
      setListRuleNumericValue('');
      setMultiListItems([]);
    }
  }, [rule, availableCourseListNames, isOpen]);

  if (!rule) {
    if (isOpen) console.warn("RuleEditorModal: rule is null while modal is open.");
    return null;
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!rule) return;

    const updatedRule: DegreeRule = {
      ...rule, // Preserve other rule properties like id, type
      description,
    };

    // Helper to parse state values (string | number) to number | undefined
    const parseNumericState = (value: string | number): number | undefined => {
      if (value === '') return undefined;
      const num = parseFloat(String(value));
      return isNaN(num) ? undefined : num;
    };

    delete updatedRule.required_credits;
    delete updatedRule.min;
    delete updatedRule.min_grade_value;
    delete updatedRule.course_list_name;
    delete updatedRule.lists; // Clear lists before potentially re-adding

    if (rule.type === 'total_credits') {
      updatedRule.required_credits = parseNumericState(generalRequiredCredits);
    } else if (rule.type === 'minCredits' || rule.type === 'minCreditsFromMandatory' || rule.type === 'minCreditsFromAnySelectiveList') {
      updatedRule.min = parseNumericState(generalRequiredCredits);
    } else if (rule.type === 'min_grade') {
      updatedRule.min_grade_value = parseNumericState(minGradeValue);
    } else if (rule.type === 'credits_from_list') {
      updatedRule.course_list_name = selectedCourseListName;
      updatedRule.required_credits = parseNumericState(listRuleNumericValue);
    } else if (rule.type === 'minCoursesFromList') {
      updatedRule.course_list_name = selectedCourseListName;
      updatedRule.min = parseNumericState(listRuleNumericValue);
    } else if (rule.type === 'minCoursesFromMultipleLists') {
      // Convert EditableListItem back to the format expected by DegreeRule, removing temporary id
      updatedRule.lists = multiListItems.map(({ /* id, */ ...rest }) => rest);
    }
    // TODO: Add saving logic for other rule types

    onSave(updatedRule);
  };
  
  const commonInputClass = "mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-slate-900 dark:text-slate-50";

  // Handlers for multiListItems
  const handleAddMultiListItem = () => {
    // Determine list names already used in the current rule's multiListItems state
    const currentlyUsedListNamesInRule = new Set(multiListItems.map(item => item.listName));
    
    // Filter the globally available list names to find those not yet used in this specific rule
    const trulyAvailableListNamesForNewItem = availableCourseListNames.filter(
      name => !currentlyUsedListNamesInRule.has(name)
    );

    setMultiListItems(prev => [...prev, {
      id: `new-item-${Date.now()}`,
      // Default to the first truly available list for this new item, or empty if none are left
      listName: trulyAvailableListNamesForNewItem.length > 0 ? trulyAvailableListNamesForNewItem[0] : '', 
      min: 1 // Default min value
    }]);
  };

  const handleMultiListItemChange = (id: string, field: 'listName' | 'min', value: string | number) => {
    setMultiListItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: field === 'min' ? (value === '' ? 0 : parseFloat(String(value)) || 0) : String(value) } : item
    ));
  };

  const handleRemoveMultiListItem = (id: string) => {
    setMultiListItems(prev => prev.filter(item => item.id !== id));
  };

  return (
    <BaseModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="עריכת כלל" 
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="ruleDescription" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">תיאור הכלל</label>
          <input
            type="text"
            id="ruleDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={commonInputClass}
            required
          />
        </div>

        {(rule.type === 'total_credits' || rule.type === 'minCredits' || rule.type === 'minCreditsFromMandatory' || rule.type === 'minCreditsFromAnySelectiveList') && (
          <div className="mb-4">
            <label htmlFor="ruleNumericValueGeneral" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              ערך נדרש (נק"ז)
            </label>
            <CustomNumberInput
              id="ruleNumericValueGeneral"
              value={generalRequiredCredits}
              onChange={setGeneralRequiredCredits}
              className="w-full"
              inputClassName={commonInputClass.replace('mt-1', '').replace('rounded-md', '').trim()}
              min={0}
              step={0.5}
            />
          </div>
        )}

        {rule.type === 'min_grade' && (
          <div className="mb-4">
            <label htmlFor="minGradeValue" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">ציון מינימלי</label>
            <CustomNumberInput
              id="minGradeValue"
              value={minGradeValue}
              onChange={setMinGradeValue}
              className="w-full"
              inputClassName={commonInputClass.replace('mt-1', '').replace('rounded-md', '').trim()}
              min={0}
              max={100}
              step={1}
            />
          </div>
        )}

        {(rule.type === 'credits_from_list' || rule.type === 'minCoursesFromList') && (
          <>
            <div className="mb-4">
              <label htmlFor="ruleCourseListName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                שם רשימת הקורסים
              </label>
              <select
                id="ruleCourseListName"
                value={selectedCourseListName}
                onChange={(e) => setSelectedCourseListName(e.target.value)}
                className={commonInputClass}
                disabled={availableCourseListNames.length === 0}
              >
                {availableCourseListNames.length === 0 && <option value="">אין רשימות זמינות</option>}
                {availableCourseListNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label htmlFor="ruleNumericValueList" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mt-2">
                {rule.type === 'credits_from_list' ? 'נק"ז נדרשות מהרשימה' : 'מספר קורסים נדרש מהרשימה'}
              </label>
              <CustomNumberInput
                id="ruleNumericValueList"
                value={listRuleNumericValue}
                onChange={setListRuleNumericValue}
                className="w-full"
                inputClassName={commonInputClass.replace('mt-1', '').replace('rounded-md', '').trim()}
                min={0}
                step={rule.type === 'credits_from_list' ? 0.5 : 1}
              />
            </div>
          </>
        )}

        {/* minCoursesFromMultipleLists */}
        {rule.type === 'minCoursesFromMultipleLists' && (
          <div className="mb-4 space-y-3">
            <h4 className="text-md font-medium text-slate-700 dark:text-slate-300 mb-2">דרישות מרשימות מרובות:</h4>
            {multiListItems.map((item) => {
              // Get list names already selected by OTHER items in this rule
              const otherSelectedListNames = multiListItems
                .filter(otherItem => otherItem.id !== item.id)
                .map(otherItem => otherItem.listName);

              // Filter available list names for THIS item's dropdown
              const listNamesForThisDropdown = availableCourseListNames.filter(name => 
                name === item.listName || !otherSelectedListNames.includes(name)
              );

              return (
                <div key={item.id} className="p-3 border border-slate-200 dark:border-slate-600 rounded-md space-y-2">
                  <div>
                    <label htmlFor={`multiListSelect-${item.id}`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      בחר רשימה
                    </label>
                    <select 
                      id={`multiListSelect-${item.id}`}
                      value={item.listName}
                      onChange={(e) => handleMultiListItemChange(item.id, 'listName', e.target.value)}
                      className={`${commonInputClass} mb-1`}
                      disabled={listNamesForThisDropdown.length === 0 && !item.listName}
                    >
                      {listNamesForThisDropdown.length === 0 && !item.listName && <option value="">אין רשימות פנויות</option>}
                      {listNamesForThisDropdown.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`multiListMin-${item.id}`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      מספר קורסים מינימלי מהרשימה
                    </label>
                    <CustomNumberInput
                      id={`multiListMin-${item.id}`}
                      value={item.min}
                      onChange={(val) => handleMultiListItemChange(item.id, 'min', val)}
                      className="w-full"
                      inputClassName={commonInputClass.replace('mt-1', '').replace('rounded-md', '').trim()}
                      min={0}
                      step={1}
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={() => handleRemoveMultiListItem(item.id)}
                    className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    aria-label="הסר דרישת רשימה"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              );
            })}
            <button 
              type="button" 
              onClick={handleAddMultiListItem}
              className="mt-2 px-3 py-1.5 text-sm text-indigo-700 dark:text-indigo-300 border border-indigo-500 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/50 transition-colors"
              disabled={multiListItems.length >= availableCourseListNames.length}
            >
              הוסף דרישת רשימה +
            </button>
          </div>
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

/*
// We need RawCourseData for future course selection features within the modal
// For now, it's passed as a prop but not actively used in this initial version.
export interface RawCourseData {
  _id: string;
  name: string;
  english_name: string;
  credits: number;
  // ... other fields as defined in src/types/data.ts
  [key: string]: unknown;
}
*/ 