import type { ImperativeRouter } from 'expo-router';

// router.back() throws ("The action 'GO_BACK' was not handled by any navigator") whenever
// there's no actual history entry to pop — e.g. a screen reached via a direct web reload/deep
// link, which has no in-app screen before it. Every "Back" button should use this instead of
// calling router.back() unconditionally.
export function goBackOrHome(router: ImperativeRouter): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}
