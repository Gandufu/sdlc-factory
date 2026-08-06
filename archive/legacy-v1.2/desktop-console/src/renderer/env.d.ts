import type { DesktopBridge } from '../shared/contracts';

declare global {
  interface Window {
    /** Electron preload 注入；独立浏览器预览时不存在。 */
    desktop?: DesktopBridge;
  }
}

export {};
