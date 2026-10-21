/** Event PlatformHeader listens for to open the shared sign-in dialog. */
export const OPEN_SIGN_IN_EVENT = "hackjudge:open-signin";

export function requestSignIn() {
  window.dispatchEvent(new CustomEvent(OPEN_SIGN_IN_EVENT));
}
