export type ProjectSnapshot = {
  id: string;
  initials: string;
  name: string;
  template: string;
  stage: string;
  state: 'running' | 'review' | 'blocked';
  progress: number;
  updated: string;
};

export type AttentionSnapshot = {
  id: string;
  projectId: string;
  scope: string;
  title: string;
  summary: string;
  severity: 'decision' | 'blocked';
};

/**
 * M0 明确的可替换查询适配器。服务端查询合同冻结后删除本文件，
 * 页面继续消费相同 View Model，避免样例数据渗入领域命令。
 */
export const projectSnapshots: ProjectSnapshot[] = [
  {
    id: 'PRJ-024', initials: 'UI', name: '统一身份平台', template: 'Spring Boot + React',
    stage: '总体设计审核', state: 'review', progress: 38, updated: '2 分钟前',
  },
  {
    id: 'PRJ-018', initials: 'DM', name: '设备管理平台', template: 'Node Service',
    stage: 'CU 编码与测试', state: 'running', progress: 72, updated: '18 分钟前',
  },
  {
    id: 'PRJ-011', initials: 'OP', name: '运营配置中心', template: 'Spring Boot + React',
    stage: '系统验收', state: 'blocked', progress: 91, updated: '昨天',
  },
];

export const attentionSnapshots: AttentionSnapshot[] = [
  {
    id: 'ATT-101', projectId: 'PRJ-024', scope: '项目 · 总体设计', title: '总体设计等待裁决',
    summary: '审核候选产物、确定性检查和证据后形成设计基线。', severity: 'decision',
  },
  {
    id: 'ATT-102', projectId: 'PRJ-024', scope: 'CU-03 · Coding', title: '环境阻塞，需要人工恢复',
    summary: 'SSO 沙箱不可用；重新检查通过后只能创建新 Run。', severity: 'blocked',
  },
];

export const lifecycleStages = ['初始化', '项目需求', '总体设计', 'CU 编码 / 测试', '系统验收'];
