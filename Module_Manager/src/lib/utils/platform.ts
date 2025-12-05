/**
 * Platform detection utilities for cross-platform compatibility
 * Handles Mac-specific behaviors for trackpads, modifier keys, etc.
 */

/**
 * Detect if the current platform is macOS
 */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    navigator.platform.toUpperCase().indexOf('MAC') >= 0 ||
    navigator.userAgent.toUpperCase().indexOf('MAC') >= 0
  );
}

/**
 * Detect if a wheel event is from a Mac trackpad (smooth scrolling)
 */
export function isMacTrackpadScroll(event: WheelEvent): boolean {
  return Math.abs(event.deltaY) < 10 && event.deltaMode === 0;
}

/**
 * Detect if a wheel event is a pinch-to-zoom gesture
 */
export function isPinchGesture(event: WheelEvent): boolean {
  return event.ctrlKey && Math.abs(event.deltaY) > 0;
}

/**
 * Check if modifier key is pressed (Ctrl on Windows/Linux, Cmd on Mac)
 */
export function hasModifierKey(event: WheelEvent | KeyboardEvent | MouseEvent): boolean {
  return event.ctrlKey || event.metaKey;
}

/**
 * Determine if a wheel event should be allowed (for map zoom/pan handling)
 * Returns true if the event should be allowed, false if it should be prevented
 */
export function shouldAllowWheelEvent(event: WheelEvent): boolean {
  const hasModifier = hasModifierKey(event);
  const mac = isMac();
  
  if (mac) {
    // On Mac: allow pinch-to-zoom and trackpad panning
    if (hasModifier || isPinchGesture(event)) {
      return true; // Intentional zoom gesture
    }
    if (isMacTrackpadScroll(event) && !hasModifier) {
      return true; // Mac trackpad panning
    }
  }
  
  // On Windows/Linux or Mac mouse: require modifier for zoom
  return hasModifier;
}
