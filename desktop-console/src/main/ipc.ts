import { ipcMain } from 'electron';
import { IPC, type RuntimeInfo } from '../shared/contracts';
import { inspectControlPlane } from './control-plane';
import { isTrustedRendererUrl } from './security';

const assertTrustedSender = (senderUrl: string | undefined, developmentServerUrl?: string): void => {
  if (!senderUrl || !isTrustedRendererUrl(senderUrl, developmentServerUrl)) {
    throw new Error('拒绝来自非受信 renderer 的 IPC');
  }
};

/** 只登记具名业务语义 IPC，禁止向 Renderer 暴露通用文件或命令执行能力。 */
export const registerIpc = (developmentServerUrl?: string): void => {
  ipcMain.handle(IPC.runtimeInfo, (event): RuntimeInfo => {
    assertTrustedSender(event.senderFrame?.url, developmentServerUrl);
    return {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
    };
  });
  ipcMain.handle(IPC.controlPlaneStatus, async (event) => {
    assertTrustedSender(event.senderFrame?.url, developmentServerUrl);
    return inspectControlPlane();
  });
};
