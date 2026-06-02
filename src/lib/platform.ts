import { Capacitor } from "@capacitor/core";

export function isNativePlatform(): boolean {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

export function isNativeAndroid(): boolean {
  try { return Capacitor.getPlatform() === "android"; } catch { return false; }
}

export function isNativeIOS(): boolean {
  try { return Capacitor.getPlatform() === "ios"; } catch { return false; }
}

/**
 * Google Play and Apple App Store forbid third-party billing for digital
 * goods consumed inside the app. When the app runs as a native build we
 * hide the in-app checkout. Users must subscribe from the web.
 */
export function isInAppCheckoutBlocked(): boolean {
  return isNativePlatform();
}