/** Where the app is opened, to show how to install it (spec §3.3). */
export type InstallPlatform = 'ios' | 'android' | 'other';

/** The platform from the user agent; iPadOS reports a Mac, so touch support tells it apart. */
export function detectInstallPlatform(userAgent: string, maxTouchPoints: number): InstallPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return 'ios';
  }
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) {
    return 'ios';
  }
  if (/Android/i.test(userAgent)) {
    return 'android';
  }
  return 'other';
}
