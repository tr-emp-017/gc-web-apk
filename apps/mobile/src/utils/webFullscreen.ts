// Web-only helpers for making the game feel full-screen in a mobile browser: requesting the
// Fullscreen API (which is what actually hides Chrome's address bar) and, once fullscreen,
// locking screen orientation to landscape. Both browser APIs are typed loosely here because
// TypeScript's bundled DOM lib doesn't fully describe the (still-evolving) Screen Orientation
// API, and Safari/iOS simply doesn't implement orientation locking at all — every call below
// is deliberately best-effort and silently gives up where a browser doesn't support it, since
// there is no user-facing fallback UI for this (no "please rotate your device" screen).

type OrientationLockType =
  | 'any'
  | 'natural'
  | 'landscape'
  | 'portrait'
  | 'portrait-primary'
  | 'portrait-secondary'
  | 'landscape-primary'
  | 'landscape-secondary';

type ScreenOrientationWithLock = ScreenOrientation & {
  lock?: (orientation: OrientationLockType) => Promise<void>;
  unlock?: () => void;
};

type DocumentElementWithVendorFullscreen = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type DocumentWithVendorFullscreen = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

function isFullscreenActive(): boolean {
  const doc = document as DocumentWithVendorFullscreen;
  return doc.fullscreenElement != null || doc.webkitFullscreenElement != null;
}

function lockLandscape(): void {
  const orientation = screen.orientation as ScreenOrientationWithLock | undefined;
  orientation?.lock?.('landscape').catch(() => {
    // Not supported (e.g. iOS Safari) or rejected outside fullscreen — nothing more to do.
  });
}

// Requests fullscreen (the part that actually hides the browser's address bar), then attempts
// a landscape lock once fullscreen is granted. Browsers only grant requestFullscreen() when
// called synchronously from a genuine user gesture, so this is meant to be called both eagerly
// on mount (works if navigation here was itself a tap) and again from a one-off listener on
// the first tap inside the game (see attachFullscreenUnlockGesture below) as a fallback.
export function requestWebFullscreenLandscape(): void {
  if (typeof document === 'undefined') {
    return;
  }
  if (isFullscreenActive()) {
    lockLandscape();
    return;
  }
  const root = document.documentElement as DocumentElementWithVendorFullscreen;
  const request = root.requestFullscreen?.bind(root) ?? root.webkitRequestFullscreen?.bind(root);
  if (request === undefined) {
    return;
  }
  Promise.resolve(request())
    .then(() => lockLandscape())
    .catch(() => {
      // Blocked (most likely: not a direct user-gesture call) — the caller's gesture-based
      // fallback listener gets the next chance.
    });
}

// Browsers require requestFullscreen() to be called synchronously inside a real user-gesture
// event handler. Navigating to the game screen isn't reliably one of those (it can come from
// a socket event, not a tap), so this attaches a one-time listener for the very first tap
// anywhere on the page and retries there — invisible to the player, no separate prompt shown.
export function attachFullscreenUnlockGesture(): () => void {
  if (typeof document === 'undefined') {
    return () => {};
  }
  const handleFirstGesture = (): void => {
    requestWebFullscreenLandscape();
  };
  document.addEventListener('pointerdown', handleFirstGesture, { once: true });
  return () => document.removeEventListener('pointerdown', handleFirstGesture);
}

// Restores normal windowed/portrait browsing on the way back to the lobby/home screens.
export function exitWebFullscreenLandscape(): void {
  if (typeof document === 'undefined') {
    return;
  }
  const orientation = screen.orientation as ScreenOrientationWithLock | undefined;
  orientation?.unlock?.();
  if (!isFullscreenActive()) {
    return;
  }
  const doc = document as DocumentWithVendorFullscreen;
  const exit = document.exitFullscreen?.bind(document) ?? doc.webkitExitFullscreen?.bind(doc);
  const result = exit?.();
  // The standard API returns a Promise; the older webkit-prefixed one may not.
  if (result !== undefined && typeof result.then === 'function') {
    result.catch(() => {
      // Already left fullscreen some other way (e.g. the user pressed Esc) — nothing to do.
    });
  }
}
