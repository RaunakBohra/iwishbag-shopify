'use client'

interface Step {
  id: number
  name: string
  status: 'completed' | 'current' | 'upcoming'
}

interface ProgressTrackerProps {
  steps: Step[]
}

const statusColors: Record<Step['status'], string> = {
  completed: '#16a34a',
  current: '#2563eb',
  upcoming: '#d4d4d8'
}

export function ProgressTracker({ steps }: ProgressTrackerProps) {
  return (
    <ol className="progress-tracker">
      {steps.map((step) => (
        <li key={step.id} className="progress-tracker__item">
          <span
            className="progress-tracker__badge"
            style={{ backgroundColor: statusColors[step.status] }}
          >
            {step.id}
          </span>
          <span className="progress-tracker__label">{step.name}</span>
        </li>
      ))}
      <style jsx>{`
        .progress-tracker {
          display: flex;
          gap: 1rem;
          list-style: none;
          padding: 0;
          margin: 0;
          flex-wrap: wrap;
        }
        .progress-tracker__item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.95rem;
        }
        .progress-tracker__badge {
          display: inline-flex;
          width: 2rem;
          height: 2rem;
          border-radius: 9999px;
          color: #fff;
          font-weight: 600;
          align-items: center;
          justify-content: center;
        }
        .progress-tracker__label {
          font-weight: 500;
        }
      `}</style>
    </ol>
  )
}
