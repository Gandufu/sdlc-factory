import { useCallback, useEffect, useState } from 'react';
import { controlPlaneClient } from '../api/controlPlaneClient';
import type { CreateProjectInput, ProjectSummary } from '../api/types';

/** 项目目录只读取控制平面权威投影，不保留本地 fixture。 */
export const useProjects = () => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await controlPlaneClient.getProjects());
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '项目目录加载失败');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const create = async (input: CreateProjectInput) => {
    const project = await controlPlaneClient.createProject(input);
    setProjects((current) => [project, ...current]);
    return project;
  };

  const approve = async (projectId: string) => {
    const project = await controlPlaneClient.approveInitialization(projectId);
    setProjects((current) => current.map((item) => item.project_id === projectId ? project : item));
    return project;
  };

  return { projects, loading, error, refresh, create, approve };
};
