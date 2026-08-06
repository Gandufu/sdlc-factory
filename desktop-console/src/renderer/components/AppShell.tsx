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
            <Button variant="outline" size="sm" onClick={() => onNavigate('operations')}>
              <Gauge aria-hidden="true" />
              {capacity ? `执行容量 ${activeCount} / ${maximum}` : '执行容量未加载'}
              {capacity && waitingCount ? <Badge variant="secondary">{waitingCount} 个排队</Badge> : null}
            </Button>
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

export const FixtureBadge = () => <Badge variant="outline">演示快照 · 不可执行</Badge>;
