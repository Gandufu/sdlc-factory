import { Check, Circle, Clock3, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type EvidenceRailNode = {
  id: string;
  label: string;
  meta?: string;
  state: 'complete' | 'active' | 'waiting' | 'failed';
};

export const EvidenceRail = ({ nodes, className }: { nodes: EvidenceRailNode[]; className?: string }) => (
  <ol className={cn('evidence-rail', className)} aria-label="交付证据轨道">
    {nodes.map((node) => {
      const Icon = node.state === 'complete' ? Check : node.state === 'failed' ? X : node.state === 'waiting' ? Clock3 : Circle;
      return (
        <li key={node.id} data-state={node.state}>
          <span className="evidence-node"><Icon aria-hidden="true" /></span>
          <span><strong>{node.label}</strong><small>{node.meta ?? '未提供'}</small></span>
        </li>
      );
    })}
  </ol>
);
