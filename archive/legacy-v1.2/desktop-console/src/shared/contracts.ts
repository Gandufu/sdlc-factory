export const IPC = {
  runtimeInfo: 'app:runtime-info',
  controlPlaneStatus: 'control-plane:status',
} as const;

export interface RuntimeInfo {
  electron: string;
  chrome: string;
  node: string;
  platform: NodeJS.Platform;
}

export type ControlPlaneStatus = {
  state: 'ready' | 'unavailable';
  checkedAt: string;
  detail?: string;
};

export interface DesktopBridge {
  getRuntimeInfo(): Promise<RuntimeInfo>;
  getControlPlaneStatus(): Promise<ControlPlaneStatus>;
}
