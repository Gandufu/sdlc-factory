import { useMemo, useState } from 'react';
import { Archive, ArrowLeft, Bot, GitBranch, Loader2, MessageSquarePlus, Plus, RotateCcw, Send, ShieldCheck } from 'lucide-react';
import type { GateProjection, SessionSummary } from '@/api/types';
import { useWorkspace } from '@/hooks/useWorkspace';
import { GateStatusBadge, RunStatusBadge } from '@/components/status-badges';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const lifecycleLabels: Record<string, string> = {
  INITIALIZATION: '初始化', REQUIREMENT: '项目需求', DESIGN: '总体设计',
  CODING: '编码', TESTING: '测试', SYSTEM_ACCEPTANCE: '系统验收',
};

const SessionRow = ({ item, selected, onSelect }: {
  item: SessionSummary; selected: boolean; onSelect: () => void;
}) => <button className={cn('session-row', selected && 'selected', item.archived && 'archived')}
  style={{ paddingLeft: item.parent_session_id ? 30 : 12 }} onClick={onSelect}>
  {item.parent_session_id ? <GitBranch aria-hidden="true" /> : <Bot aria-hidden="true" />}
  <span><strong>{item.title}</strong><small>{item.state} · {item.run_ids.length} Runs</small></span>
</button>;

const GateReview = ({ gate, busy, onDecide }: {
  gate: GateProjection;
  busy: boolean;
  onDecide: (action: 'approve' | 'request-changes', reviewer: string, comments: string) => void;
}) => {
  const [reviewer, setReviewer] = useState('gandaofu');
  const [comments, setComments] = useState('');
  return <article className="workspace-gate">
    <header><div><span className="panel-kicker">HUMAN GATE</span><h3>{gate.gate_type}</h3></div><GateStatusBadge state={gate.status} /></header>
    <dl><div><dt>Gate ID</dt><dd>{gate.gate_id}</dd></div><div><dt>Run</dt><dd>{gate.run_id}</dd></div>
      <div><dt>候选产物</dt><dd>{gate.candidate_artifacts[0]?.artifact_ref ?? '未提供'}</dd></div>
      <div><dt>确定性检查</dt><dd>{gate.deterministic_checks.length} 项</dd></div>
      <div><dt>Evidence</dt><dd>{gate.evidence.length} 项</dd></div></dl>
    {gate.handoff && <details><summary>结构化 Handoff</summary><pre>{gate.handoff.payload}</pre></details>}
    {gate.status === 'WAITING' && <div className="gate-decision-form">
      <div><Label htmlFor={`reviewer-${gate.gate_id}`}>审核人</Label><Input id={`reviewer-${gate.gate_id}`} value={reviewer} onChange={(event) => setReviewer(event.target.value)} /></div>
      <div><Label htmlFor={`comments-${gate.gate_id}`}>审核说明</Label><textarea id={`comments-${gate.gate_id}`} value={comments} onChange={(event) => setComments(event.target.value)} /></div>
      <footer><Button variant="outline" disabled={busy || !reviewer.trim() || !comments.trim()} onClick={() => onDecide('request-changes', reviewer, comments)}>退回修订</Button>
        <Button disabled={busy || !reviewer.trim() || !comments.trim()} onClick={() => onDecide('approve', reviewer, comments)}><ShieldCheck />批准 Gate</Button></footer>
    </div>}
  </article>;
};

