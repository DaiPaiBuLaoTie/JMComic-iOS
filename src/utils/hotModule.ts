// Application code is shipped only inside an IPA built from this repository.
// Keep the original exports so the existing screens can display a version without remote updates.
export async function getLocalVersion(): Promise<string> {
  return process.env.REACT_APP_VERSION || '2.1.11';
}
export async function initHotUpdate(_dispatch: unknown): Promise<void> {
  return;
}
