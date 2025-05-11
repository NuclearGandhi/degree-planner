import React from 'react';
import { NodeProps, Node as RFNode } from '@xyflow/react'; // No Handles needed for rule nodes if they are informational
import { RuleNodeData } from '../../../types/flow'; // Adjusted import path, removed RuleNodeData import

const RuleNode: React.FC<NodeProps<RFNode<RuleNodeData, 'rule'>>> = ({ data }) => {
  const isExemptionNode = data.id === 'classification_courses_rule'; // Check if it's the exemptions node

  const isSatisfied = data.isSatisfied;
  const baseStatusColor = isSatisfied 
    ? '!bg-green-100 dark:!bg-green-800 !border-green-600 dark:!border-green-700'
    : '!bg-amber-100 dark:!bg-amber-800 !border-amber-500 dark:!border-amber-700';
  const baseTextColor = isSatisfied 
    ? '!text-green-700 dark:!text-green-200' 
    : '!text-amber-700 dark:!text-amber-200';

  // Override for exemption node
  const statusColor = isExemptionNode 
    ? '!bg-slate-100 dark:!bg-slate-700 !border-slate-400 dark:!border-slate-500' 
    : baseStatusColor;
  const textColor = isExemptionNode 
    ? '!text-slate-700 dark:!text-slate-200' 
    : baseTextColor;
  
  const description = data.description;
  const currentProgress = data.currentProgress; // Overall text progress (e.g., joined string)
  const listDetails = data.listProgressDetails;
  const consolidatedRules = data.consolidatedRules;
  const classificationCourseDetails = data.classificationCourseDetails;
  const onClassificationToggle = data.onClassificationToggle;

  // Check for single progress bar for non-consolidated rules
  const showSingleProgressBar = !consolidatedRules && typeof data.currentValue === 'number' && typeof data.requiredValue === 'number' && data.requiredValue > 0;
  // Ensure values are treated as numbers for calculation, defaulting to 0 if check failed (though showProgressBar would be false)
  const currentValNum = typeof data.currentValue === 'number' ? data.currentValue : 0;
  const requiredValNum = typeof data.requiredValue === 'number' && data.requiredValue > 0 ? data.requiredValue : 1; // Avoid division by zero
  const singleProgressPercent = showSingleProgressBar ? Math.min(100, Math.max(0, (currentValNum / requiredValNum) * 100)) : 0;

  const handleEdit = () => {
    if (data.onEditRule) {
      data.onEditRule(data.id);
    }
  };

  const handleDelete = () => {
    if (data.onDeleteRule) {
      // Optional: Add a confirmation dialog here
      data.onDeleteRule(data.id);
    }
  };

  return (
    <div dir="rtl" className={`rule-node p-3 border-r-4 rounded-md shadow-lg w-[340px] min-h-[140px] ${statusColor} flex flex-col justify-between`}> {/* Width increased to 340px */}
      <div> {/* Added a wrapper div for main content */}
        {/* Title: Smaller for consolidated, larger for single/multi-list */}
        <div className={`font-semibold mb-2 ${consolidatedRules && consolidatedRules.length > 0 ? 'text-base' : 'text-lg'} ${textColor}`}>{description}</div>
        
        {/* Display consolidated rules if they exist */}
        {consolidatedRules && consolidatedRules.length > 0 && (
          <div className="space-y-2 mt-1"> {/* Reduced space-y-3 to space-y-2 as rows are more compact */}
            {consolidatedRules.map((rule) => {
              const subRuleShowBar = typeof rule.currentValue === 'number' && 
                                   typeof rule.requiredValue === 'number' && 
                                   rule.requiredValue > 0;
              
              const subRulePercent = subRuleShowBar 
                ? Math.min(100, Math.max(0, (rule.currentValue! / rule.requiredValue!) * 100)) 
                : 0;

              return (
                // Each sub-rule is a flex row, items centered vertically, space between groups
                <div key={rule.id} className={`py-1.5 border-b border-gray-200 dark:border-gray-700 last:border-b-0 text-sm`}>
                  <div className="flex items-center justify-between">
                    {/* Left part: Description and Progress Text */}
                    <div className="flex-grow min-w-0 mr-3">
                      <p className={`font-medium truncate ${rule.isSatisfied ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>{rule.description}</p>
                      <p className={`text-xs ${rule.isSatisfied ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>{rule.currentProgress}</p>
                    </div>

                    {/* Middle part: Progress Bar */}
                    {subRuleShowBar && (
                      <div className="w-1/3 flex-shrink-0 bg-gray-200 rounded-full h-2.5 dark:bg-gray-600 mx-2">
                        <div 
                          className={`h-2.5 rounded-full ${rule.isSatisfied ? 'bg-green-500' : 'bg-amber-500'}`}
                          style={{ width: `${subRulePercent}%` }}
                        ></div>
                      </div>
                    )}
                    {!subRuleShowBar && <div className="w-1/3 flex-shrink-0 h-2.5 mx-2"></div>} {/* Placeholder */}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Display classification course checkboxes (only if not consolidated) */}
        {!consolidatedRules && classificationCourseDetails && classificationCourseDetails.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {classificationCourseDetails.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-1 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                <div className="flex items-center">
                  <input
                    id={`classification-${item.id}`}
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => onClassificationToggle?.(item.id)}
                    className="ml-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-indigo-600"
                  />
                  <label 
                    htmlFor={`classification-${item.id}`} 
                    className={`text-sm font-medium ${isExemptionNode && item.id === 'miluim_exemption' ? textColor : (item.checked ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300') }`}
                  >
                    {item.name}
                  </label>
                </div>
                {item.creditInput && (
                  <div className="flex items-center ml-4">
                    <input
                      type="number"
                      id={`credits-${item.id}`}
                      value={item.credits ?? 0} // Always show 0 if undefined or null
                      disabled={!item.checked} // Disabled if not checked
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        data.onClassificationCreditsChange?.(item.id, isNaN(value) ? 0 : value);
                      }}
                      min={0}
                      max={item.creditInput.max}
                      step={item.creditInput.step}
                      className={`w-20 h-8 text-sm p-1 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:ring-indigo-500 focus:border-indigo-500 ${!item.checked ? 'disabled:opacity-50 disabled:cursor-not-allowed' : ''}`}
                      aria-label={`Credits for ${item.name}`}
                    />
                    <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">נק' ({item.creditInput.max} מקס')</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Display single progress bar (only if not consolidated) */}
        {!consolidatedRules && showSingleProgressBar && (
          <>
            <div className={`text-base mb-1 ${textColor}`}>התקדמות: {currentProgress}</div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 my-1">
              <div 
                className={`h-2.5 rounded-full ${isSatisfied ? 'bg-green-500' : 'bg-amber-500'}`}
                style={{ width: `${singleProgressPercent}%` }}
              ></div>
            </div>
          </>
        )}

        {/* Display list details (only if not consolidated) - for 'minCoursesFromMultipleLists' type */}
        {!consolidatedRules && listDetails && listDetails.length > 0 && (
          <div className="mt-1 space-y-1.5">
            {listDetails.map((item, index) => {
              const itemShowBar = typeof item.currentValue === 'number' && typeof item.requiredValue === 'number' && item.requiredValue > 0;
              const itemCurrentVal = itemShowBar ? item.currentValue : 0;
              const itemRequiredVal = itemShowBar ? item.requiredValue : 1;
              const itemPercent = itemShowBar ? Math.min(100, Math.max(0, (itemCurrentVal / itemRequiredVal) * 100)) : 0;
              
              return (
                <div key={index} className={`flex items-center justify-between py-1 border-b border-gray-200 dark:border-gray-700 last:border-b-0`}>
                  {/* Left part: List Name and Progress Text */}
                  <div className="flex-grow min-w-0 mr-3">
                    <p className={`font-medium text-sm truncate ${item.isSatisfied ? 'text-green-700 dark:text-green-300' : textColor}`}>{item.listName}</p>
                    <p className={`text-xs ${item.isSatisfied ? 'text-green-600 dark:text-green-400' : textColor}`}>{item.currentValue}/{item.requiredValue}</p>
                  </div>

                  {/* Right part: Progress Bar */}
                  {itemShowBar && (
                    <div className="w-1/3 flex-shrink-0 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                      <div 
                        className={`h-2 rounded-full ${item.isSatisfied ? 'bg-green-500' : 'bg-amber-500'}`}
                        style={{ width: `${itemPercent}%` }}
                      ></div>
                    </div>
                  )}
                  {!itemShowBar && <div className="w-1/3 flex-shrink-0 h-2"></div>} {/* Placeholder */}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit and Delete Buttons - Show for non-consolidated OR the consolidated node itself */}
      {( (consolidatedRules && consolidatedRules.length > 0 && data.onEditRule) || 
        (!consolidatedRules && (data.onEditRule || data.onDeleteRule)) 
      ) && (
        <div className="flex justify-end space-x-2 mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          {/* Edit button for consolidated node OR regular edit for single node */}
          {data.onEditRule && (
            <button 
              onClick={handleEdit} // Calls data.onEditRule(data.id) - which is the main node id (e.g. 'consolidated-rules-node')
              className="text-sm px-2.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded"
              aria-label={consolidatedRules && consolidatedRules.length > 0 ? "ערוך כללי התקדמות" : "Edit rule"}
            >
              {consolidatedRules && consolidatedRules.length > 0 ? "ערוך כללי התקדמות" : "ערוך"}
            </button>
          )}
          {/* Delete button ONLY for non-consolidated nodes */}
          {!consolidatedRules && data.onDeleteRule && (
            <button 
              onClick={handleDelete}
              className="text-sm px-2.5 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded"
              aria-label="Delete rule"
            >
              מחק
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default RuleNode; 