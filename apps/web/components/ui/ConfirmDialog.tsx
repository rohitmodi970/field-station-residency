'use client'

import React from 'react'
import { useTheme } from '@/utilities/context/ThemeContext'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/quilted-gallery/ui/alert-dialog'

interface ConfirmDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
  title: string
  description?: string
  confirmLabel?: string
  confirmLoadingLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  loading?: boolean
  error?: string | null
  confirmTone?: 'danger' | 'primary'
}

const ConfirmDialog = ({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmLoadingLabel = 'Working...',
  cancelLabel = 'Cancel',
  onConfirm,
  loading = false,
  error,
  confirmTone = 'danger',
}: ConfirmDialogProps) => {
  const { isDarkMode } = useTheme()

  const contentClass = isDarkMode
    ? 'border-white/15 bg-gray-900/40 text-gray-100'
    : 'border-white/70 bg-white/80 text-stone-900'

  const cancelClass = isDarkMode
    ? 'border-white/15 bg-white/5 text-gray-200 hover:bg-white/10'
    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-100'

  const confirmClass = confirmTone === 'danger'
    ? (isDarkMode
        ? 'bg-rose-500/90 text-white hover:bg-rose-500'
        : 'bg-rose-600 text-white hover:bg-rose-500')
    : (isDarkMode
        ? 'bg-white/15 text-white hover:bg-white/25'
        : 'bg-stone-900 text-white hover:bg-stone-800')

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger && (
        <AlertDialogTrigger asChild>
          {trigger}
        </AlertDialogTrigger>
      )}

      <AlertDialogContent className={`backdrop-blur-3xl backdrop-saturate-200 shadow-2xl sm:max-w-md ${contentClass}`}>
        <AlertDialogHeader className="space-y-2 text-left">
          <AlertDialogTitle className={isDarkMode ? 'text-gray-100' : 'text-stone-900'}>
            {title}
          </AlertDialogTitle>
          {description && (
            <AlertDialogDescription className={isDarkMode ? 'text-gray-300' : 'text-stone-600'}>
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>

        {error && (
          <div className={isDarkMode
            ? 'rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200'
            : 'rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700'}>
            {error}
          </div>
        )}

        <AlertDialogFooter className="mt-4 gap-2 sm:gap-3">
          <AlertDialogCancel className={`rounded-full ${cancelClass}`}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-full ${confirmClass}`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border border-white/40 border-t-white" />
                {confirmLoadingLabel}
              </span>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default ConfirmDialog
