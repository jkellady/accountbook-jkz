/**
 * TagInput — Multi-tag input with autocomplete
 *
 * Type a tag name and press Enter or comma to add it. Click the X on a
 * pill to remove. Autocomplete suggestions appear from existing tags.
 * Pills render with #FAFAF7 background, #181818 text, 1px border.
 *
 * @example
 * <TagInput
 *   tags={['urgent', 'client-a']}
 *   existingTags={['urgent', 'important', 'client-a', 'client-b', 'tax']}
 *   onChange={(newTags) => setValue('tags', newTags)}
 * />
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface TagInputProps {
  /** Currently selected tags. */
  readonly tags: readonly string[]
  /** All existing tags from the database (for autocomplete). */
  readonly existingTags: readonly string[]
  /** Called when tags are added or removed. */
  readonly onChange: (tags: string[]) => void
  /** Optional label — defaults to "Tags". */
  readonly label?: string
  /** Placeholder text for the input. */
  readonly placeholder?: string
  /** Maximum number of tags allowed. */
  readonly maxTags?: number
  /** Disable interaction. */
  readonly disabled?: boolean
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function TagInput({
  tags,
  existingTags,
  onChange,
  label = 'Tags',
  placeholder = 'Type a tag and press Enter...',
  maxTags = 20,
  disabled = false,
}: TagInputProps): React.JSX.Element {
  const [inputValue, setInputValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter suggestions: existing tags that match input and aren't already selected
  const suggestions = React.useMemo(() => {
    const query = inputValue.trim().toLowerCase()
    if (!query) return []

    return existingTags
      .filter(
        (tag) =>
          !tags.includes(tag) &&
          tag.toLowerCase().includes(query) &&
          tag.toLowerCase() !== query,
      )
      .slice(0, 6)
  }, [inputValue, existingTags, tags])

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim().toLowerCase()
      if (!trimmed || trimmed.length === 0) return
      if (trimmed.length > 32) return // Reasonable max length
      if (tags.includes(trimmed)) return
      if (tags.length >= maxTags) return

      onChange([...tags, trimmed])
      setInputValue('')
      setShowSuggestions(false)
      setHighlightedIndex(-1)
      inputRef.current?.focus()
    },
    [tags, maxTags, onChange],
  )

  const removeTag = useCallback(
    (tagToRemove: string) => {
      onChange(tags.filter((t) => t !== tagToRemove))
    },
    [tags, onChange],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault()

        // If a suggestion is highlighted, use that
        if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
          addTag(suggestions[highlightedIndex])
          return
        }

        addTag(inputValue)
        return
      }

      if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
        removeTag(tags[tags.length - 1])
        return
      }

      if (e.key === 'Escape') {
        setShowSuggestions(false)
        setHighlightedIndex(-1)
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (suggestions.length === 0) return
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0,
        )
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (suggestions.length === 0) return
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1,
        )
        return
      }
    },
    [inputValue, tags, suggestions, highlightedIndex, addTag, removeTag],
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      // Don't allow comma in the input itself — it's a delimiter
      setInputValue(val.replace(/,/g, ''))
      setShowSuggestions(true)
      setHighlightedIndex(-1)
    },
    [],
  )

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      addTag(suggestion)
    },
    [addTag],
  )

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div ref={containerRef} className="tag-input">
      <label
        style={{
          display: 'block',
          fontSize: '13px',
          fontWeight: 500,
          color: '#6B6B6B',
          marginBottom: '8px',
        }}
      >
        {label}
        {tags.length > 0 && (
          <span
            style={{
              fontSize: '11px',
              color: '#6B6B6B',
              fontWeight: 400,
              marginLeft: '6px',
            }}
          >
            ({tags.length}/{maxTags})
          </span>
        )}
      </label>

      {/* Input container with pills inside */}
      <div
        onClick={() => {
          if (!disabled) {
            inputRef.current?.focus()
            setIsFocused(true)
          }
        }}
        style={{
          minHeight: '44px',
          padding: '6px 8px',
          borderRadius: '8px',
          border: isFocused ? '1px solid #F37002' : '1px solid #E5E5E5',
          backgroundColor: '#FFFFFF',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '6px',
          cursor: disabled ? 'not-allowed' : 'text',
          transition: 'border-color 0.15s ease',
          position: 'relative',
        }}
      >
        {/* Tag pills */}
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '6px',
              backgroundColor: '#FAFAF7',
              border: '1px solid #E8E6E1',
              fontSize: '13px',
              color: '#181818',
              fontWeight: 500,
              lineHeight: 1,
            }}
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                removeTag(tag)
              }}
              disabled={disabled}
              aria-label={`Remove tag ${tag}`}
              style={{
                border: 'none',
                background: 'none',
                padding: '0',
                margin: '0',
                marginLeft: '2px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                lineHeight: 1,
                color: '#6B6B6B',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '16px',
                height: '16px',
                borderRadius: '3px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#E53E3E'
                e.currentTarget.style.backgroundColor = '#FFF5F5'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#6B6B6B'
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              &times;
            </button>
          </span>
        ))}

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsFocused(true)
            if (inputValue.trim()) setShowSuggestions(true)
          }}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          placeholder={tags.length === 0 ? placeholder : ''}
          style={{
            flex: 1,
            minWidth: '80px',
            height: '30px',
            border: 'none',
            outline: 'none',
            fontSize: '14px',
            color: '#181818',
            backgroundColor: 'transparent',
          }}
        />
      </div>

      {/* Autocomplete suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          style={{
            marginTop: '4px',
            borderRadius: '8px',
            border: '1px solid #E5E5E5',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            overflow: 'hidden',
            zIndex: 10,
            position: 'relative',
          }}
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSuggestionClick(suggestion)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                border: 'none',
                backgroundColor: index === highlightedIndex ? '#FAFAF7' : '#FFFFFF',
                fontSize: '13px',
                color: '#181818',
                cursor: 'pointer',
                transition: 'background-color 0.08s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#FAFAF7'
                setHighlightedIndex(index)
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  index === highlightedIndex ? '#FAFAF7' : '#FFFFFF'
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Hint text */}
      <span
        style={{
          display: 'block',
          fontSize: '11px',
          color: '#6B6B6B',
          marginTop: '4px',
        }}
      >
        Press Enter or comma to add. Click &times; to remove.
      </span>
    </div>
  )
}
