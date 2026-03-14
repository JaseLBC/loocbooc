'use client'

/**
 * Questionnaire Demo Page
 * -----------------------
 * Navigate to /questionnaire-demo to preview all three modes.
 *
 * ?stakeholder=manufacturer|brand|designer|garment_tech|stylist|consumer
 * ?mode=form|poll|conversational
 */

import React, { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { QuestionnaireRenderer } from '../../components/questionnaire'
import type { RenderMode } from '../../components/questionnaire'
import questionnaireData from '../../../public/loocbooc-stakeholder-questionnaires.json'

// Type cast the imported JSON
const data = questionnaireData as typeof questionnaireData & {
  stakeholders: Array<{
    id: string
    label: string
    tagline: string
    description: string
    estimatedMinutes: number
    sections: any[]
  }>
}

function DemoInner() {
  const params = useSearchParams()
  const stakeholderId = params.get('stakeholder') ?? 'consumer'
  const modeParam = (params.get('mode') ?? 'poll') as RenderMode

  const [mode, setMode] = useState<RenderMode>(modeParam)
  const [stakeholder, setStakeholder] = useState(stakeholderId)
  const [completed, setCompleted] = useState(false)
  const [completedAnswers, setCompletedAnswers] = useState<Record<string, any> | null>(null)

  const questionnaire = data.stakeholders.find(s => s.id === stakeholder) ?? data.stakeholders[0]

  if (completed && completedAnswers) {
    return (
      <div style={{ padding: 32, fontFamily: 'Inter, sans-serif', maxWidth: 600, margin: '0 auto' }}>
        <h2 style={{ fontSize: 24, marginBottom: 16 }}>✓ Completed</h2>
        <p style={{ color: '#6b7280', marginBottom: 24 }}>
          {Object.keys(completedAnswers).length} questions answered.
        </p>
        <pre style={{
          background: '#f5f5f5',
          borderRadius: 8,
          padding: 16,
          fontSize: 12,
          overflow: 'auto',
          maxHeight: 400,
        }}>
          {JSON.stringify(completedAnswers, null, 2)}
        </pre>
        <button
          style={{
            marginTop: 24,
            padding: '12px 24px',
            background: '#0a0a0a',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            fontSize: 14,
            fontWeight: 600,
          }}
          onClick={() => {
            setCompleted(false)
            setCompletedAnswers(null)
          }}
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Demo controls */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        zIndex: 9999,
        background: 'white',
        border: '1px solid #ebebeb',
        borderRadius: '0 0 0 12px',
        padding: '12px 16px',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        boxShadow: '0 4px 6px rgba(0,0,0,0.07)',
        fontSize: 13,
        fontFamily: 'Inter, sans-serif',
      }}>
        <select
          value={stakeholder}
          onChange={e => setStakeholder(e.target.value)}
          style={{ border: '1px solid #ebebeb', borderRadius: 6, padding: '4px 8px', fontSize: 13 }}
        >
          {data.stakeholders.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <select
          value={mode}
          onChange={e => setMode(e.target.value as RenderMode)}
          style={{ border: '1px solid #ebebeb', borderRadius: 6, padding: '4px 8px', fontSize: 13 }}
        >
          <option value="form">Form</option>
          <option value="poll">Poll</option>
          <option value="conversational">Conversational</option>
        </select>
      </div>

      {/* Renderer */}
      <QuestionnaireRenderer
        key={`${stakeholder}-${mode}`}
        questionnaire={questionnaire as any}
        mode={mode}
        onComplete={(answers) => {
          setCompleted(true)
          setCompletedAnswers(answers)
        }}
        onSkip={() => alert('Skipped!')}
      />
    </div>
  )
}

export default function QuestionnaireDemoPage() {
  return (
    <Suspense>
      <DemoInner />
    </Suspense>
  )
}
