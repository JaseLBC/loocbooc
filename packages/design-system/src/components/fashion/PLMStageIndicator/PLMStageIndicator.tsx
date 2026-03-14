/**
 * PLMStageIndicator — visual production pipeline.
 * Current stage highlighted. Completed stages show checkmarks.
 */

import React from 'react';
import { cn } from '../../../utils/cn';

export interface PLMStage {
  id: string;
  label: string;
  /** Short description */
  description?: string;
}

export type PLMStageStatus = 'complete' | 'current' | 'upcoming' | 'blocked';

export interface PLMStageIndicatorProps {
  stages: PLMStage[];
  currentStageId: string;
  /** Override status for specific stages */
  stageStatuses?: Record<string, PLMStageStatus>;
  /** Orientation */
  orientation?: 'horizontal' | 'vertical';
  /** Show descriptions */
  showDescriptions?: boolean;
  className?: string;
}

const stageStatusColors: Record<PLMStageStatus, string> = {
  complete:  'bg-success text-white',
  current:   'bg-black text-white dark:bg-white dark:text-black',
  upcoming:  'bg-surface-3 text-text-tertiary',
  blocked:   'bg-error text-white',
};

const connectorColors: Record<PLMStageStatus, string> = {
  complete:  'bg-success',
  current:   'bg-surface-3',
  upcoming:  'bg-surface-3',
  blocked:   'bg-error',
};

export function PLMStageIndicator({
  stages,
  currentStageId,
  stageStatuses,
  orientation = 'horizontal',
  showDescriptions = false,
  className,
}: PLMStageIndicatorProps) {
  const currentIndex = stages.findIndex((s) => s.id === currentStageId);

  function getStatus(stage: PLMStage, index: number): PLMStageStatus {
    if (stageStatuses?.[stage.id]) return stageStatuses[stage.id];
    if (index < currentIndex) return 'complete';
    if (index === currentIndex) return 'current';
    return 'upcoming';
  }

  if (orientation === 'vertical') {
    return (
      <ol
        className={cn('flex flex-col', className)}
        aria-label="Production pipeline"
      >
        {stages.map((stage, index) => {
          const status = getStatus(stage, index);
          const isLast = index === stages.length - 1;

          return (
            <li key={stage.id} className="flex gap-4">
              {/* Node + connector */}
              <div className="flex flex-col items-center">
                <StageNode status={status} label={(index + 1).toString()} />
                {!isLast && (
                  <div
                    className={cn(
                      'w-0.5 flex-1 min-h-[24px]',
                      connectorColors[status === 'complete' ? 'complete' : 'upcoming'],
                    )}
                    aria-hidden="true"
                  />
                )}
              </div>

              {/* Text */}
              <div className={cn('pb-6', isLast && 'pb-0')}>
                <p className={cn(
                  'text-sm font-medium font-body',
                  status === 'current' ? 'text-text-primary' : 'text-text-secondary',
                )}>
                  {stage.label}
                </p>
                {showDescriptions && stage.description && (
                  <p className="text-xs text-text-tertiary font-body mt-0.5">
                    {stage.description}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  // Horizontal (default)
  return (
    <div className={cn('w-full', className)}>
      <ol
        className="flex items-start justify-between"
        aria-label="Production pipeline"
      >
        {stages.map((stage, index) => {
          const status = getStatus(stage, index);
          const isLast = index === stages.length - 1;

          return (
            <li
              key={stage.id}
              className={cn(
                'flex flex-col items-center',
                !isLast && 'flex-1',
              )}
              aria-current={status === 'current' ? 'step' : undefined}
            >
              {/* Node + connector row */}
              <div className="flex items-center w-full">
                <StageNode status={status} label={(index + 1).toString()} />
                {!isLast && (
                  <div
                    className={cn(
                      'flex-1 h-0.5',
                      connectorColors[status === 'complete' ? 'complete' : 'upcoming'],
                      'transition-colors duration-normal ease-standard',
                    )}
                    aria-hidden="true"
                  />
                )}
              </div>

              {/* Label below */}
              <div className="mt-2 text-center max-w-[80px]">
                <p className={cn(
                  'text-xs font-medium font-body leading-tight',
                  status === 'current' ? 'text-text-primary' : 'text-text-secondary',
                  status === 'blocked' && 'text-error',
                )}>
                  {stage.label}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StageNode({ status, label }: { status: PLMStageStatus; label: string }) {
  return (
    <span
      className={cn(
        'flex-shrink-0 flex items-center justify-center',
        'w-8 h-8 rounded-full',
        'text-xs font-bold font-body',
        'transition-all duration-normal ease-spring',
        stageStatusColors[status],
        status === 'current' && 'ring-4 ring-black/10 dark:ring-white/10',
      )}
    >
      {status === 'complete' ? (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path d="M2.5 7L6 10.5L11.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : status === 'blocked' ? (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : (
        label
      )}
    </span>
  );
}
