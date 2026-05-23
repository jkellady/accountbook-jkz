/**
 * FloatingUploadButton — FAB that opens upload options (Snap Receipt / Upload File).
 *
 * DESIGN SPEC:
 *   - 56px diameter circle, #F37002 background, white icon
 *   - Shadow: 0 4px 16px rgba(243,112,2,0.3)
 *   - On mobile: centered above bottom tab bar
 *   - On desktop: bottom-right of viewport (optional)
 *
 * Upload options:
 *   - "Snap Receipt" — triggers camera capture
 *   - "Upload File"  — triggers file picker
 */

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Upload, Camera, FileUp, X } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface FloatingUploadButtonProps {
  /** Callback when "Snap Receipt" is selected. */
  onSnapReceipt?: () => void
  /** Callback when "Upload File" is selected (receives FileList). */
  onUploadFile?: (files: FileList) => void
  /** Position variant — 'mobile-center' floats above tab bar, 'desktop-br' sits bottom-right. */
  position?: 'mobile-center' | 'desktop-br'
}

/** Union of the two upload option types. */
type UploadOption = 'snap' | 'file'

// ============================================================================
// Component
// ============================================================================

/**
 * FloatingUploadButton — FAB with upload options bottom sheet.
 *
 * @param onSnapReceipt — camera capture callback
 * @param onUploadFile  — file picker callback
 * @param position      — placement variant
 */
export function FloatingUploadButton({
  onSnapReceipt,
  onUploadFile,
  position = 'mobile-center',
}: FloatingUploadButtonProps): JSX.Element {
  const [sheetOpen, setSheetOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /** Close sheet on Escape. */
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && sheetOpen) {
        setSheetOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sheetOpen])

  /** Prevent body scroll when sheet is open. */
  useEffect(() => {
    if (sheetOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [sheetOpen])

  const handleFabClick = useCallback(() => {
    setSheetOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    setSheetOpen(false)
  }, [])

  const handleSnapReceipt = useCallback(() => {
    setSheetOpen(false)
    onSnapReceipt?.()
  }, [onSnapReceipt])

  const handleUploadFileClick = useCallback(() => {
    setSheetOpen(false)
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files
      if (files && files.length > 0) {
        onUploadFile?.(files)
      }
      // Reset input so the same file can be selected again
      event.target.value = ''
    },
    [onUploadFile]
  )

  const isDesktop = position === 'desktop-br'

  return (
    <>
      {/* Hidden file input for Upload File option */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {/* FAB */}
      <button
        type="button"
        onClick={handleFabClick}
        style={{
          position: 'fixed',
          bottom: isDesktop ? '24px' : 'calc(64px + env(safe-area-inset-bottom) + 8px)',
          right: isDesktop ? '24px' : '50%',
          transform: isDesktop ? 'none' : 'translateX(50%)',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#F37002',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(243,112,2,0.3)',
          zIndex: 60,
          transition: 'all 150ms ease',
        }}
        aria-label="Open upload options"
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = isDesktop
            ? 'scale(1.05)'
            : 'translateX(50%) scale(1.05)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = isDesktop
            ? 'scale(1)'
            : 'translateX(50%) scale(1)'
        }}
      >
        <Upload size={24} strokeWidth={2} color="#FFFFFF" />
      </button>

      {/* Upload Options Sheet */}
      {sheetOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 110 }}>
          {/* Backdrop */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.4)',
              animation: 'fabFadeIn 150ms ease',
            }}
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Sheet */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: '#FFFFFF',
              borderRadius: '16px 16px 0 0',
              padding: '16px 0 24px',
              animation: 'fabSlideUp 200ms ease',
            }}
            role="dialog"
            aria-label="Upload options"
          >
            {/* Drag handle */}
            <div
              style={{
                width: '40px',
                height: '4px',
                borderRadius: '2px',
                backgroundColor: '#D1CFC8',
                margin: '0 auto 16px',
              }}
              aria-hidden="true"
            />

            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 20px 16px',
              }}
            >
              <h2
                style={{
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#181818',
                  margin: 0,
                }}
              >
                Upload
              </h2>
              <button
                type="button"
                onClick={handleClose}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#F5F5F2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#6B6B6B',
                }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Options */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '0 16px',
              }}
            >
              <UploadOptionButton
                icon={<Camera size={22} strokeWidth={1.8} />}
                label="Snap Receipt"
                description="Take a photo of a receipt"
                onClick={handleSnapReceipt}
              />
              <UploadOptionButton
                icon={<FileUp size={22} strokeWidth={1.8} />}
                label="Upload File"
                description="Select PDF or image files"
                onClick={handleUploadFileClick}
              />
            </div>
          </div>

          {/* Animations */}
          <style jsx>{`
            @keyframes fabFadeIn {
              from {
                opacity: 0;
              }
              to {
                opacity: 1;
              }
            }
            @keyframes fabSlideUp {
              from {
                transform: translateY(100%);
              }
              to {
                transform: translateY(0);
              }
            }
          `}</style>
        </div>
      )}
    </>
  )
}

// ============================================================================
// Upload Option Button Sub-component
// ============================================================================

interface UploadOptionButtonProps {
  icon: React.ReactNode
  label: string
  description: string
  onClick: () => void
}

function UploadOptionButton({
  icon,
  label,
  description,
  onClick,
}: UploadOptionButtonProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        width: '100%',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid #E8E6E1',
        backgroundColor: '#FFFFFF',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 150ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#FAFAF7'
        e.currentTarget.style.borderColor = '#D1CFC8'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#FFFFFF'
        e.currentTarget.style.borderColor = '#E8E6E1'
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '10px',
          backgroundColor: '#F5F5F2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#181818',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '15px',
            fontWeight: 600,
            color: '#181818',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '13px',
            color: '#6B6B6B',
          }}
        >
          {description}
        </span>
      </div>
    </button>
  )
}

export default FloatingUploadButton
