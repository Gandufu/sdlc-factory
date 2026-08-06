import { useCallback, useEffect, useState } from 'react';
import { controlPlaneClient } from '@/api/controlPlaneClient';
import type { ProjectWorkspaceProjection, SessionProjection } from '@/api/types';

export const useWorkspace = (projectId: string) => {
  const [workspace, setWorkspace] = useState<ProjectWorkspaceProjection>();
  const [session, setSession] = useState<SessionProjection>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const selectSession = useCallback(async (sessionId: string) => {
    setError(undefined);
    try { setSession(await controlPlaneClient.getSession(projectId, sessionId)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '会话读取失败'); }
  }, [projectId]);

  const refresh = useCallback(async () => {
    setLoading(true); setError(undefined);
    try {
      const projection = await controlPlaneClient.getWorkspace(projectId);
      setWorkspace(projection);
      const selected = projection.sessions.find((item) => item.session_id === session?.session_id)
        ?? projection.sessions.find((item) => item.current) ?? projection.sessions[0];
      setSession(selected ? await controlPlaneClient.getSession(projectId, selected.session_id) : undefined);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '项目工作区加载失败'); }
    finally { setLoading(false); }
  }, [projectId, session?.session_id]);

  useEffect(() => { void refresh(); }, [refresh]);

  const command = async (action: () => Promise<SessionProjection>) => {
    setBusy(true); setError(undefined);
    try { setSession(await action()); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '工作区命令失败'); }
    finally { setBusy(false); }
  };

  return {
    workspace, session, loading, busy, error, refresh, selectSession,
    createSession: (parentSessionId?: string) => command(() => controlPlaneClient.createSession(projectId, {
      parent_session_id: parentSessionId, agent: 'opencode-luna-max', title: parentSessionId ? 'Child Session' : '持续交付会话',
    })),
    archiveSession: () => session && command(() => controlPlaneClient.archiveSession(projectId, session.session_id)),
    send: (content: string) => session && command(() => controlPlaneClient.sendSessionMessage(projectId, session.session_id, content)),
    recover: (runId: string) => session && command(() => controlPlaneClient.recoverRun(projectId, session.session_id, runId)),
    decideGate: async (gateId: string, action: 'approve' | 'request-changes', expectedVersion: number, reviewer: string, comments: string) => {
      setBusy(true); setError(undefined);
      try { setWorkspace(await controlPlaneClient.decideWorkspaceGate(projectId, gateId, action, expectedVersion, reviewer, comments)); await refresh(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Gate 命令失败'); }
      finally { setBusy(false); }
    },
  };
};
