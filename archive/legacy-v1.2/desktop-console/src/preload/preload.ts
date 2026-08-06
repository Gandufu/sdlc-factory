import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type ControlPlaneStatus, type DesktopBridge, type RuntimeInfo } from '../shared/contracts';

const bridge: DesktopBridge = {
  getRuntimeInfo: () => ipcRenderer.invoke(IPC.runtimeInfo) as Promise<RuntimeInfo>,
  getControlPlaneStatus: () => ipcRenderer.invoke(IPC.controlPlaneStatus) as Promise<ControlPlaneStatus>,
};

contextBridge.exposeInMainWorld('desktop', bridge);
