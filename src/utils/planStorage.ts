import { DegreeTemplate } from "../types/data";

const AUTOSAVE_STORAGE_KEY = 'degreePlannerAutosavedPlan_v1';

export interface StoredPlan {
  template: DegreeTemplate;
  grades: Record<string, string>;
  classificationChecked: Record<string, boolean>;
  classificationCredits: Record<string, number>;
  binaryStates?: Record<string, boolean>;
  timestamp?: number;
  lastSaved?: string; 
}

interface StorageStructure {
  autosavedPlan?: StoredPlan;
}

function getStorageData(): StorageStructure {
  try {
    const rawData = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    if (rawData) {
      const parsed = JSON.parse(rawData) as StorageStructure;
      if (parsed && (parsed.autosavedPlan === undefined || (parsed.autosavedPlan && parsed.autosavedPlan.template))) {
        return parsed;
      }
    }
  } catch (error) {
    console.error("Error reading plan data from localStorage:", error);
  }
  return { autosavedPlan: undefined };
}

function setStorageData(data: StorageStructure): void {
  try {
    localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Error saving plan data to localStorage:", error);
  }
}

export function savePlan(template: DegreeTemplate, grades: Record<string, string>, classificationChecked: Record<string, boolean>, classificationCredits: Record<string, number>, binaryStates: Record<string, boolean>): void {
  const planToSave: StoredPlan = {
    template: template,
    grades: grades,
    classificationChecked: classificationChecked,
    classificationCredits: classificationCredits,
    binaryStates: binaryStates,
    timestamp: Date.now(),
    lastSaved: new Date().toISOString(),
  };
  
  setStorageData({ autosavedPlan: planToSave });
}

export function loadPlan(): StoredPlan | null {
  const storage = getStorageData();
  if (storage.autosavedPlan) {
    return storage.autosavedPlan;
  }
  return null;
}