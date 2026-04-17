// No-op stub for expo-keep-awake.
// The real native module throws "Unable to activate keep awake" in this build
// because expo-keep-awake is a transitive dep of expo and its native code is not
// linked in the dev client. All exports are safe no-ops.

export const ExpoKeepAwakeTag = 'ExpoKeepAwakeDefaultTag';

export function useKeepAwake() {}

export async function isAvailableAsync() {
  return false;
}

/** @deprecated */
export async function activateKeepAwake() {}

export async function activateKeepAwakeAsync() {}

export async function deactivateKeepAwake() {}

export function addListener() {
  return { remove: () => {} };
}
