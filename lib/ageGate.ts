import { getFirebaseFirestore } from "./firebaseAdmin";

type AgeGateProfile = {
  age: number | null;
  isMinor: boolean;
  isAgeKnown: boolean;
  shouldBlockImageAnalysis: boolean;
};

export async function getUserAgeGateProfile(uid: string): Promise<AgeGateProfile> {
  try {
    const firestore = getFirebaseFirestore();
    const snap = await firestore.collection("users").doc(uid).get();
    const data = snap.data() as any;
    const age = Number(data?.onboardingProfile?.age);
    const normalizedAge = Number.isFinite(age) ? Math.round(age) : null;
    return {
      age: normalizedAge,
      isMinor: normalizedAge !== null && normalizedAge > 0 && normalizedAge < 18,
      isAgeKnown: normalizedAge !== null && normalizedAge > 0,
      shouldBlockImageAnalysis: normalizedAge === null || normalizedAge <= 0 || normalizedAge < 18,
    };
  } catch (error) {
    console.warn("getUserAgeGateProfile failed", {
      uid,
      message: (error as any)?.message ?? String(error),
    });
    return {
      age: null,
      isMinor: false,
      isAgeKnown: false,
      shouldBlockImageAnalysis: true,
    };
  }
}
