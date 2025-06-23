import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { DegreeTemplate } from '../types/data'; // Assuming StoredPlan might be similar to parts of this or new

// Define a type for the data structure in Firestore
export interface FirestorePlanDocument {
  userId: string;
  degreeTemplate?: DegreeTemplate;
  grades?: Record<string, string>;
  classificationChecked?: Record<string, boolean>;
  classificationCredits?: Record<string, number>;
  binaryStates?: Record<string, boolean>;
  lastSaved?: Timestamp; // Firestore Timestamp for server-side timestamping
}

const USER_PLAN_COLLECTION = 'userPlans'; // Collection name in Firestore

// Helper function to detect if error is caused by ad blocker or network blocking
const isBlockedByClient = (error: unknown): boolean => {
  const errorMessage = (error as Error)?.message?.toLowerCase() || '';
  const errorCode = (error as { code?: string })?.code?.toLowerCase() || '';
  
  return (
    errorMessage.includes('blocked by client') ||
    errorMessage.includes('network error') ||
    errorMessage.includes('failed to fetch') ||
    errorCode === 'unavailable' ||
    errorCode === 'failed-precondition'
  );
};

/**
 * Saves the user's degree plan to Firestore.
 * Associates the plan with the user's UID.
 */
export const savePlanToFirestore = async (
  userId: string,
  degreeTemplate: DegreeTemplate | undefined,
  grades: Record<string, string>,
  classificationChecked: Record<string, boolean>,
  classificationCredits: Record<string, number>,
  binaryStates: Record<string, boolean>
): Promise<void> => {
  if (!userId) {
    console.error('[savePlanToFirestore] No user ID provided, cannot save to Firestore.');
    return;
  }
  if (!degreeTemplate) {
    console.warn('[savePlanToFirestore] No degree template provided, saving partial plan.');
    // Or decide to return / throw error if template is essential
  }

  const planDocRef = doc(db, USER_PLAN_COLLECTION, userId);
  const planData: FirestorePlanDocument = {
    userId,
    degreeTemplate,
    grades,
    classificationChecked,
    classificationCredits,
    binaryStates,
    lastSaved: Timestamp.now(), // Use Firestore server timestamp
  };

  try {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[savePlanToFirestore] Saving plan for user:', userId);
      console.debug('[savePlanToFirestore] Template semesters:', Object.keys(planData.degreeTemplate?.semesters || {}));
      console.debug('[savePlanToFirestore] Full planData:', planData);
    }
    await setDoc(planDocRef, planData); // Replace the entire document to ensure removals are persisted
    if (process.env.NODE_ENV === 'development') {
      console.debug('[savePlanToFirestore] Plan saved successfully for user:', userId);
      console.debug('[savePlanToFirestore] Saved template semesters:', Object.keys(planData.degreeTemplate?.semesters || {}));
    }
  } catch (error) {
    if (isBlockedByClient(error)) {
      console.warn('[savePlanToFirestore] Firestore blocked by ad blocker or network. Data will be saved locally only.');
      // You could show a user-friendly message here or emit an event
      // that the UI can listen to and display a notification
    } else {
      console.error('[savePlanToFirestore] Error saving plan to Firestore for user:', userId, error);
      // Potentially re-throw or handle error for UI feedback
    }
    // Don't re-throw - let the app continue to use local storage
  }
};

/**
 * Loads the user's degree plan from Firestore.
 * Retrieves the plan associated with the user's UID.
 */
export const loadPlanFromFirestore = async (userId: string): Promise<FirestorePlanDocument | null> => {
  if (!userId) {
    console.error('[loadPlanFromFirestore] No user ID provided, cannot load from Firestore.');
    return null;
  }

  const planDocRef = doc(db, USER_PLAN_COLLECTION, userId);

  try {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[loadPlanFromFirestore] Attempting to load plan for user:', userId);
    }
    const docSnap = await getDoc(planDocRef);

    if (docSnap.exists()) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[loadPlanFromFirestore] Plan found for user:', userId, docSnap.data());
      }
      // TODO: Validate data structure against FirestorePlanDocument if necessary
      return docSnap.data() as FirestorePlanDocument;
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[loadPlanFromFirestore] No plan found in Firestore for user:', userId);
      }
      return null; // No document found
    }
  } catch (error) {
    if (isBlockedByClient(error)) {
      console.warn('[loadPlanFromFirestore] Firestore blocked by ad blocker or network. Falling back to local storage.');
      return null; // This will trigger fallback to local storage in the calling code
    } else {
      console.error('[loadPlanFromFirestore] Error loading plan from Firestore for user:', userId, error);
      return null; // Error occurred
    }
  }
}; 