export const WorkspacePage = ({ projectId, onBack }: { projectId: string; onBack: () => void }) => {
  const model = useWorkspace(projectId);
  const [message, setMessage] = useState('');
  const sessions = useMemo(() => model.workspace?.sessions ?? [], [model.workspace?.sessions]);

  if (model.loading && !model.workspace) return <main className="workspace-loading"><Loader2 className="animate-spin" /><span>读取项目工作区权威投影</span></main>;
  if (!model.workspace) return <main className="page"><Alert variant="destructive"><AlertTitle>项目工作区加载失败</AlertTitle><AlertDescription>{model.error}</AlertDescription></Alert><Button onClick={() => void model.refresh()}>重试</Button></main>;

  const { project, lifecycle, configuration, baselines } = model.workspace;
  const canSend = model.session?.current && !model.session.archived && model.session.state === 'ACTIVE';
  return <main className="workspace-page production-workspace">
    <header className="workspace-header">
      <Button variant="ghost" onClick={onBack}><ArrowLeft />项目</Button>
      <div><span className="live-badge"><i />权威项目工作区</span><h1>{project.name}</h1><p>{project.project_id} · {project.template_id}@{project.template_version}</p></div>
      <span className="workspace-attention">{model.workspace.attention_count} 个待裁决 Gate</span>
    </header>
    {model.error && <Alert variant="destructive"><AlertTitle>工作区命令失败</AlertTitle><AlertDescription>{model.error}</AlertDescription></Alert>}
    <div className="continuous-workspace-grid">
      <aside className="session-sidebar">
        <div className="session-project"><strong>{project.name}</strong><small>{project.workspace_path}</small><span><GitBranch />{project.initial_git_revision ?? '未提供 Git revision'}</span></div>
        <div className="session-actions"><Button size="sm" onClick={() => void model.createSession()} disabled={model.busy}><Plus />新建</Button>
          <Button size="sm" variant="outline" onClick={() => void model.createSession(model.session?.session_id)} disabled={model.busy || !model.session}><MessageSquarePlus />Child</Button></div>
        <ScrollArea className="session-tree">{sessions.map((item) => <SessionRow key={item.session_id} item={item}
          selected={item.session_id === model.session?.session_id} onSelect={() => void model.selectSession(item.session_id)} />)}</ScrollArea>
        {model.session && <Button variant="ghost" size="sm" disabled={model.busy || model.session.archived} onClick={() => void model.archiveSession()}><Archive />归档当前会话</Button>}
      </aside>

      <section className="session-main">
        <header><div><span className="panel-kicker">FACTORY SESSION</span><h2>{model.session?.title ?? '尚未创建会话'}</h2></div>
          {model.session && <RunStatusBadge state={model.session.state === 'WAITING' ? 'WAITING_FOR_HUMAN' : model.session.state} />}</header>
        <ScrollArea className="message-stream">
          {!model.session ? <div className="workspace-empty"><Bot /><h3>创建第一个持续会话</h3><p>Factory Session 可关联多个不可变 Run；每次发送消息都会新建 Run。</p></div>
            : model.session.messages.map((item) => <article className={cn('session-message', item.role.toLowerCase())} key={item.message_id}>
              <header><strong>{item.role}</strong>{item.run_id && <span>{item.run_id}</span>}<time>{item.created_at}</time></header>
              <pre>{item.content}</pre>
            </article>)}
          {model.session?.gates.map((gate) => <GateReview key={gate.gate_id} gate={gate} busy={model.busy}
            onDecide={(action, reviewer, comments) => void model.decideGate(gate.gate_id, action, gate.expected_version, reviewer, comments)} />)}
        </ScrollArea>
        <div className="session-composer"><textarea aria-label="持续会话消息" value={message} onChange={(event) => setMessage(event.target.value)}
          disabled={!canSend || model.busy} placeholder={canSend ? '补充上下文并创建新的 Run…' : '历史或归档会话只读'} />
          <Button disabled={!canSend || model.busy || !message.trim()} onClick={() => { void model.send(message.trim()); setMessage(''); }}>
            {model.busy ? <Loader2 className="animate-spin" /> : <Send />}发送并创建 Run</Button></div>
      </section>

      <aside className="workspace-context">
        <Tabs defaultValue="lifecycle"><TabsList><TabsTrigger value="lifecycle">生命周期</TabsTrigger><TabsTrigger value="evidence">Evidence</TabsTrigger><TabsTrigger value="config">配置</TabsTrigger></TabsList>
          <TabsContent value="lifecycle"><ol className="workspace-lifecycle">{lifecycle.map((stage) => <li key={stage.stage} data-state={stage.status}><i />
            <span><strong>{lifecycleLabels[stage.stage] ?? stage.stage}</strong><small>{stage.status}</small></span></li>)}</ol>
            <div className="baseline-list"><span className="panel-kicker">BASELINES</span>{baselines.length ? baselines.map((baseline, index) => <code key={index}>{String(baseline.baseline_id)}</code>) : <p>尚无项目级基线</p>}</div></TabsContent>
          <TabsContent value="evidence"><div className="artifact-list">{model.session?.artifacts.length ? model.session.artifacts.map((artifact) => <article key={artifact.artifact_id}><strong>{artifact.artifact_type}</strong><code>{artifact.artifact_id}</code><small>{artifact.content_hash}</small></article>) : <p>当前会话尚无 Evidence 或 Handoff。</p>}</div>
            {model.session?.runs.filter((run) => ['BLOCKED', 'FAILED', 'TIMED_OUT'].includes(run.status)).map((run) => <Button key={run.run_id} variant="outline" disabled={model.busy || !canSend} onClick={() => void model.recover(run.run_id)}><RotateCcw />复检后创建新 Run</Button>)}</TabsContent>
          <TabsContent value="config"><div className="config-summary"><span>配置健康</span><strong>{configuration.health}</strong><span>权限策略</span><p>{configuration.permission_policy}</p>
            <span>Agents</span><strong>{configuration.agents.length}</strong><span>运行时绑定</span><strong>{configuration.runtime_bindings.length}</strong>
            <span>Skills / MCP / Plugins</span><p>{configuration.skills.length} / {configuration.mcp.length} / {configuration.plugins.length}</p></div></TabsContent>
        </Tabs>
      </aside>
    </div>
  </main>;
};
