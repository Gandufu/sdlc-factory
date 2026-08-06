import { AlertTriangle, CheckCircle2, CircleDot, Clock3, ShieldCheck, XCircle } from 'lucide-react';
import type { ControlPlaneStatus } from '../../shared/contracts';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Tone = 'ready' | 'running' | 'waiting' | 'blocked' | 'muted';

const toneClass: Record<Tone, string> = {
  ready: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  running: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  waiting: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  blocked: 'border-red-500/30 bg-red-500/10 text-red-300',
  muted: 'border-border bg-muted text-muted-foreground',
};

const icons = {
  ready: CheckCircle2,
  running: CircleDot,
  waiting: Clock3,
  blocked: XCircle,
  muted: AlertTriangle,
} satisfies Record<Tone, typeof CheckCircle2>;

export const StatusBadge = ({ label, tone = 'muted', className }: {
  label: string;
  tone?: Tone;
  className?: string;
}) => {
  const Icon = icons[tone];
  return <Badge variant="outline" className={cn('gap-1.5', toneClass[tone], className)}><Icon />{label}</Badge>;
};

export const ControlPlaneStatusBadge = ({ status }: { status: ControlPlaneStatus }) => (
  <span data-testid="control-plane-health">
    <StatusBadge label={status.state === 'ready' ? '控制平面已就绪' : '控制平面未连接'} tone={status.state === 'ready' ? 'ready' : 'blocked'} />
  </span>
);

export const RunStatusBadge = ({ state }: { state: string }) => {
  const tone: Tone = state === 'RUNNING' ? 'running' : state === 'COMPLETED' || state === 'READY' ? 'ready'
    : state === 'WAITING_FOR_HUMAN' ? 'waiting' : state === 'BLOCKED' ? 'blocked' : 'muted';
  return <StatusBadge label={state} tone={tone} />;
};

export const GateStatusBadge = ({ state }: { state: string }) => (
  <StatusBadge label={state} tone={state === 'APPROVED' ? 'ready' : state === 'CHANGES_REQUESTED' ? 'blocked' : 'waiting'} />
);

export const ProjectStatusBadge = ({ state }: { state: string }) => (
  <StatusBadge label={state === 'AWAITING_REVIEW' ? '等待人工审核' : state === 'APPROVED' ? '已批准' : state === 'FAILED' ? '初始化失败' : state}
    tone={state === 'APPROVED' ? 'ready' : state === 'FAILED' ? 'blocked' : 'waiting'} />
);

export const EvidenceStatusBadge = ({ valid }: { valid: boolean }) => (
  <Badge variant="outline" className={valid ? toneClass.ready : toneClass.blocked}>
    <ShieldCheck />{valid ? '证据有效' : '证据无效'}
  </Badge>
);
