import { useCallback, useEffect, useState } from 'react';
import type { ControlPlaneStatus } from '../../shared/contracts';
import { controlPlaneClient, inspectControlPlaneStatus, subscribeRunEvents } from '../api/controlPlaneClient';
import type { AttentionItem, CapacityBoard, RunEvent, RunProjection } from '../api/types';

const unavailable: ControlPlaneStatus = { state: 'unavailable', checkedAt: '', detail: '尚未检查' };

/** 汇聚 readiness、容量只读投影和 SSE 连接生命周期，页面只消费稳定状态。 */
export const useControlPlane = () => {
  const [status, setStatus] = useState<ControlPlaneStatus>(unavailable);
  const [board, setBoard] = useState<CapacityBoard | null>(null);
  const [error, setError] = useState<string>();
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [runs, setRuns] = useState<RunProjection[]>([]);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [streamConnected, setStreamConnected] = useState(false);

  const refresh = useCallback(async () => {
    const nextStatus = await inspectControlPlaneStatus();
    setStatus(nextStatus);
    if (nextStatus.state !== 'ready') return;
    try {
      const [nextBoard, nextRuns, nextAttention] = await Promise.all([
        controlPlaneClient.getCapacityBoard(), controlPlaneClient.getRunBoard(), controlPlaneClient.getAttention(),
      ]);
      setBoard(nextBoard);
      setRuns(nextRuns);
      setAttention(nextAttention);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '容量看板加载失败');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    // 只在 readiness 成功后订阅，避免控制平面离线时制造无意义重连噪声。
    if (status.state !== 'ready') return;
    return subscribeRunEvents(
      (event) => setEvents((current) => [event, ...current].slice(0, 20)),
      setStreamConnected,
    );
  }, [status.state]);

  return { status, board, error, events, runs, attention, streamConnected, refresh };
};
