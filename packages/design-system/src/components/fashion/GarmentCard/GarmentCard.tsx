'use client';

/**
 * GarmentCard — image, name, price, backing progress if Back It campaign.
 * Hover reveals quick-back CTA.
 * Elevation-based, no borders.
 */

import React, { useState, type ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import { Badge } from '../../primitives/Badge';
import { Button } from '../../primitives/Button';

export interface GarmentCardProps {
  id: string;
  name: string;
  brand?: string;
  price: number;
  currency?: string;
  imageUrl?: string;
  /** If present, shows Back It campaign progress */
  campaign?: {
    backerCount: number;
    moq: number;
    backerPrice: number;
    daysLeft?: number;
  };
  /** Sold out / unavailable */
  unavailable?: boolean;
  /** Show Back It badge */
  isBackIt?: boolean;
  onQuickBack?: (id: string) => void;
  onClick?: (id: string) => void;
  linkComponent?: React.ElementType;
  href?: string;
  className?: string;
}

function formatPrice(price: number, currency = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export function GarmentCard({
  id,
  name,
  brand,
  price,
  currency = 'AUD',
  imageUrl,
  campaign,
  unavailable = false,
  isBackIt = false,
  onQuickBack,
  onClick,
  linkComponent: LinkComponent,
  href,
  className,
}: GarmentCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const progress = campaign ? Math.min(100, (campaign.backerCount / campaign.moq) * 100) : 0;

  const Wrapper = ({ children }: { children: ReactNode }) => {
    if (href && LinkComponent) {
      return (
        <LinkComponent href={href} className="contents">
          {children}
        </LinkComponent>
      );
    }
    return <>{children}</>;
  };

  return (
    <Wrapper>
      <article
        className={cn(
          'group relative flex flex-col',
          'bg-surface-1 rounded-lg overflow-hidden',
          'shadow-1 hover:shadow-3',
          'transition-all duration-normal ease-standard',
          'hover:-translate-y-1',
          (onClick || href) && 'cursor-pointer',
          unavailable && 'opacity-70',
          className,
        )}
        onClick={() => onClick?.(id)}
        onKeyDown={(e) => { if (e.key === 'Enter') onClick?.(id); }}
        tabIndex={onClick ? 0 : undefined}
        role={onClick ? 'button' : 'article'}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label={`${name}${brand ? ` by ${brand}` : ''}, ${formatPrice(price, currency)}`}
      >
        {/* Image */}
        <div className="relative aspect-[3/4] bg-surface-2 overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              className={cn(
                'w-full h-full object-cover',
                'transition-transform duration-slow ease-standard',
                'group-hover:scale-105',
              )}
              loading="lazy"
            />
          ) : (
            // Placeholder when no image
            <div className="w-full h-full flex items-center justify-center bg-surface-2">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden>
                <path
                  d="M14 10L7 20l4 2V42h26V22l4-2L34 10c-1 4-4 6-10 6s-9-2-10-6z"
                  fill="currentColor" opacity="0.10"
                  stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.20"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}

          {/* Badges overlay */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {isBackIt && (
              <Badge variant="accent" size="sm">Back It</Badge>
            )}
            {unavailable && (
              <Badge variant="neutral" size="sm">Sold Out</Badge>
            )}
            {campaign?.daysLeft !== undefined && campaign.daysLeft <= 3 && (
              <Badge variant="warning" size="sm" dot>
                {campaign.daysLeft}d left
              </Badge>
            )}
          </div>

          {/* Quick-back CTA — appears on hover */}
          {onQuickBack && !unavailable && campaign && (
            <div
              className={cn(
                'absolute inset-x-0 bottom-0 p-3',
                'bg-gradient-to-t from-black/60 to-transparent',
                'transition-opacity duration-fast ease-standard',
                isHovered ? 'opacity-100' : 'opacity-0',
              )}
              aria-hidden={!isHovered}
            >
              <Button
                variant="accent"
                size="sm"
                fullWidth
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickBack(id);
                }}
              >
                Back This Style
              </Button>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-2 p-3">
          {brand && (
            <p className="text-xs text-text-tertiary font-body tracking-wide uppercase">
              {brand}
            </p>
          )}
          <h3 className="text-sm font-semibold text-text-primary font-body leading-tight line-clamp-2">
            {name}
          </h3>

          {/* Price */}
          <div className="flex items-baseline gap-2">
            {campaign ? (
              <>
                <span className="text-base font-bold text-text-primary font-body">
                  {formatPrice(campaign.backerPrice, currency)}
                </span>
                <span className="text-xs text-text-tertiary line-through font-body">
                  {formatPrice(price, currency)}
                </span>
              </>
            ) : (
              <span className="text-base font-bold text-text-primary font-body">
                {formatPrice(price, currency)}
              </span>
            )}
          </div>

          {/* Campaign progress */}
          {campaign && (
            <div className="flex flex-col gap-1.5">
              {/* Progress bar */}
              <div className="w-full h-1.5 rounded-full bg-surface-3 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-slow ease-standard',
                    progress >= 100 ? 'bg-success' : 'bg-accent',
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-text-secondary font-body">
                <span className="font-semibold text-text-primary">
                  {campaign.backerCount}
                </span>
                {' '}of{' '}
                <span className="font-semibold">
                  {campaign.moq}
                </span>
                {' '}backers
              </p>
            </div>
          )}
        </div>
      </article>
    </Wrapper>
  );
}
