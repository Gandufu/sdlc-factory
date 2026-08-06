import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, GitCommitHorizontal, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { InitializationApprovalInput, InitializationOperation, ProjectSummary } from '@/api/types';
import { EvidenceRail, type EvidenceRailNode } from '@/components/EvidenceRail';
import { ProjectStatusBadge } from '@/components/status-badges';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const operationLabel = (operation: string) => ({
  INSTANTIATE: '生成文件', BOOTSTRAP: '引导准备', VALIDATE: '结构校验', COMPILE: '编译检查',
  BUILD: '构建检查', TEST: '单元测试', START: '启动', READINESS: '就绪检查', STOP: '停止清理',
}[operation] ?? operation);

const operationState = (operation: InitializationOperation): EvidenceRailNode['state'] => {
  if (operation.status === 'FAILED' || operation.test_outcome === 'FAILED') return 'failed';
  if (operation.status === 'SUCCEEDED') return 'complete';
  if (operation.status === 'RUNNING') return 'active';
  return 'waiting';
};

const operationMeta = (operation: InitializationOperation) => [
  operation.status,
  operation.test_outcome && `测试 ${operation.test_outcome}`,
  operation.exit_code !== undefined && `退出码 ${operation.exit_code}`,
  operation.runtime_id && `Runtime ${operation.runtime_id}`,
  operation.content_hash && `Hash ${operation.content_hash}`,
  operation.completed_at && `完成 ${operation.completed_at}`,
].filter(Boolean).join(' · ') || '未提供';

export const InitializationPage = ({ project, onBack, onApprove }: {
  project: ProjectSummary;
  onBack: () => void;
  onApprove: (projectId: string, input: InitializationApprovalInput) => Promise<ProjectSummary>;
}) => {
  const [reviewer, setReviewer] = useState('gandaofu');
  const [comments, setComments] = useState('');
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const nodes = useMemo(() => (project.operations ?? []).map((operation, index): EvidenceRailNode => ({
    id: `${operation.operation}-${index}`,
    label: operationLabel(operation.operation),
    meta: operationMeta(operation),
    state: operationState(operation),
  })), [project.operations]);

  const approve = async () => {
    if (!reviewer.trim() || !comments.trim()) return;
    setApproving(true); setApprovalError(undefined);
    try {
      await onApprove(project.project_id, { reviewer_identity: reviewer.trim(), comments: comments.trim() });
      setDialogOpen(false);
    } catch (cause) {
      setApprovalError(cause instanceof Error ? cause.message : '初始化批准失败');
    } finally { setApproving(false); }
  };

  return <main className="page initialization-page">
    <Button variant="ghost" className="back-button" onClick={onBack}><ArrowLeft aria-hidden="true" />项目</Button>
    <header className="page-heading compact"><div><span className="live-badge">INITIALIZATION EVIDENCE</span>
      <h1>{project.name}</h1><p>{project.project_id} · {project.template_id}@{project.template_version}</p></div>
      <ProjectStatusBadge state={project.state} />
    </header>
    <div className="initialization-layout">
      <section className="initialization-card"><header><div><span className="panel-kicker">AUTHORITATIVE FACTS</span><h2>初始化绑定</h2></div>
        <GitCommitHorizontal aria-hidden="true" /></header>
        <dl><div><dt>状态</dt><dd>{project.state}</dd></div><div><dt>工作目录</dt><dd>{project.workspace_path}</dd></div>
          <div><dt>初始 Git revision</dt><dd>{project.initial_git_revision ?? '未提供'}</dd></div>
          <div><dt>模板标识</dt><dd>{project.template_id}@{project.template_version}</dd></div>
          <div><dt>模板摘要</dt><dd>{project.template_digest ?? '未提供'}</dd></div></dl>
        {project.failure_detail && <Alert variant="destructive"><ShieldAlert aria-hidden="true" /><AlertTitle>初始化失败</AlertTitle><AlertDescription>{project.failure_detail}</AlertDescription></Alert>}
      </section>
      <section className="initialization-card evidence-card"><header><div><span className="panel-kicker">EXECUTION EVIDENCE</span><h2>初始化运行证据</h2></div>
        <ShieldCheck aria-hidden="true" /></header>
        {nodes.length ? <EvidenceRail nodes={nodes} /> : <Alert><AlertTitle>尚无运行证据</AlertTitle><AlertDescription>控制平面尚未返回 InitializationOperation。</AlertDescription></Alert>}
      </section>
    </div>
    <section className="initialization-decision">
      {project.state === 'AWAITING_REVIEW' && <>
        <div><span className="panel-kicker">HUMAN REVIEW</span><h2>等待人工审核</h2><p>批准会绑定当前 Git revision、模板摘要和全部运行证据，形成不可原地修改的初始化基线。</p></div>
        <AlertDialog open={dialogOpen} onOpenChange={(open) => { if (!approving) setDialogOpen(open); }}>
          <AlertDialogTrigger asChild><Button size="lg"><ShieldCheck aria-hidden="true" />批准初始化并形成基线</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>批准项目初始化？</AlertDialogTitle>
              <AlertDialogDescription>批准后会生成 ReviewRecord 与初始化 Baseline。请记录审核身份和批准依据。</AlertDialogDescription></AlertDialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2"><Label htmlFor="reviewer">审核人</Label><Input id="reviewer" value={reviewer} disabled={approving} onChange={(event) => setReviewer(event.target.value)} /></div>
              <div className="grid gap-2"><Label htmlFor="review-comments">审核说明</Label><textarea id="review-comments" value={comments} disabled={approving}
                onChange={(event) => setComments(event.target.value)} placeholder="说明已核对的模板、Git 修订和初始化证据。" /></div>
              {approvalError && <Alert variant="destructive"><AlertTitle>批准失败</AlertTitle><AlertDescription>{approvalError}</AlertDescription></Alert>}
            </div>
            <AlertDialogFooter><AlertDialogCancel disabled={approving}>取消</AlertDialogCancel>
              <Button disabled={approving || !reviewer.trim() || !comments.trim()} onClick={() => void approve()}>
                {approving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
                {approving ? '正在批准' : '确认批准并形成基线'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>}
      {project.state === 'APPROVED' && <Alert className="baseline-success"><CheckCircle2 aria-hidden="true" /><AlertTitle>初始化基线已形成</AlertTitle>
        <AlertDescription>当前项目初始化已批准；后续交付必须引用该权威初始化事实。</AlertDescription></Alert>}
      {project.state === 'FAILED' && <Alert variant="destructive"><ShieldAlert aria-hidden="true" /><AlertTitle>不能批准失败的初始化</AlertTitle>
        <AlertDescription>保留失败证据并修复环境后重新创建项目初始化，不得把失败投影标记为已批准。</AlertDescription></Alert>}
    </section>
  </main>;
};
