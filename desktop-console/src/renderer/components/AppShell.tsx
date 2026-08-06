import type { ReactNode } from 'react';
import { Activity, Factory, FolderKanban, Gauge, RefreshCw, TriangleAlert, UserRound } from 'lucide-react';
import type { CapacityBoard } from '@/api/types';
import type { ControlPlaneStatus } from '../../shared/contracts';
import { ControlPlaneStatusBadge } from './status-badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger,
} from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

export type View = 'projects' | 'attention' | 'operations' | 'workspace' | 'initialization';

const navItems: Array<{
  id: Exclude<View, 'workspace' | 'initialization'>;
  label: string;
  icon: typeof FolderKanban;
}> = [
  { id: 'projects', label: '项目', icon: FolderKanban },
  { id: 'attention', label: '待处理', icon: TriangleAlert },
  { id: 'operations', label: '运行', icon: Activity },
];

export const AppShell = ({
  view, status, capacity, onNavigate, onRefresh, children,
}: {
  view: View;
  status: ControlPlaneStatus;
  capacity: CapacityBoard | null;
  onNavigate: (view: View) => void;
  onRefresh: () => void;
  children: ReactNode;
}) => {
  const activeCount = capacity?.active_count;
  const maximum = capacity?.budget.max_concurrent_runs;
  const waitingCount = capacity?.waiting_runs.length;

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" className="factory-sidebar">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" onClick={() => onNavigate('projects')} tooltip="返回项目">
                <span className="factory-mark"><Factory aria-hidden="true" /></span>
                <span className="factory-brand"><strong>Factory</strong><small>交付控制台</small></span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu aria-label="主导航">
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={view === item.id}
                      onClick={() => onNavigate(item.id)}
                      tooltip={item.label}
                    >
                      <item.icon aria-hidden="true" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" tooltip="操作员 · 最终裁决人">
                <span className="operator-avatar"><UserRound aria-hidden="true" /></span>
                <span className="factory-brand"><strong>操作员</strong><small>最终裁决人</small></span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="app-body">
        <header className="command-bar">
          <div className="command-context">
            <SidebarTrigger aria-label="折叠导航" />
            <div><span>CONTROL PLANE</span><strong>本地控制平面</strong></div>
          </div>
          <div className="command-actions">
            <Sheet>
              <SheetTrigger asChild><Button variant="outline" size="sm">
                <Gauge aria-hidden="true" />
                {capacity ? `执行容量 ${activeCount} / ${maximum}` : '执行容量未加载'}
                {capacity && waitingCount ? <Badge variant="secondary">{waitingCount} 个排队</Badge> : null}
              </Button></SheetTrigger>
              <SheetContent className="capacity-drawer">
                <SheetHeader><SheetTitle>执行容量</SheetTitle><SheetDescription>来自 Spring Boot 调度器的当前只读快照。</SheetDescription></SheetHeader>
                <dl><div><dt>活动 Run</dt><dd>{activeCount ?? '未提供'}</dd></div><div><dt>并发预算</dt><dd>{maximum ?? '未提供'}</dd></div>
                  <div><dt>单项目配额</dt><dd>{capacity?.budget.per_project_quota ?? '未提供'}</dd></div><div><dt>等待队列</dt><dd>{waitingCount ?? '未提供'}</dd></div></dl>
                <div className="capacity-drawer-queue"><span className="panel-kicker">WAITING RUNS</span>
                  {capacity?.waiting_runs.length ? <ol>{capacity.waiting_runs.map((run) => <li key={run}>{run}</li>)}</ol> : <p>当前没有容量等待项。</p>}</div>
                <SheetClose asChild><Button variant="outline" onClick={() => onNavigate('operations')}>查看完整运行中心</Button></SheetClose>
              </SheetContent>
            </Sheet>
            <ControlPlaneStatusBadge status={status} />
            <Button variant="ghost" size="icon-sm" onClick={onRefresh} aria-label="重新检查控制平面">
              <RefreshCw aria-hidden="true" />
            </Button>
          </div>
        </header>
        {children}
      </SidebarInset>
      <Toaster position="bottom-right" richColors />
    </SidebarProvider>
  );
};
