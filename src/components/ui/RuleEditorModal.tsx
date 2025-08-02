import React, { useState, useEffect } from 'react';
// import { DegreeRule, RawCourseData } from '../../types/data'; // RawCourseData removed
import { DegreeRule } from '../../types/data';
import BaseModal from './BaseModal';
import CustomNumberInput from './CustomNumberInput';

// For minCoursesFromMultipleLists items during editing
interface EditableListItem {
  id: string; // Temporary ID for React key
  listName: string;
  min?: number;
  minCredits?: number;
}

// For minCreditsFromSelectedLists items during editing
interface EditableCombinedRule {
  id: string; // Temporary ID for React key
  description: string;
  selectedLists: string[];
  requirementType: 'credits' | 'courses';
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
  
  // New state for minCreditsFromSelectedLists rule type
  const [combinedRules, setCombinedRules] = useState<EditableCombinedRule[]>([]);

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
      } else if (rule.type === 'minCreditsFromSelectedLists') {
        const initialCombinedRules = (rule.combinedRules || []).map((item, index) => ({
          ...item,
          id: `combined-${Date.now()}-${index}` 
        }));
        setCombinedRules(initialCombinedRules);
      }
    } else {
      setDescription('');
      setGeneralRequiredCredits('');
      setMinGradeValue('');
      setSelectedCourseListName(availableCourseListNames.length > 0 ? availableCourseListNames[0] : '');
      setListRuleNumericValue('');
      setMultiListItems([]);
      setCombinedRules([]);
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
    delete updatedRule.combinedRules; // Clear combinedRules before potentially re-adding

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
      updatedRule.lists = multiListItems.map((item) => {
        // Remove undefined values and temporary id to keep the rule clean
        const cleanItem: { listName: string; min?: number; minCredits?: number } = { listName: item.listName };
        if (item.min !== undefined) cleanItem.min = item.min;
        if (item.minCredits !== undefined) cleanItem.minCredits = item.minCredits;
        return cleanItem;
      });
    } else if (rule.type === 'minCreditsFromSelectedLists') {
      // Convert EditableCombinedRule back to the format expected by DegreeRule, removing temporary id
      updatedRule.combinedRules = combinedRules.map((item) => {
        // Remove undefined values and temporary id to keep the rule clean
        const cleanItem: { description: string; selectedLists: string[]; requirementType: 'credits' | 'courses'; min: number } = {
          description: item.description,
          selectedLists: item.selectedLists,
          requirementType: item.requirementType,
          min: item.min
        };
        return cleanItem;
      });
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
      min: 1, // Default min value
      minCredits: undefined
    }]);
  };

  const handleMultiListItemChange = (id: string, field: 'listName' | 'min' | 'minCredits', value: string | number) => {
    setMultiListItems(prev => prev.map(item => 
      item.id === id ? { 
        ...item, 
        [field]: field === 'listName' ? String(value) : (value === '' ? undefined : parseFloat(String(value)) || undefined)
      } : item
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
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      סוג הדרישה
                    </label>
                    <div className="flex gap-4 mb-2">
                      <label className="flex items-center cursor-pointer">
                        <div className="relative ml-2">
                          <input
                            type="radio"
                            name={`requirementType-${item.id}`}
                            checked={item.min !== undefined && item.minCredits === undefined}
                            onChange={() => {
                              handleMultiListItemChange(item.id, 'min', item.min ?? 1);
                              handleMultiListItemChange(item.id, 'minCredits', '');
                            }}
                            className="sr-only"
                          />
                          <div className={`w-4 h-4 rounded-full border-2 transition-colors flex items-center justify-center ${
                            item.min !== undefined && item.minCredits === undefined
                              ? 'border-indigo-600 bg-indigo-600' 
                              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                          }`}>
                            {item.min !== undefined && item.minCredits === undefined && (
                              <div className="w-2 h-2 rounded-full bg-white"></div>
                            )}
                          </div>
                        </div>
                        <span className="text-sm text-slate-700 dark:text-slate-300">מספר קורסים</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <div className="relative ml-2">
                          <input
                            type="radio"
                            name={`requirementType-${item.id}`}
                            checked={item.minCredits !== undefined && item.min === undefined}
                            onChange={() => {
                              handleMultiListItemChange(item.id, 'minCredits', item.minCredits ?? 6);
                              handleMultiListItemChange(item.id, 'min', '');
                            }}
                            className="sr-only"
                          />
                          <div className={`w-4 h-4 rounded-full border-2 transition-colors flex items-center justify-center ${
                            item.minCredits !== undefined && item.min === undefined
                              ? 'border-indigo-600 bg-indigo-600' 
                              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                          }`}>
                            {item.minCredits !== undefined && item.min === undefined && (
                              <div className="w-2 h-2 rounded-full bg-white"></div>
                            )}
                          </div>
                        </div>
                        <span className="text-sm text-slate-700 dark:text-slate-300">נקודות זכות</span>
                      </label>
                    </div>
                    
                    {item.min !== undefined && item.minCredits === undefined && (
                      <div>
                        <label htmlFor={`multiListMin-${item.id}`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          מספר קורסים מינימלי מהרשימה
                        </label>
                        <CustomNumberInput
                          id={`multiListMin-${item.id}`}
                          value={item.min ?? 1}
                          onChange={(val) => handleMultiListItemChange(item.id, 'min', val)}
                          className="w-full"
                          inputClassName={commonInputClass.replace('mt-1', '').replace('rounded-md', '').trim()}
                          min={0}
                          step={1}
                        />
                      </div>
                    )}
                    
                    {item.minCredits !== undefined && item.min === undefined && (
                      <div>
                        <label htmlFor={`multiListMinCredits-${item.id}`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          נקודות זכות מינימליות מהרשימה
                        </label>
                        <CustomNumberInput
                          id={`multiListMinCredits-${item.id}`}
                          value={item.minCredits ?? 6}
                          onChange={(val) => handleMultiListItemChange(item.id, 'minCredits', val)}
                          className="w-full"
                          inputClassName={commonInputClass.replace('mt-1', '').replace('rounded-md', '').trim()}
                          min={0}
                          step={0.5}
                        />
                      </div>
                    )}
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

        {/* minCreditsFromSelectedLists */}
        {rule.type === 'minCreditsFromSelectedLists' && (
          <div className="mb-4 space-y-3">
            <h4 className="text-md font-medium text-slate-700 dark:text-slate-300 mb-2">דרישות מסכום רשימות:</h4>
            
            {combinedRules.map((combinedRule) => {
              return (
                <div key={combinedRule.id} className="p-3 border border-slate-200 dark:border-slate-600 rounded-md space-y-2">
                  <div>
                    <label htmlFor={`combinedRuleDesc-${combinedRule.id}`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      תיאור הדרישה
                    </label>
                    <input
                      id={`combinedRuleDesc-${combinedRule.id}`}
                      type="text"
                      value={combinedRule.description}
                      onChange={(e) => {
                        setCombinedRules(prev => prev.map(item => 
                          item.id === combinedRule.id ? { ...item, description: e.target.value } : item
                        ));
                      }}
                      className={commonInputClass}
                      placeholder="תיאור הדרישה"
                    />
                  </div>
                  
                  {/* Requirement Type Selection */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      סוג הדרישה
                    </label>
                    <div className="flex gap-4 mb-2">
                      <label className="flex items-center cursor-pointer">
                        <div className="relative ml-2">
                          <input
                            type="radio"
                            name={`reqType-${combinedRule.id}`}
                            checked={combinedRule.requirementType === 'credits'}
                            onChange={() => {
                              setCombinedRules(prev => prev.map(item => 
                                item.id === combinedRule.id ? { ...item, requirementType: 'credits' } : item
                              ));
                            }}
                            className="sr-only"
                          />
                          <div className={`w-4 h-4 rounded-full border-2 transition-colors flex items-center justify-center ${
                            combinedRule.requirementType === 'credits'
                              ? 'border-indigo-600 bg-indigo-600' 
                              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                          }`}>
                            {combinedRule.requirementType === 'credits' && (
                              <div className="w-2 h-2 rounded-full bg-white"></div>
                            )}
                          </div>
                        </div>
                        <span className="text-sm text-slate-700 dark:text-slate-300">נקודות זכות</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <div className="relative ml-2">
                          <input
                            type="radio"
                            name={`reqType-${combinedRule.id}`}
                            checked={combinedRule.requirementType === 'courses'}
                            onChange={() => {
                              setCombinedRules(prev => prev.map(item => 
                                item.id === combinedRule.id ? { ...item, requirementType: 'courses' } : item
                              ));
                            }}
                            className="sr-only"
                          />
                          <div className={`w-4 h-4 rounded-full border-2 transition-colors flex items-center justify-center ${
                            combinedRule.requirementType === 'courses'
                              ? 'border-indigo-600 bg-indigo-600' 
                              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                          }`}>
                            {combinedRule.requirementType === 'courses' && (
                              <div className="w-2 h-2 rounded-full bg-white"></div>
                            )}
                          </div>
                        </div>
                        <span className="text-sm text-slate-700 dark:text-slate-300">מספר קורסים</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Minimum Value Input */}
                  <div>
                    <label htmlFor={`combinedRuleMin-${combinedRule.id}`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {combinedRule.requirementType === 'credits' ? 'מינימום נקודות זכות' : 'מינימום קורסים'}
                    </label>
                    <CustomNumberInput
                      id={`combinedRuleMin-${combinedRule.id}`}
                      value={combinedRule.min}
                      onChange={(val) => {
                        setCombinedRules(prev => prev.map(item => 
                          item.id === combinedRule.id ? { ...item, min: typeof val === 'string' ? parseFloat(val) || 0 : val } : item
                        ));
                      }}
                      className="w-full"
                      inputClassName={commonInputClass.replace('mt-1', '').replace('rounded-md', '').trim()}
                      min={0}
                      step={combinedRule.requirementType === 'credits' ? 0.5 : 1}
                    />
                  </div>
                  
                  {/* List Selection */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      בחר רשימות לחיבור
                    </label>
                    <div className="space-y-1 max-h-32 overflow-y-auto border border-slate-300 dark:border-slate-600 rounded-md p-2">
                      {availableCourseListNames.map(listName => (
                        <label key={listName} className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={combinedRule.selectedLists.includes(listName)}
                            onChange={(e) => {
                              setCombinedRules(prev => prev.map(item => 
                                item.id === combinedRule.id ? {
                                  ...item,
                                  selectedLists: e.target.checked 
                                    ? [...item.selectedLists, listName]
                                    : item.selectedLists.filter(name => name !== listName)
                                } : item
                              ));
                            }}
                            className="ml-2 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300">{listName}</span>
                        </label>
                      ))}
                    </div>
                    {combinedRule.selectedLists.length > 0 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        נבחרו {combinedRule.selectedLists.length} רשימות: {combinedRule.selectedLists.join(', ')}
                      </p>
                    )}
                  </div>
                  
                  <button 
                    type="button" 
                    onClick={() => {
                      setCombinedRules(prev => prev.filter(item => item.id !== combinedRule.id));
                    }}
                    className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    aria-label="הסר דרישה מרוכבת"
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
              onClick={() => {
                setCombinedRules(prev => [...prev, {
                  id: `new-combined-${Date.now()}`,
                  description: '',
                  selectedLists: [],
                  requirementType: 'credits',
                  min: 0
                }]);
              }}
              className="mt-2 px-3 py-1.5 text-sm text-indigo-700 dark:text-indigo-300 border border-indigo-500 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/50 transition-colors"
            >
              הוסף דרישה מרוכבת +
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