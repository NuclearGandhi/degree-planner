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
      console.debug('[savePlanToFirestore] Saving plan for user:', userId, planData);
    }
    await setDoc(planDocRef, planData, { merge: true }); // Use merge: true to update existing or create new
    if (process.env.NODE_ENV === 'development') {
      console.debug('[savePlanToFirestore] Plan saved successfully for user:', userId);
    }
  } catch (error) {
    console.error('[savePlanToFirestore] Error saving plan to Firestore for user:', userId, error);
    // Potentially re-throw or handle error for UI feedback
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
    console.error('[loadPlanFromFirestore] Error loading plan from Firestore for user:', userId, error);
    return null; // Error occurred
  }
}; 