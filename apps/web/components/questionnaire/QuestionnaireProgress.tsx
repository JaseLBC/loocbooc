'use client'

import React from 'react'

interface QuestionnaireProgressProps {
  current: number        // 0-based index
  total: number
  sectionName?: string
  timeRemaining?: string
  variant?: 'bar' | 'dots'
}

export function QuestionnaireProgress({
  current,
  total,
  sectionName,
  timeRemaining,
  variant = 'bar',
}: QuestionnaireProgressProps) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0

  if (variant === 'dots') {
    return (
      <div className="looc-progress-dots" role="progressbar" aria-valuenow={current + 1} aria-valuemin={1} aria-valuemax={total}>
        <div className="looc-dots-row">
          {Array.from({ length: total }, (_, i) => (
            <div
              key={i}
              className={`looc-dot ${i === current ? 'looc-dot--active' : ''} ${i < current ? 'looc-dot--complete' : ''}`}
            />
          ))}
        </div>
        <div className="looc-progress-meta">
          <span className="looc-progress-count">{current + 1} / {total}</span>
          {timeRemaining && <span className="looc-progress-time">{timeRemaining}</span>}
        </div>

        <style>{`
          .looc-progress-dots {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
          }

          .looc-dots-row {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            justify-content: center;
            max-width: 280px;
          }

          .looc-dot {
            width: 8px;
            height: 8px;
            border-radius: var(--radius-full, 9999px);
            background: var(--surface-3, #ebebeb);
            transition: all var(--duration-normal, 250ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
            flex-shrink: 0;
          }

          .looc-dot--complete {
            background: var(--text-tertiary, #9ca3af);
            transform: scale(0.85);
          }

          .looc-dot--active {
            background: var(--loocbooc-black, #0a0a0a);
            transform: scale(1.3);
            box-shadow: 0 0 0 3px rgba(10, 10, 10, 0.15);
          }

          .looc-progress-meta {
            display: flex;
            gap: 12px;
            align-items: center;
          }

          .looc-progress-count {
            font-family: Inter, -apple-system, sans-serif;
            font-size: 13px;
            font-weight: 500;
            color: var(--text-secondary, #6b7280);
          }

          .looc-progress-time {
            font-family: Inter, -apple-system, sans-serif;
            font-size: 12px;
            font-weight: 400;
            color: var(--text-tertiary, #9ca3af);
          }
        `}</style>
      </div>
    )
  }

  // Bar variant (default for form mode)
  return (
    <div className="looc-progress-bar-wrap" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Questionnaire progress">
      <div className="looc-progress-top">
        <div className="looc-progress-text">
          {sectionName && <span className="looc-progress-section">{sectionName}</span>}
          <span className="looc-progress-fraction">{current + 1} / {total}</span>
        </div>
        {timeRemaining && (
          <span className="looc-progress-time-bar">{timeRemaining}</span>
        )}
      </div>
      <div className="looc-bar-track">
        <div
          className="looc-bar-fill"
          style={{ width: `${percent}%` }}
        />
      </div>

      <style>{`
        .looc-progress-bar-wrap {
          width: 100%;
        }

        .looc-progress-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .looc-progress-text {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .looc-progress-section {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: var(--loocbooc-black, #0a0a0a);
          letter-spacing: 0.01em;
        }

        .looc-progress-fraction {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 12px;
          font-weight: 400;
          color: var(--text-tertiary, #9ca3af);
        }

        .looc-progress-time-bar {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 12px;
          font-weight: 400;
          color: var(--text-tertiary, #9ca3af);
        }

        .looc-bar-track {
          width: 100%;
          height: 3px;
          background: var(--surface-3, #ebebeb);
          border-radius: var(--radius-full, 9999px);
          overflow: hidden;
        }

        .looc-bar-fill {
          height: 100%;
          background: var(--loocbooc-black, #0a0a0a);
          border-radius: var(--radius-full, 9999px);
          transition: width var(--duration-slow, 400ms) var(--ease-decelerate, cubic-bezier(0, 0, 0.2, 1));
          transform-origin: left;
        }
      `}</style>
    </div>
  )
}
