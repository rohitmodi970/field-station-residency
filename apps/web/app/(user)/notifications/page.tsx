"use client"

import React, { useState, useCallback } from 'react'
import { useTheme } from "@/utilities/context/ThemeContext"
import Link from 'next/link'
import { useNotifications } from '@/hooks/useNotifications'
import { NotificationItem } from '@/components/notifications/NotificationItem'
import { Bell, Settings, CheckCheck, Loader2, Inbox } from 'lucide-react'

type FilterType = 'all' | 'unread' | 'read'

const NotificationPage = () => {
    const { currentTheme } = useTheme()
    const { 
        notifications, 
        loading, 
        error, 
        markAsRead, 
        dismiss, 
        markAllAsRead,
        unreadCount,
        refetch 
    } = useNotifications()
    
    const [filter, setFilter] = useState<FilterType>('all')
    const [markingAll, setMarkingAll] = useState(false)

    const filteredNotifications = notifications.filter(n => {
        if (filter === 'unread') return !n.is_read
        if (filter === 'read') return n.is_read
        return true
    })

    const handleMarkAllAsRead = useCallback(async () => {
        setMarkingAll(true)
        try {
            await markAllAsRead()
        } finally {
            setMarkingAll(false)
        }
    }, [markAllAsRead])

    const handleNotificationClick = useCallback((notification: typeof notifications[0]) => {
        if (!notification.is_read) {
            markAsRead(notification.id)
        }
        // Handle navigation based on notification data
        if (notification.data?.link) {
            window.location.href = notification.data.link
        }
    }, [markAsRead])

    return (
        <div className="container mx-auto max-w-4xl px-4 pb-24 pt-6 sm:pt-8">
            {/* Header */}
            <div className="mb-6 rounded-2xl border border-gray-200 bg-white/85 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/65 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${currentTheme?.primary}20`, color: currentTheme?.primary }}>
                      <Bell className="w-5 h-5" />
                    </div>
                    <h1 className="text-2xl font-bold">Notifications</h1>
                    {unreadCount > 0 && (
                        <span 
                            className="px-2 py-0.5 text-sm font-medium rounded-full text-white"
                            style={{ backgroundColor: currentTheme?.primary }}
                        >
                            {unreadCount} new
                        </span>
                    )}
                </div>
                <Link 
                    href="/settings/notifications"
                    className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                    <Settings className="w-4 h-4" />
                    Settings
                </Link>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="mb-4 flex flex-col gap-3 border-b border-gray-200 pb-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
                {/* Filter Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
                    {(['all', 'unread', 'read'] as FilterType[]).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                filter === f
                                    ? 'bg-white dark:bg-gray-700 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                            }`}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                            {f === 'unread' && unreadCount > 0 && (
                                <span className="ml-1.5 text-xs opacity-70">({unreadCount})</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Mark All Read Button */}
                {unreadCount > 0 && (
                    <button
                        onClick={handleMarkAllAsRead}
                        disabled={markingAll}
                        className="inline-flex items-center gap-2 self-start rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 disabled:opacity-50 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200 sm:self-auto"
                    >
                        {markingAll ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <CheckCheck className="w-4 h-4" />
                        )}
                        Mark all as read
                    </button>
                )}
            </div>

            {/* Notification List */}
            <div className="space-y-2">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    </div>
                ) : error ? (
                    <div className="text-center py-12">
                        <p className="text-red-500 mb-4">{error}</p>
                        <button
                            onClick={() => refetch()}
                            className="px-4 py-2 text-sm font-medium rounded-md text-white transition-colors"
                            style={{ backgroundColor: currentTheme?.primary }}
                        >
                            Try Again
                        </button>
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <div className="text-center py-12">
                        <Inbox className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                            {filter === 'unread' 
                                ? 'All caught up!' 
                                : filter === 'read' 
                                    ? 'No read notifications'
                                    : 'No notifications yet'}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-500">
                            {filter === 'unread'
                                ? "You've read all your notifications"
                                : filter === 'read'
                                    ? "Notifications you've read will appear here"
                                    : "When you receive notifications, they'll appear here"}
                        </p>
                    </div>
                ) : (
                    filteredNotifications.map((notification) => (
                        <div
                            key={notification.id}
                            className={`rounded-lg border transition-colors ${
                                notification.is_read
                                    ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                            }`}
                        >
                            <NotificationItem
                                notification={notification}
                                onMarkAsRead={() => markAsRead(notification.id)}
                                onDismiss={() => dismiss(notification.id)}
                                onClick={() => handleNotificationClick(notification)}
                            />
                        </div>
                    ))
                )}
            </div>

            {/* Load More (if needed in future) */}
            {filteredNotifications.length > 0 && filteredNotifications.length >= 20 && (
                <div className="text-center mt-6">
                    <button
                        onClick={() => refetch()}
                        className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        Load more
                    </button>
                </div>
            )}
        </div>
    )
}

export default NotificationPage
