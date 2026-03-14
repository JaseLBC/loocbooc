'use client'

import React, { useEffect, useState } from 'react'
import type { Questionnaire, Answers } from './types'

interface QuestionnaireCompleteProps {
  questionnaire: Questionnaire
  answers: Answers
  onContinue: () => void
  onReview?: () => void
}

export function QuestionnaireComplete({
  questionnaire,
  answers,
  onContinue,
  onReview,
}: QuestionnaireCompleteProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Staggered entrance
    const t = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t)
  }, [])

  // Build a summary of key answers (first answered question per section)
  const summaryItems: Array<{ section: string; question: string; answer: string }> = []

  for (const section of questionnaire.sections) {
    for (const question of section.questions) {
      const val = answers[question.id]
      if (val === undefined || val === null) continue
      if (Array.isArray(val) && val.length === 0) continue

      // Find option labels
      let answerText = ''
      if (Array.isArray(val)) {
        const labels = val
          .map(id => question.options?.find(o => o.id === id)?.label)
          .filter(Boolean) as string[]
        answerText = labels.slice(0, 3).join(', ')
        if (labels.length > 3) answerText += ` +${labels.length - 3} more`
      } else if (typeof val === 'string') {
        const option = question.options?.find(o => o.id === val)
        answerText = option?.label ?? val
      } else {
        answerText = String(val)
      }

      if (answerText) {
        summaryItems.push({
          section: section.title,
          question: question.question,
          answer: answerText,
        })
        break // One key answer per section
      }
    }
  }

  return (
    <div className={`looc-complete ${visible ? 'looc-complete--visible' : ''}`}>
      {/* Celebration mark */}
      <div className="looc-complete-icon-wrap">
        <div className="looc-complete-ring" />
        <div className="looc-complete-check">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M6 16L12.5 22.5L26 9" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Headline */}
      <div className="looc-complete-headline">
        <h2 className="looc-complete-title">That&apos;s everything.</h2>
        <p className="looc-complete-subtitle">
          We&apos;ve got what we need to personalise your Loocbooc experience.
        </p>
      </div>

      {/* Key answers summary */}
      {summaryItems.length > 0 && (
        <div className="looc-complete-summary">
          <p className="looc-complete-summary-label">Here&apos;s what you told us</p>
          <div className="looc-complete-summary-list">
            {summaryItems.map((item, i) => (
              <div
                key={i}
                className="looc-complete-summary-item"
                style={{ animationDelay: `${0.3 + i * 0.08}s` }}
              >
                <span className="looc-complete-summary-section">{item.section}</span>
                <span className="looc-complete-summary-answer">{item.answer}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTAs */}
      <div className="looc-complete-actions">
        <button
          type="button"
          className="looc-complete-btn looc-complete-btn--primary"
          onClick={onContinue}
        >
          Continue to Loocbooc →
        </button>
        {onReview && (
          <button
            type="button"
            className="looc-complete-btn looc-complete-btn--ghost"
            onClick={onReview}
          >
            Review my answers
          </button>
        )}
      </div>

      <style>{`
        .looc-complete {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 48px 24px;
          text-align: center;
          gap: 32px;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity var(--duration-slow, 400ms) var(--ease-decelerate, cubic-bezier(0, 0, 0.2, 1)),
                      transform var(--duration-slow, 400ms) var(--ease-decelerate, cubic-bezier(0, 0, 0.2, 1));
        }

        .looc-complete--visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* Celebration ring */
        .looc-complete-icon-wrap {
          position: relative;
          width: 96px;
          height: 96px;
          flex-shrink: 0;
        }

        .looc-complete-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 3px solid var(--loocbooc-accent, #c8b49a);
          animation: looc-ring-expand 0.6s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) 0.1s both;
        }

        @keyframes looc-ring-expand {
          from { opacity: 0; transform: scale(0.5); }
          to   { opacity: 1; transform: scale(1); }
        }

        .looc-complete-check {
          position: absolute;
          inset: 8px;
          border-radius: 50%;
          background: var(--loocbooc-black, #0a0a0a);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: looc-check-pop 0.5s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) 0.25s both;
        }

        @keyframes looc-check-pop {
          from { opacity: 0; transform: scale(0.4); }
          to   { opacity: 1; transform: scale(1); }
        }

        /* Headline */
        .looc-complete-headline {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-width: 320px;
        }

        .looc-complete-title {
          font-family: 'DM Serif Display', Georgia, serif;
          font-size: 36px;
          font-weight: 400;
          line-height: 1.15;
          color: var(--text-primary, #0a0a0a);
          margin: 0;
        }

        .looc-complete-subtitle {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 16px;
          font-weight: 400;
          line-height: 1.6;
          color: var(--text-secondary, #6b7280);
          margin: 0;
        }

        /* Summary */
        .looc-complete-summary {
          width: 100%;
          max-width: 400px;
          text-align: left;
        }

        .looc-complete-summary-label {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-tertiary, #9ca3af);
          margin: 0 0 12px;
        }

        .looc-complete-summary-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .looc-complete-summary-item {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 16px;
          padding: 12px 16px;
          background: var(--surface-2, #f5f5f5);
          border-radius: var(--radius-md, 8px);
          animation: looc-item-slide 0.4s var(--ease-decelerate, cubic-bezier(0, 0, 0.2, 1)) both;
        }

        @keyframes looc-item-slide {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        .looc-complete-summary-section {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 12px;
          font-weight: 400;
          color: var(--text-tertiary, #9ca3af);
          flex-shrink: 0;
        }

        .looc-complete-summary-answer {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary, #0a0a0a);
          text-align: right;
          flex: 1;
        }

        /* CTAs */
        .looc-complete-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
          max-width: 360px;
        }

        .looc-complete-btn {
          width: 100%;
          min-height: 52px;
          padding: 14px 24px;
          border-radius: var(--radius-md, 8px);
          font-family: Inter, -apple-system, sans-serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--duration-fast, 150ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
          border: none;
        }

        .looc-complete-btn--primary {
          background: var(--loocbooc-black, #0a0a0a);
          color: var(--text-inverse, #fafafa);
          box-shadow: var(--shadow-2, 0 4px 6px rgba(0,0,0,0.07));
        }

        .looc-complete-btn--primary:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-4, 0 20px 25px rgba(0,0,0,0.10));
        }

        .looc-complete-btn--primary:active {
          transform: translateY(0);
        }

        .looc-complete-btn--ghost {
          background: transparent;
          color: var(--text-secondary, #6b7280);
          border: 1.5px solid var(--surface-3, #ebebeb);
        }

        .looc-complete-btn--ghost:hover {
          border-color: var(--text-secondary, #6b7280);
          color: var(--text-primary, #0a0a0a);
        }
      `}</style>
    </div>
  )
}
