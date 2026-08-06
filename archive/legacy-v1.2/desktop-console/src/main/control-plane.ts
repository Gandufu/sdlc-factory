import { net } from 'electron';
import type { ControlPlaneStatus } from '../shared/contracts';

const HEALTH_URL = 'http://127.0.0.1:8420/actuator/health';

/**
 * Main 进程执行 readiness 检查，避免 Renderer 为健康探测额外放宽网络权限。
 * 超时只改变本地连接提示，不推断或修改任何 Factory 领域状态。
 */
export const inspectControlPlane = async (): Promise<ControlPlaneStatus> => {
  const checkedAt = new Date().toISOString();
  try {
    const response = await net.fetch(HEALTH_URL, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) {
      return { state: 'unavailable', checkedAt, detail: `健康检查返回 HTTP ${response.status}` };
    }
    const body = (await response.json()) as { status?: string };
    return body.status === 'UP'
      ? { state: 'ready', checkedAt }
      : { state: 'unavailable', checkedAt, detail: `控制平面状态为 ${body.status ?? 'UNKNOWN'}` };
  } catch (error) {
    const detail = error instanceof Error ? error.message : '无法连接控制平面';
    return { state: 'unavailable', checkedAt, detail };
  }
};
