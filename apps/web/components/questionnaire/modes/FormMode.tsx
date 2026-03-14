'use client'

import React, { useState } from 'react'
import type { Questionnaire, Answers } from '../types'
import { useQuestionnaire } from '../useQuestionnaire'
import { QuestionnaireProgress } from '../QuestionnaireProgress'
import { QuestionRenderer } from '../QuestionRenderer'
import { QuestionnaireComplete } from '../QuestionnaireComplete'

interface FormModeProps {
  questionnaire: Questionnaire
  onComplete: (answers: Answers) => void
  onSkip?: () => void
}

export function FormMode({ questionnaire, onComplete, onSkip }: FormModeProps) {
  const {
    answers,
    answer,
    totalQuestions,
    timeRemaining,
    questionsBySection,
    clearPersistence,
  } = useQuestionnaire(questionnaire)

  const [completed, setCompleted] = useState(false)
  const [showingSectionIndex, setShowingSectionIndex] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')

  // In form mode, navigate section by section
  const currentSectionData = questionsBySection[showingSectionIndex]
  const totalSections = questionsBySection.length
  const isLastSection = showingSectionIndex === totalSections - 1

  // All visible required questions in this section answered?
  const sectionComplete = currentSectionData?.questions.every(q => {
    if (!q.required) return true
    const val = answers[q.id]
    if (val === undefined || val === null || val === '') return false
    if (Array.isArray(val)) return val.length > 0
    return true
  }) ?? false

  const handleNext = () => {
    if (isLastSection) {
      clearPersistence()
      setCompleted(true)
    } else {
      setDirection('forward')
      setShowingSectionIndex(i => i + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleBack = () => {
    if (showingSectionIndex > 0) {
      setDirection('back')
      setShowingSectionIndex(i => i - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (completed) {
    return (
      <QuestionnaireComplete
        questionnaire={questionnaire}
        answers={answers}
        onContinue={() => onComplete(answers)}
      />
    )
  }

  // Calculate overall question progress for the bar
  // (count answered questions in sections 0..showingSectionIndex-1 plus current)
  const questionsBeforeSection = questionsBySection
    .slice(0, showingSectionIndex)
    .reduce((acc, s) => acc + s.questions.length, 0)
  const overallProgress = questionsBeforeSection
  const overallTotal = totalQuestions

  return (
    <div className="looc-form-mode">
      {/* Header */}
      <div className="looc-form-header">
        <div className="looc-form-brand">
          <span className="looc-form-brand-name">{questionnaire.label}</span>
          {onSkip && (
            <button className="looc-form-skip" onClick={onSkip} type="button">
              Skip
            </button>
          )}
        </div>
        <QuestionnaireProgress
          current={overallProgress}
          total={overallTotal}
          sectionName={currentSectionData?.section.title}
          timeRemaining={timeRemaining}
          variant="bar"
        />
        <div className="looc-form-section-steps">
          {questionnaire.sections.map((s, i) => (
            <div
              key={s.id}
              className={`looc-section-step ${i === showingSectionIndex ? 'looc-section-step--active' : ''} ${i < showingSectionIndex ? 'looc-section-step--done' : ''}`}
            >
              {i < showingSectionIndex ? '✓' : i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Section content */}
      <div className="looc-form-body" key={showingSectionIndex} data-direction={direction}>
        <div className="looc-form-section-title">
          <span className="looc-form-section-eyebrow">
            Step {showingSectionIndex + 1} of {totalSections}
          </span>
          <h2 className="looc-form-section-heading">
            {currentSectionData?.section.title}
          </h2>
        </div>

        <div className="looc-form-questions">
          {currentSectionData?.questions.map((question, qi) => (
            <div key={question.id} className="looc-form-question-wrap" style={{ animationDelay: `${qi * 0.06}s` }}>
              <QuestionRenderer
                question={question}
                answers={answers}
                onAnswer={answer}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="looc-form-nav">
        {showingSectionIndex > 0 ? (
          <button type="button" className="looc-nav-btn looc-nav-btn--ghost" onClick={handleBack}>
            ← Back
          </button>
        ) : (
          <div />
        )}
        <button
          type="button"
          className={`looc-nav-btn looc-nav-btn--primary ${!sectionComplete ? 'looc-nav-btn--disabled' : ''}`}
          onClick={sectionComplete ? handleNext : undefined}
          disabled={!sectionComplete}
        >
          {isLastSection ? 'Submit' : 'Next →'}
        </button>
      </div>

      <style>{`
        .looc-form-mode {
          display: flex;
          flex-direction: column;
          min-height: 100%;
          max-width: 640px;
          margin: 0 auto;
          padding: 0 16px;
        }

        .looc-form-header {
          position: sticky;
          top: 0;
          z-index: 10;
          background: var(--loocbooc-white, #fafafa);
          padding: 20px 0 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          border-bottom: 1px solid var(--surface-3, #ebebeb);
          margin-bottom: 32px;
        }

        .looc-form-brand {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .looc-form-brand-name {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text-tertiary, #9ca3af);
        }

        .looc-form-skip {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-tertiary, #9ca3af);
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px 0;
        }

        .looc-form-skip:hover {
          color: var(--text-secondary, #6b7280);
        }

        .looc-form-section-steps {
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .looc-section-step {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: Inter, -apple-system, sans-serif;
          font-size: 11px;
          font-weight: 600;
          background: var(--surface-2, #f5f5f5);
          color: var(--text-tertiary, #9ca3af);
          transition: all var(--duration-normal, 250ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
          flex-shrink: 0;
        }

        .looc-section-step--active {
          background: var(--loocbooc-black, #0a0a0a);
          color: white;
          transform: scale(1.1);
        }

        .looc-section-step--done {
          background: var(--loocbooc-accent, #c8b49a);
          color: white;
        }

        /* Body animation */
        .looc-form-body {
          flex: 1;
          animation: looc-form-slide-in var(--duration-normal, 250ms) var(--ease-decelerate, cubic-bezier(0, 0, 0.2, 1)) both;
          padding-bottom: 120px;
        }

        .looc-form-body[data-direction="back"] {
          animation-name: looc-form-slide-in-back;
        }

        @keyframes looc-form-slide-in {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        @keyframes looc-form-slide-in-back {
          from { opacity: 0; transform: translateX(-24px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        .looc-form-section-title {
          margin-bottom: 28px;
        }

        .looc-form-section-eyebrow {
          display: block;
          font-family: Inter, -apple-system, sans-serif;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--loocbooc-accent, #c8b49a);
          margin-bottom: 8px;
        }

        .looc-form-section-heading {
          font-family: 'DM Serif Display', Georgia, serif;
          font-size: 28px;
          font-weight: 400;
          line-height: 1.2;
          color: var(--text-primary, #0a0a0a);
          margin: 0;
        }

        .looc-form-questions {
          display: flex;
          flex-direction: column;
          gap: 36px;
        }

        .looc-form-question-wrap {
          animation: looc-q-appear var(--duration-normal, 250ms) var(--ease-decelerate, cubic-bezier(0, 0, 0.2, 1)) both;
        }

        @keyframes looc-q-appear {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Nav */
        .looc-form-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(to top, var(--loocbooc-white, #fafafa) 80%, transparent);
          padding: 20px 32px 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .looc-nav-btn {
          min-height: 52px;
          padding: 14px 28px;
          border-radius: var(--radius-md, 8px);
          font-family: Inter, -apple-system, sans-serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--duration-fast, 150ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
          border: none;
        }

        .looc-nav-btn--primary {
          background: var(--loocbooc-black, #0a0a0a);
          color: white;
          box-shadow: var(--shadow-2, 0 4px 6px rgba(0,0,0,0.07));
          min-width: 120px;
        }

        .looc-nav-btn--primary:hover:not(.looc-nav-btn--disabled) {
          transform: translateY(-2px);
          box-shadow: var(--shadow-4, 0 20px 25px rgba(0,0,0,0.10));
        }

        .looc-nav-btn--primary.looc-nav-btn--disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .looc-nav-btn--ghost {
          background: transparent;
          color: var(--text-secondary, #6b7280);
          border: 1.5px solid var(--surface-3, #ebebeb);
        }

        .looc-nav-btn--ghost:hover {
          border-color: var(--text-secondary, #6b7280);
          color: var(--text-primary, #0a0a0a);
        }
      `}</style>
    </div>
  )
}
