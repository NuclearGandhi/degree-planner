import React, { useState, useEffect } from 'react';
import { NodeProps, Node as RFNode } from '@xyflow/react'; // No Handles needed for rule nodes if they are informational
import { RuleNodeData } from '../../../types/flow'; // Adjusted import path, removed RuleNodeData import
import CustomNumberInput from '../../ui/CustomNumberInput'; // Added import
import ProgressBarLegend from '../../ui/ProgressBarLegend'; // Import the legend component

// New sub-component for each classification item row
interface ClassificationItemRowProps {
  item: NonNullable<RuleNodeData['classificationCourseDetails']>[number];
  isExemptionNode: boolean; // To pass down for styling or specific logic if needed
  textColor: string; // For label styling
  onClassificationToggle?: (courseId: string, isSelected: boolean) => void;
  onClassificationCreditsChange?: (courseId: string, credits: number) => void;
}

const ClassificationItemRow: React.FC<ClassificationItemRowProps> = ({
  item,
  isExemptionNode,
  textColor,
  onClassificationToggle,
  onClassificationCreditsChange,
}) => {
  const [localCredits, setLocalCredits] = useState<number | string>(item.credits ?? 0);

  useEffect(() => {
    setLocalCredits(item.credits ?? 0);
  }, [item.credits]);

  // New handler for CustomNumberInput
  const handleCreditsInputChange = (newValue: number | string) => {
    setLocalCredits(newValue); // Update local state immediately for responsiveness

    let numericValueToPropagate: number;
    if (typeof newValue === 'string') {
      if (newValue === '') {
        numericValueToPropagate = 0; // Or handle as undefined/error if empty is not allowed
      } else {
        numericValueToPropagate = parseFloat(newValue);
        if (isNaN(numericValueToPropagate)) {
          numericValueToPropagate = 0; // Default if somehow unparseable despite CustomInput's checks
        }
      }
    } else {
      numericValueToPropagate = newValue;
    }

    // Clamp and ensure it's a valid number before propagating
    numericValueToPropagate = Math.max(0, numericValueToPropagate);
    if (item.creditInput?.max !== undefined) {
      numericValueToPropagate = Math.min(item.creditInput.max, numericValueToPropagate);
    }

    // Only call the callback if the value results in a change
    // (item.credits is the original prop value, numericValueToPropagate is the processed new value)
    if (numericValueToPropagate !== item.credits) {
        onClassificationCreditsChange?.(item.id, numericValueToPropagate);
    }
  };

  return (
    <div key={item.id} className="flex items-center justify-between py-1 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <div className="flex items-center">
        <input
          id={`classification-${item.id}`}
          type="checkbox"
          checked={item.checked}
          onChange={(e) => onClassificationToggle?.(item.id, e.target.checked)}
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
          <CustomNumberInput
            id={`credits-${item.id}`}
            value={localCredits}
            onChange={handleCreditsInputChange}
            min={0}
            max={item.creditInput.max}
            step={item.creditInput.step}
            disabled={!item.checked}
            className={`w-28 h-8 ${!item.checked ? 'opacity-50 cursor-not-allowed' : ''}`}
            inputClassName="text-sm p-1"
            buttonClassName="text-sm"
            placeholder="נק" 
          />
          <span className="mr-1 text-xs text-gray-500 dark:text-gray-400">{`נק' (${item.creditInput.max} מקס')`}</span>
        </div>
      )}
    </div>
  );
};

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
  const onClassificationCreditsChange = data.onClassificationCreditsChange; // Pass this down

  // Updated conditions for showing progress bars based on new values
  const showProgressBar = 
    !consolidatedRules && 
    typeof data.currentValueDone === 'number' &&
    typeof data.currentValuePlanned === 'number' &&
    typeof data.requiredValue === 'number' && 
    data.requiredValue > 0;

  // Calculate percentages for the three-state progress bar
  const requiredValNum = showProgressBar ? data.requiredValue! : 1; // Avoid division by zero if not shown
  const doneValNum = showProgressBar ? data.currentValueDone! : 0;
  const plannedValNum = showProgressBar ? data.currentValuePlanned! : 0;

  const percentDone = showProgressBar ? Math.min(100, Math.max(0, (doneValNum / requiredValNum) * 100)) : 0;
  // Percentage for the part that is planned but not yet done
  const percentPlannedNotDone = showProgressBar ? Math.min(100 - percentDone, Math.max(0, ((plannedValNum - doneValNum) / requiredValNum) * 100)) : 0;

  return (
    <div dir="rtl" className={`rule-node p-3 border-r-4 rounded-md shadow-lg w-[340px] min-h-[140px] ${statusColor} flex flex-col justify-between`}> {/* Width increased to 340px */}
      <div> {/* Added a wrapper div for main content */}
        {/* Title Section: Use flex, justify-end for RTL alignment */}
        <div className="flex items-center justify mb-2">
          {/* Title: Smaller for consolidated, larger for single/multi-list */}
          <div className={`font-semibold ${consolidatedRules && consolidatedRules.length > 0 ? 'text-base' : 'text-lg'} ${textColor}`}>{description}</div>
          {/* Render Legend ONLY for consolidated rules node, add margin */}
          {consolidatedRules && consolidatedRules.length > 0 && (
            <div className="mr-4"> {/* Added margin for spacing */} 
              <ProgressBarLegend />
            </div>
          )}
        </div>
        
        {/* Display consolidated rules if they exist */}
        {consolidatedRules && consolidatedRules.length > 0 && (
          <div className="space-y-2 mt-1"> {/* Reduced space-y-3 to space-y-2 as rows are more compact */}
            {consolidatedRules.map((rule) => {
              // Updated conditions for sub-rule progress bar
              const subRuleShowBar = 
                typeof rule.currentValueDone === 'number' &&
                typeof rule.currentValuePlanned === 'number' &&
                typeof rule.requiredValue === 'number' && 
                rule.requiredValue > 0;
              
              const subReqValNum = subRuleShowBar ? rule.requiredValue! : 1;
              const subDoneValNum = subRuleShowBar ? rule.currentValueDone! : 0;
              const subPlannedValNum = subRuleShowBar ? rule.currentValuePlanned! : 0;

              const subPercentDone = subRuleShowBar 
                ? Math.min(100, Math.max(0, (subDoneValNum / subReqValNum) * 100)) 
                : 0;
              const subPercentPlannedNotDone = subRuleShowBar
                ? Math.min(100 - subPercentDone, Math.max(0, ((subPlannedValNum - subDoneValNum) / subReqValNum) * 100))
                : 0;

              // Determine dynamic classes for rounding (RTL)
              const greenRoundedClass = subPercentDone >= 99.9 && subPercentPlannedNotDone < 0.1 ? 'rounded-full' : 'rounded-r-full';
              const yellowRoundedClass = subPercentPlannedNotDone > 0.1 ? 'rounded-l-full' : '';

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
                      <div className="w-1/3 flex-shrink-0 bg-gray-300 dark:bg-gray-600 rounded-full h-2.5 relative mx-2 overflow-hidden">
                        {/* Done Part (RTL: starts from right) */}
                        <div 
                          className={`absolute top-0 right-0 h-2.5 bg-green-500 dark:bg-green-600 ${greenRoundedClass}`}
                          style={{ width: `${subPercentDone}%`, zIndex: 3 }}
                        ></div>
                        {/* Planned but not Done Part (RTL: extends left from Done part) */}
                        {subPercentPlannedNotDone > 0.1 && (
                          <div 
                            className={`absolute top-0 h-2.5 bg-yellow-400 dark:bg-yellow-500 ${yellowRoundedClass}`}
                            style={{
                              width: `${subPercentPlannedNotDone}%`,
                              right: `${subPercentDone}%`, // Position from right edge of green bar
                              zIndex: 2,
                            }}
                          ></div>
                        )}
                        {/* {(subPercentDone === 0 && subPercentPlannedNotDone === 0) && 
                          <div className="h-2.5 rounded-full"></div>} */}
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
              <ClassificationItemRow
                key={item.id} // Ensure key is on the component instance
                item={item}
                isExemptionNode={isExemptionNode}
                textColor={textColor}
                onClassificationToggle={onClassificationToggle}
                onClassificationCreditsChange={onClassificationCreditsChange}
              />
            ))}
          </div>
        )}

        {/* Display single progress bar (only if not consolidated) */}
        {/* For minCoursesFromMultipleLists, this will now show the AGGREGATE progress */}
        {!consolidatedRules && showProgressBar && (
          <>
            <div className={`text-base mb-1 ${textColor}`}>התקדמות: {currentProgress}</div>
            <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-full h-3.5 relative overflow-hidden"> {/* Increased height to h-3.5 */}
              {/* Done Part (RTL: starts from right) */}
              <div 
                className={`absolute top-0 right-0 h-3.5 bg-green-500 dark:bg-green-600 ${percentDone >= 99.9 && percentPlannedNotDone < 0.1 ? 'rounded-full' : 'rounded-r-full'}`}
                style={{ width: `${percentDone}%`, zIndex: 3 }}
              ></div>
              {/* Planned but not Done Part (RTL: extends left from Done part) */}
              {percentPlannedNotDone > 0.1 && (
                <div 
                  className={`absolute top-0 h-3.5 bg-yellow-400 dark:bg-yellow-500 ${percentPlannedNotDone > 0.1 ? 'rounded-l-full' : ''}`}
                  style={{
                    width: `${percentPlannedNotDone}%`,
                    right: `${percentDone}%`, // Position from right edge of green bar
                    zIndex: 2,
                  }}
                ></div>
              )}
              {/* {(percentDone === 0 && percentPlannedNotDone === 0) && 
                <div className="bg-gray-300 dark:bg-gray-600 h-3.5 rounded-full"></div>} */}
            </div>
          </>
        )}

        {/* Display list details for minCoursesFromMultipleLists (below the aggregate bar) or for other types if they have lists */}
        {listDetails && listDetails.length > 0 && (
          <div className={`mt-2 space-y-0.5 ${showProgressBar || (!consolidatedRules && currentProgress) ? 'pt-2' : ''}`}> {/* Removed top border class */}
            {listDetails.map((detail) => {
              const detailShowBar = 
                typeof detail.currentValueDone === 'number' &&
                typeof detail.currentValuePlanned === 'number' &&
                typeof detail.requiredValue === 'number' &&
                detail.requiredValue > 0;
              
              const detailReqValNum = detailShowBar ? detail.requiredValue! : 1;
              const detailDoneValNum = detailShowBar ? detail.currentValueDone! : 0;
              const detailPlannedValNum = detailShowBar ? detail.currentValuePlanned! : 0;

              const detailPercentDone = detailShowBar 
                ? Math.min(100, Math.max(0, (detailDoneValNum / detailReqValNum) * 100))
                : 0;
              const detailPercentPlannedNotDone = detailShowBar
                ? Math.min(100 - detailPercentDone, Math.max(0, ((detailPlannedValNum - detailDoneValNum) / detailReqValNum) * 100))
                : 0;
              
              // Determine dynamic classes for rounding (RTL)
              const greenRoundedClassDetail = detailPercentDone >= 99.9 && detailPercentPlannedNotDone < 0.1 ? 'rounded-full' : 'rounded-r-full';
              const yellowRoundedClassDetail = detailPercentPlannedNotDone > 0.1 ? 'rounded-l-full' : '';


              return (
                <div key={detail.listName} className="py-1.5 border-b border-gray-200 dark:border-gray-700 last:border-b-0 text-sm">
                  <div className="flex items-center justify-between">
                    {/* Left part: Description (List Name) and Progress Text */}
                    <div className="flex-grow min-w-0 mr-3 text-right">
                      <p className={`font-medium truncate ${detail.isSatisfied ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
                        {detail.listName}
                      </p>
                      <p className={`text-xs ${detail.isSatisfied ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {detail.currentValueDone}/{detail.requiredValue} קורסים (מתוכנן: {detail.currentValuePlanned})
                      </p>
                    </div>
                    {/* Right part: Progress Bar for detail */}
                    {detailShowBar && (
                      <div className="w-1/3 flex-shrink-0 bg-gray-300 dark:bg-gray-600 rounded-full h-2.5 relative ml-2 overflow-hidden">  {/* RTL: Changed mx-2 to ml-2 */}
                        {/* Done Part (RTL: starts from right) */}
                        <div 
                          className={`absolute top-0 right-0 h-2.5 bg-green-500 dark:bg-green-600 ${greenRoundedClassDetail}`}
                          style={{ width: `${detailPercentDone}%`, zIndex: 3 }}
                        ></div>
                        {/* Planned but not Done Part (RTL: extends left from Done part) */}
                        {detailPercentPlannedNotDone > 0.1 && (
                          <div 
                            className={`absolute top-0 h-2.5 bg-yellow-400 dark:bg-yellow-500 ${yellowRoundedClassDetail}`}
                            style={{
                              width: `${detailPercentPlannedNotDone}%`,
                              right: `${detailPercentDone}%`, 
                              zIndex: 2,
                            }}
                          ></div>
                        )}
                      </div>
                    )}
                    {!detailShowBar && <div className="w-1/3 flex-shrink-0 h-2.5 ml-2"></div>} {/* Placeholder, RTL: Changed mx-2 to ml-2 */}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default RuleNode; 