import { DegreeTemplate } from "../types/data";

const STORAGE_KEY = 'degreePlannerPlans';
const MAX_PLANS = 3;

export interface StoredPlan {
  id: number; // Slot ID (1, 2, or 3)
  name: string; // e.g., "Plan 1"
  template: DegreeTemplate; // The modified template state
  grades: Record<string, string>; // The associated grades
  lastSaved?: string; // Optional: ISO timestamp string
}

interface StorageStructure {
  degreePlans: StoredPlan[];
  activePlanId: number | null;
}

// Helper to get data from localStorage
function getStorageData(): StorageStructure {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (rawData) {
      const parsed = JSON.parse(rawData) as StorageStructure;
      // Basic validation
      if (parsed && Array.isArray(parsed.degreePlans)) {
        return parsed;
      }
    }
  } catch (error) {
    console.error("Error reading plan data from localStorage:", error);
  }
  // Return default structure if nothing found or error
  return { degreePlans: [], activePlanId: null };
}

// Helper to set data to localStorage
function setStorageData(data: StorageStructure): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Error saving plan data to localStorage:", error);
    // Handle potential storage full errors
  }
}

/**
 * Saves the current plan state to a specific slot.
 */
export function savePlanToSlot(slotId: number, template: DegreeTemplate, grades: Record<string, string>): void {
  if (slotId < 1 || slotId > MAX_PLANS) {
    console.error(`Invalid slot ID: ${slotId}`);
    return;
  }
  const storage = getStorageData();
  const existingPlanIndex = storage.degreePlans.findIndex(p => p.id === slotId);
  
  const planToSave: StoredPlan = {
    id: slotId,
    name: `Plan ${slotId}`, // Simple naming for now
    template: template,
    grades: grades,
    lastSaved: new Date().toISOString(),
  };

  if (existingPlanIndex > -1) {
    storage.degreePlans[existingPlanIndex] = planToSave;
  } else {
    storage.degreePlans.push(planToSave);
    // Optional: Sort by ID or handle if somehow MAX_PLANS is exceeded
    storage.degreePlans.sort((a, b) => a.id - b.id);
  }
  
  storage.activePlanId = slotId; // Make the saved slot active
  setStorageData(storage);
  console.log(`Plan saved to slot ${slotId}`);
}

/**
 * Loads a plan from a specific slot.
 * @returns The loaded plan, or null if the slot is empty or invalid.
 */
export function loadPlanFromSlot(slotId: number): StoredPlan | null {
  if (slotId < 1 || slotId > MAX_PLANS) {
    console.error(`Invalid slot ID: ${slotId}`);
    return null;
  }
  const storage = getStorageData();
  const plan = storage.degreePlans.find(p => p.id === slotId);
  
  if (plan) {
    storage.activePlanId = slotId; // Make the loaded slot active
    setStorageData(storage);
    console.log(`Plan loaded from slot ${slotId}`);
    return plan;
  } else {
    console.log(`No plan found in slot ${slotId}`);
    return null;
  }
}

/**
 * Gets the ID of the last active plan, if any.
 */
export function getActivePlanId(): number | null {
  return getStorageData().activePlanId;
}

/** 
 * Gets basic info about saved plans (ID and Name) for display purposes.
 */
export function getSavedPlansInfo(): { id: number; name: string; lastSaved?: string }[] {
  const storage = getStorageData();
  return storage.degreePlans.map(p => ({ id: p.id, name: p.name, lastSaved: p.lastSaved }));
} 