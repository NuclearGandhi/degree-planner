import { DegreeTemplate } from "../types/data";

const AUTOSAVE_STORAGE_KEY = 'degreePlannerAutosavedPlan_v1'; // Added _v1 for potential future structure changes

// Simplified StoredPlan for autosave: no slot-specific ID or name needed
export interface StoredPlan {
  template: DegreeTemplate;
  grades: Record<string, string>;
  lastSaved?: string; 
}

// Simplified StorageStructure for a single autosaved plan
interface StorageStructure {
  autosavedPlan?: StoredPlan;
}

// Helper to get data from localStorage
function getStorageData(): StorageStructure {
  try {
    const rawData = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    if (rawData) {
      const parsed = JSON.parse(rawData) as StorageStructure;
      // Basic validation: check if autosavedPlan exists and has a template property
      if (parsed && (parsed.autosavedPlan === undefined || (parsed.autosavedPlan && parsed.autosavedPlan.template))) {
        return parsed;
      }
    }
  } catch (error) {
    console.error("Error reading plan data from localStorage:", error);
  }
  // Return default structure if nothing found or error
  return { autosavedPlan: undefined };
}

// Helper to set data to localStorage
function setStorageData(data: StorageStructure): void {
  try {
    localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Error saving plan data to localStorage:", error);
  }
}

/**
 * Saves the current plan state for autosave.
 */
export function savePlan(template: DegreeTemplate, grades: Record<string, string>): void {
  const planToSave: StoredPlan = {
    template: template,
    grades: grades,
    lastSaved: new Date().toISOString(),
  };
  
  setStorageData({ autosavedPlan: planToSave });
  // console.log(`Plan autosaved at ${planToSave.lastSaved}`); // Optional: for debugging
}

/**
 * Loads the autosaved plan.
 * @returns The loaded plan, or null if no plan is autosaved.
 */
export function loadPlan(): StoredPlan | null {
  const storage = getStorageData();
  if (storage.autosavedPlan) {
    // console.log(`Autosaved plan loaded. Last saved: ${storage.autosavedPlan.lastSaved}`); // Optional: for debugging
    return storage.autosavedPlan;
  }
  // console.log("No autosaved plan found."); // Optional: for debugging
  return null;
}

// getActivePlanId and getSavedPlansInfo are no longer needed with the single autosave model.
// MAX_PLANS and the old STORAGE_KEY are also no longer needed. 