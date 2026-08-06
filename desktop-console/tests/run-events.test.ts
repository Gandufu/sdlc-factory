import { describe, expect, it, vi } from 'vitest';
import { subscribeRunEvents } from '../src/renderer/api/controlPlaneClient';

describe('SSE 观测边界', () => {
  it('断线只更新连接状态且不会产生领域事件', () => {
    class FakeEventSource {
      static current?: FakeEventSource;
      onopen?: () => void;
      onerror?: () => void;
      listener?: (message: { data: string }) => void;
      constructor() { FakeEventSource.current = this; }
      addEventListener(_type: string, listener: (message: { data: string }) => void) { this.listener = listener; }
      close = vi.fn();
    }
    vi.stubGlobal('EventSource', FakeEventSource);
    const onEvent = vi.fn();
    const onConnectionChange = vi.fn();

    const unsubscribe = subscribeRunEvents(onEvent, onConnectionChange);
    FakeEventSource.current?.onerror?.();
    FakeEventSource.current?.listener?.({ data: 'invalid-json' });
    unsubscribe();

    expect(onConnectionChange).toHaveBeenCalledWith(false);
    expect(onEvent).not.toHaveBeenCalled();
    expect(FakeEventSource.current?.close).toHaveBeenCalled();
  });
});
