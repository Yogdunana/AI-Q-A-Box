/**
 * Viewports (CSS px) the layout is verified against. Values come from vendor
 * specs; iPhone Duo sizes are the Safari 27.1 viewports published by WebKit.
 *
 * Expected layout follows the rules in src/lib/hooks.ts (LAYOUT_MEDIA):
 * - touch devices always get the bottom tab bar; the sidebar is for wide windows
 *   driven by a mouse or trackpad;
 * - tab bar form: compact when height <= 480, floating when width >= 600, else phone;
 * - the inbox splits list and detail at width >= 720 and height >= 481.
 */
export type TabbarForm = "phone" | "compact" | "floating";

export interface DeviceProfile {
  name: string;
  width: number;
  height: number;
  touch: boolean;
  nav: "sidebar" | TabbarForm;
  split: boolean;
}

export const DEVICES: DeviceProfile[] = [
  // Phones, portrait
  { name: "Galaxy Fold cover", width: 280, height: 653, touch: true, nav: "phone", split: false },
  { name: "Galaxy Z Fold cover", width: 344, height: 882, touch: true, nav: "phone", split: false },
  { name: "iPhone SE", width: 375, height: 667, touch: true, nav: "phone", split: false },
  { name: "iPhone Duo outer", width: 382, height: 580, touch: true, nav: "phone", split: false },
  { name: "iPhone Duo split window", width: 385, height: 571, touch: true, nav: "phone", split: false },
  { name: "iPhone 17", width: 402, height: 874, touch: true, nav: "phone", split: false },
  { name: "Pixel 9", width: 412, height: 923, touch: true, nav: "phone", split: false },
  { name: "iPhone 17 Pro Max", width: 440, height: 956, touch: true, nav: "phone", split: false },

  // Phones, landscape (short screens)
  { name: "iPhone Duo outer landscape", width: 594, height: 368, touch: true, nav: "compact", split: false },
  { name: "iPhone SE landscape", width: 667, height: 375, touch: true, nav: "compact", split: false },
  { name: "iPhone 17 landscape", width: 874, height: 402, touch: true, nav: "compact", split: false },

  // Open foldables and small tablets
  { name: "iPhone Duo inner portrait", width: 669, height: 867, touch: true, nav: "floating", split: false },
  { name: "Galaxy Z Fold inner", width: 690, height: 838, touch: true, nav: "floating", split: false },
  { name: "iPad mini portrait", width: 744, height: 1133, touch: true, nav: "floating", split: true },
  { name: "Pixel Fold inner", width: 841, height: 701, touch: true, nav: "floating", split: true },
  { name: "iPhone Duo inner landscape", width: 951, height: 585, touch: true, nav: "floating", split: true },

  // Tablets
  { name: "iPad Air portrait", width: 820, height: 1180, touch: true, nav: "floating", split: true },
  { name: "iPad Pro 11 portrait", width: 834, height: 1194, touch: true, nav: "floating", split: true },
  { name: "iPad Pro 13 portrait", width: 1032, height: 1376, touch: true, nav: "floating", split: true },
  { name: "iPad Air landscape", width: 1180, height: 820, touch: true, nav: "floating", split: true },
  { name: "iPad Pro 13 landscape", width: 1376, height: 1032, touch: true, nav: "floating", split: true },

  // Desktop browsers (mouse / trackpad)
  { name: "Narrow desktop window", width: 900, height: 800, touch: false, nav: "floating", split: true },
  { name: "Laptop 1280", width: 1280, height: 800, touch: false, nav: "sidebar", split: true },
  { name: "Laptop 1366", width: 1366, height: 768, touch: false, nav: "sidebar", split: true },
  { name: "Desktop 1920", width: 1920, height: 1080, touch: false, nav: "sidebar", split: true },
  { name: "Desktop 2560", width: 2560, height: 1440, touch: false, nav: "sidebar", split: true },
];
