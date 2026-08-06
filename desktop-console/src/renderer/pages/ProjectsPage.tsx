import { useState } from 'react';
import { ArrowRight, Check, Database, FolderOpen, Loader2, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { ControlPlaneError, type CreateProjectInput, type ProjectSummary } from '@/api/types';
import { ProjectStatusBadge } from '@/components/status-badges';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const templates = [{
  id: 'TPL-NODE-BASIC',
  version: '1.0.0',
  name: 'Node Service 基础模板',
  description: '受控 Node.js 服务；执行生成、Git、测试、启动、就绪和停止检查。',
}] as const;

type FormErrors = { name?: string; workspacePath?: string; form?: string };

const ProjectCreateDialog = ({ open, onOpenChange, onCreate }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: CreateProjectInput) => Promise<ProjectSummary>;
}) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [workspacePath, setWorkspacePath] = useState('');
  const [templateId, setTemplateId] = useState(templates[0].id);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const template = templates.find((item) => item.id === templateId) ?? templates[0];

  const close = () => {
    if (submitting) return;
    setStep(1); setErrors({}); onOpenChange(false);
  };

  const next = () => {
    const nextErrors: FormErrors = {};
    if (!name.trim()) nextErrors.name = '请输入项目名称';
    if (!workspacePath.trim()) nextErrors.workspacePath = '请输入新项目的绝对工作目录';
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    setErrors({}); setStep((current) => Math.min(3, current + 1));
  };

  const submit = async () => {
    setSubmitting(true); setErrors({});
    try {
      await onCreate({
        project_name: name.trim(), workspace_path: workspacePath.trim(),
        template_id: template.id, template_version: template.version,
      });
      setSubmitting(false); setStep(1); setErrors({}); onOpenChange(false);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '项目初始化失败';
      const pathError = cause instanceof ControlPlaneError
        && (message.includes('workspace_path') || message.includes('路径') || message.includes('目录'));
      setErrors(pathError ? { workspacePath: message } : { form: message });
      setSubmitting(false);
      if (pathError) setStep(1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) close(); }}>
      <DialogContent className="max-w-2xl" showCloseButton={!submitting}>
        <DialogHeader>
          <span className="panel-kicker">NEW PROJECT</span>
          <DialogTitle>创建项目</DialogTitle>
          <DialogDescription>绑定新工作目录与已发布模板，随后由控制平面执行初始化检查。</DialogDescription>
        </DialogHeader>
        <ol className="create-steps" aria-label="创建项目步骤">
          {['基本信息', '选择模板', '确认初始化'].map((label, index) => (
            <li key={label} data-state={step === index + 1 ? 'active' : step > index + 1 ? 'complete' : 'waiting'}>
              <span>{step > index + 1 ? <Check aria-hidden="true" /> : index + 1}</span><strong>{label}</strong>
            </li>
          ))}
        </ol>
        <div className="create-dialog-body">
          {step === 1 && <div className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="project-name">项目名称</Label>
              <Input id="project-name" value={name} autoFocus aria-invalid={Boolean(errors.name)}
                onChange={(event) => setName(event.target.value)} placeholder="例如：客户服务工作台" />
              {errors.name && <p className="field-error">{errors.name}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="workspace-path">项目绝对路径</Label>
              <Input id="workspace-path" value={workspacePath} aria-invalid={Boolean(errors.workspacePath)}
                onChange={(event) => setWorkspacePath(event.target.value)} placeholder="D:\workspace\my-project" />
              <p className="field-help">必须是尚不存在的新目录；控制平面会验证路径、Git 状态和初始版本。</p>
              {errors.workspacePath && <p className="field-error">{errors.workspacePath}</p>}
            </div>
          </div>}
          {step === 2 && <div className="grid gap-3">
            <p className="field-help">选择已发布且与当前控制平面兼容的模板。</p>
            {templates.map((item) => <button type="button" key={item.id}
              className={cn('template-choice', item.id === templateId && 'selected')}
              onClick={() => setTemplateId(item.id)}>
              <span><strong>{item.name}</strong><small>{item.id}@{item.version}</small><p>{item.description}</p></span>
              {item.id === templateId && <Check aria-hidden="true" />}
            </button>)}
          </div>}
          {step === 3 && <div className="grid gap-4">
            <div className="create-review-grid">
              <span>项目<strong>{name}</strong></span>
              <span>工作目录<strong>{workspacePath}</strong></span>
              <span>模板绑定<strong>{template.id}@{template.version}</strong></span>
            </div>
            <Alert>
              <ShieldCheck aria-hidden="true" />
              <AlertTitle>初始化完成后仍需人工审核</AlertTitle>
              <AlertDescription>确认后会真实生成目录并执行 Git、测试、启动和停止检查；全部证据通过后才能批准初始化基线。</AlertDescription>
            </Alert>
            {errors.form && <Alert variant="destructive"><AlertTitle>无法创建项目</AlertTitle><AlertDescription>{errors.form}</AlertDescription></Alert>}
          </div>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={submitting} onClick={step === 1 ? close : () => setStep((current) => current - 1)}>
            {step === 1 ? '取消' : '上一步'}
          </Button>
          {step < 3
            ? <Button onClick={next}>继续<ArrowRight aria-hidden="true" /></Button>
            : <Button disabled={submitting} onClick={() => void submit()}>
              {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FolderOpen aria-hidden="true" />}
              {submitting ? '正在初始化' : '开始初始化'}
            </Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const ProjectsPage = ({ projects, loading, error, onRefresh, onOpen, onCreate }: {
  projects: ProjectSummary[];
  loading: boolean;
  error?: string;
  onRefresh: () => void;
  onOpen: (project: ProjectSummary) => void;
  onCreate: (input: CreateProjectInput) => Promise<ProjectSummary>;
}) => {
  const [creating, setCreating] = useState(false);
  const create = async (input: CreateProjectInput) => {
    const project = await onCreate(input);
    onOpen(project);
    return project;
  };

  return <main className="page projects-page">
    <header className="page-heading">
      <div><span className="live-badge"><Database aria-hidden="true" />PostgreSQL 实时数据</span>
        <h1>把交付事实放在一条线上。</h1><p>创建项目会真实执行模板生成、Git、测试和运行时校验。</p></div>
      <Button size="lg" onClick={() => setCreating(true)}><Plus aria-hidden="true" />创建项目</Button>
    </header>
    <ProjectCreateDialog open={creating} onOpenChange={setCreating} onCreate={create} />
    <section className="project-summary"><div><span>项目总数</span><strong>{projects.length}</strong></div>
      <div><span>等待审核</span><strong>{projects.filter((p) => p.state === 'AWAITING_REVIEW').length}</strong></div>
      <div><span>已批准</span><strong>{projects.filter((p) => p.state === 'APPROVED').length}</strong></div>
      <p>Project、TemplateBinding 和初始化状态均来自控制平面。</p></section>
    <div className="section-heading"><div><span>PROJECT CATALOG</span><h2>真实项目</h2></div>
      <Button variant="ghost" size="sm" onClick={onRefresh}><RefreshCw aria-hidden="true" />刷新</Button></div>
    {loading && <section className="project-skeleton" aria-label="正在加载项目目录">{[1, 2, 3].map((item) => <Skeleton key={item} />)}</section>}
    {error && <Alert variant="destructive"><AlertTitle>项目目录加载失败</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    {!loading && !error && projects.length === 0 && <Card className="empty-projects"><CardContent>
      <FolderOpen aria-hidden="true" /><h2>还没有项目</h2><p>创建第一个项目，控制平面会记录完整初始化证据。</p>
      <Button onClick={() => setCreating(true)}><Plus aria-hidden="true" />创建项目</Button>
    </CardContent></Card>}
    {!loading && projects.length > 0 && <section className="project-list">{projects.map((project) => <button
      className="project-row" data-testid={`project-${project.project_id}`} key={project.project_id} onClick={() => onOpen(project)}>
      <span className="project-avatar">{project.name.slice(0, 1)}</span>
      <span className="project-identity"><strong>{project.name}</strong><small>{project.project_id}</small></span>
      <span className="project-stage"><small>模板</small><strong>{project.template_id}@{project.template_version}</strong></span>
      <span className="project-progress"><small>{project.workspace_path}</small></span>
      <ProjectStatusBadge state={project.state} />
      <ArrowRight className="row-arrow" aria-hidden="true" />
    </button>)}</section>}
  </main>;
};
