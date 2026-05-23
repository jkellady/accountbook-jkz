/**
 * EntityToggle — Personal | JK Zentra entity selector
 *
 * A two-option toggle switch for selecting which business entity a transaction
 * belongs to. Personal (#6B6B6B) and JK Zentra (#F37002) each have a
 * distinct colour indicator. Defaults from the user's settings.
 *
 * @example
 * <EntityToggle
 *   value={entityId}
 *   onChange={(id) => setValue('entity_id', id)}
 *   entities={[
 *     { id: 'uuid-personal', name: 'Personal', color: '#6B6B6B' },
 *     { id: 'uuid-jk', name: 'JK Zentra', color: '#F37002' },
 *   ]}
 * />
 */

"use client"


import React from 'react'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/** Minimal entity shape for the toggle — matches the entities table Row type. */
export interface ToggleEntity {
  readonly id: string
  readonly name: 'Personal' | 'JK Zentra'
  readonly color: string
}

interface EntityToggleProps {
  /** Currently selected entity UUID. */
  readonly value: string
  /** Called when the user switches entity. */
  readonly onChange: (entityId: string) => void
  /** The two entities (Personal + JK Zentra), ordered as desired. */
  readonly entities: readonly ToggleEntity[]
  /** Optional error message to display below the toggle. */
  readonly error?: string
  /** Disable interaction. */
  readonly disabled?: boolean
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function EntityToggle({
  value,
  onChange,
  entities,
  error,
  disabled = false,
}: EntityToggleProps): React.JSX.Element {
  return (
    <div className="entity-toggle">
      <label
        style={{
          display: 'block',
          fontSize: '13px',
          fontWeight: 500,
          color: '#6B6B6B',
          marginBottom: '8px',
        }}
      >
        Entity
      </label>

      <div
        role="radiogroup"
        aria-label="Select entity"
        style={{
          display: 'flex',
          gap: '8px',
        }}
      >
        {entities.map((entity) => {
          const isSelected = value === entity.id
          return (
            <button
              key={entity.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onChange(entity.id)}
              style={{
                flex: 1,
                height: '44px',
                borderRadius: '8px',
                border: isSelected
                  ? `2px solid ${entity.color}`
                  : '1px solid #E5E5E5',
                backgroundColor: isSelected
                  ? `${entity.color}14`
                  : '#FFFFFF',
                color: isSelected ? entity.color : '#6B6B6B',
                fontSize: '14px',
                fontWeight: isSelected ? 600 : 400,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              {/* Colour indicator dot */}
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: entity.color,
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              {entity.name}
            </button>
          )
        })}
      </div>

      {error && (
        <span
          role="alert"
          style={{
            display: 'block',
            fontSize: '12px',
            color: '#E53E3E',
            marginTop: '6px',
          }}
        >
          {error}
        </span>
      )}
    </div>
  )
}
