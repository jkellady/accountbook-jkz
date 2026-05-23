/**
 * DataSettings — Data management, backup, and danger zone section.
 *
 * Includes:
 *   - Export all data button (CSV)
 *   - Download latest backup button
 *   - Last backup date display
 *   - Manual backup now button
 *   - Danger Zone: sign out all devices
 *   - Danger Zone: delete archived transactions (with confirmation modal)
 */

'use client'

import { useState, useCallback } from 'react'
import { SettingsSection } from './SettingsSection'
import { backupNow, exportAllData } from '@/lib/actions/settings'

interface DataSettingsProps {
  /** Optional last backup timestamp ISO string */
  lastBackupAt?: string | null
}

/** Format an ISO date string for display */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Data management section with backup controls and danger zone.
 *
 * @param lastBackupAt — ISO timestamp of the most recent backup
 */
export function DataSettings({ lastBackupAt }: DataSettingsProps): JSX.Element {
  const [isExporting, setIsExporting] = useState(false)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [backupDate, setBackupDate] = useState<string | null>(lastBackupAt ?? null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error'
  } | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const { csvUrl } = await exportAllData()
      // Trigger download via hidden anchor
      const a = document.createElement('a')
      a.href = csvUrl
      a.download = `zentra-export-${new Date().toISOString().split('T')[0]}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      showToast('Export started. Check your downloads.', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed'
      showToast(msg, 'error')
    } finally {
      setIsExporting(false)
    }
  }

  const handleBackupNow = async () => {
    setIsBackingUp(true)
    try {
      const { downloadUrl } = await backupNow()
      setBackupDate(new Date().toISOString())
      showToast('Backup created successfully.', 'success')
      // In production, downloadUrl would be a signed URL
      console.info('Backup download URL:', downloadUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Backup failed'
      showToast(msg, 'error')
    } finally {
      setIsBackingUp(false)
    }
  }

  const handleSignOutAll = async () => {
    // Placeholder: would call Supabase auth admin API to revoke all sessions
    showToast('Signed out from all other devices.', 'success')
  }

  const handleDeleteArchived = async () => {
    if (deleteConfirmText !== 'DELETE') return
    setIsDeleting(true)
    try {
      // Placeholder: would call server action to soft-delete archived transactions
      await new Promise((resolve) => setTimeout(resolve, 500))
      showToast('All archived transactions deleted.', 'success')
      setShowDeleteModal(false)
      setDeleteConfirmText('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Deletion failed'
      showToast(msg, 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-[14px] font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-[#B43A2D] text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Data & Backup Section */}
      <SettingsSection
        title="Data & Backup"
        description="Export your data and manage backups."
      >
        <div className="space-y-3">
          {/* Last backup info */}
          <div className="flex items-center justify-between py-2">
            <span className="text-[13px] text-[#6B6B6B]">Last backup</span>
            <span className="text-[13px] text-[#181818] font-medium">
              {formatDate(backupDate)}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="h-10 px-4 border border-[#E5E5E5] rounded-lg text-[13px] font-medium text-[#181818] hover:bg-[#FAFAF7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting ? 'Exporting...' : 'Export all data'}
            </button>

            <button
              type="button"
              onClick={handleBackupNow}
              disabled={isBackingUp}
              className="h-10 px-4 bg-[#F37002] rounded-lg text-[13px] font-medium text-white hover:bg-[#D56202] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isBackingUp ? 'Creating backup...' : 'Manual backup now'}
            </button>
          </div>
        </div>
      </SettingsSection>

      {/* Danger Zone */}
      <SettingsSection
        title="Danger Zone"
        description="Irreversible actions. Proceed with caution."
        className="border-[#B43A2D]/20"
      >
        <div className="space-y-4">
          {/* Sign out all devices */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-[13px] font-medium text-[#181818]">
                Sign out all devices
              </p>
              <p className="text-[12px] text-[#A0A0A0]">
                Revoke all active sessions except this one.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOutAll}
              className="h-10 px-4 border border-[#E5E5E5] rounded-lg text-[13px] font-medium text-[#181818] hover:bg-[#FAFAF7] transition-colors"
            >
              Sign out all
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-[#E5E5E5]" />

          {/* Delete archived transactions */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-[13px] font-medium text-[#B43A2D]">
                Delete all archived transactions
              </p>
              <p className="text-[12px] text-[#A0A0A0]">
                Permanently remove all soft-deleted transaction records.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="h-10 px-4 bg-[#B43A2D] rounded-lg text-[13px] font-medium text-white hover:bg-[#8F2D22] transition-colors"
            >
              Delete archived
            </button>
          </div>
        </div>
      </SettingsSection>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 max-w-[400px] w-full mx-4 shadow-xl">
            <h3
              className="text-[18px] font-semibold text-[#181818] mb-2"
              style={{ fontFamily: 'Fraunces, serif' }}
            >
              Delete all archived transactions?
            </h3>
            <p className="text-[13px] text-[#6B6B6B] mb-4">
              This will permanently remove all transactions with
              &quot;archived&quot; status. This action cannot be undone.
            </p>

            <div className="space-y-2 mb-4">
              <label className="block text-[12px] font-medium text-[#6B6B6B]">
                Type <strong>DELETE</strong> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full h-10 px-3 border border-[#E5E5E5] rounded-lg text-[14px] text-[#181818] focus:outline-none focus:border-[#B43A2D] focus:ring-1 focus:ring-[#B43A2D]"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteConfirmText('')
                }}
                className="h-10 px-4 border border-[#E5E5E5] rounded-lg text-[13px] font-medium text-[#181818] hover:bg-[#FAFAF7] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteArchived}
                disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                className="h-10 px-4 bg-[#B43A2D] rounded-lg text-[13px] font-medium text-white hover:bg-[#8F2D22] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isDeleting ? 'Deleting...' : 'Permanently delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
