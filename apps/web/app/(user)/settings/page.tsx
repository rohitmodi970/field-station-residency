"use client"

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme, ColorOption } from "@/utilities/context/ThemeContext"
import { User, Bell, Shield, Moon, Sun, ChevronRight, Palette, Settings as SettingsIcon, HardDrive, Cloud, Smartphone, Monitor, Tablet, Globe, LogOut, CheckCircle2, XCircle, Database } from 'lucide-react'
import { CalendarIntegrationPanel } from '@/components/integrations/CalendarIntegrationPanel'
import { GmailIntegrationPanel } from '@/components/integrations/GmailIntegrationPanel'
import { VektoriMemoryPanel } from '@/components/integrations/VektoriMemoryPanel'
import { MessagingIntegrationPanel } from '@/components/integrations/MessagingIntegrationPanel'
import { createClient } from '@/utils/supabase/client'
import dynamic from 'next/dynamic'

const ThemeStudioPanel = dynamic(() => import('@/components/Navbar/ThemeStudioPanel'), { ssr: false });

interface UserSettings {
  theme_mode: 'light' | 'dark' | 'system';
  storage_provider: 'supabase' | 'google_drive' | null;
  storage_scope: 'device_only' | 'cloud_backup' | 'full_cloud';
  account_type: 'private' | 'public' | 'community';
  ai_features_enabled: boolean;
    memory_opt_in?: boolean;
    memory_retention_days?: number | null;
    memory_rollout_percent?: number | null;
    memory_last_cleared_at?: string | null;
}

interface DeviceSession {
  id: string;
  device_type: string | null;
  device_name: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string;
  last_activity: string;
  is_active: boolean;
  created_at: string;
}

const SettingsPage = () => {
    const { currentTheme, isDarkMode, colorOptions, setCurrentTheme, toggleDarkMode, elementColors, pageBackground } = useTheme();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('appearance');
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [devices, setDevices] = useState<DeviceSession[]>([]);
    const [currentSessionIp, setCurrentSessionIp] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [googleDriveConnected, setGoogleDriveConnected] = useState(false);

    // Fetch user settings and devices
    useEffect(() => {
        const controller = new AbortController();
        fetchSettings();
        fetchDevices();
        checkGoogleDriveStatus();
        getCurrentSessionIp(controller.signal);
        return () => {
            controller.abort();
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        if (params.get('tab') === 'integrations') {
            setActiveTab('integrations');
        }
    }, []);

    const getCurrentSessionIp = async (externalSignal?: AbortSignal) => {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => {
            try {
                controller.abort(new DOMException('Request timed out', 'AbortError'));
            } catch {
                controller.abort();
            }
        }, 8000);

        if (externalSignal) {
            externalSignal.addEventListener('abort', () => {
                try {
                    controller.abort();
                } catch {}
            });
        }

        try {
            // Use internal API route to avoid client-side third-party network issues.
            const response = await fetch('/api/get-ip', {
                signal: controller.signal,
                cache: 'no-store',
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch current IP: ${response.status}`);
            }
            const data = await response.json();
            if (data?.ip) {
                setCurrentSessionIp(data.ip);
            }
        } catch (error: any) {
            if (
                error?.name === 'AbortError' ||
                controller.signal.aborted ||
                externalSignal?.aborted ||
                error?.message?.includes('aborted')
            ) {
                // Silently ignore aborted/timed-out requests
                return;
            }
            console.error('Error getting current IP:', error);
        } finally {
            clearTimeout(timeoutId);
        }
    };

    const checkGoogleDriveStatus = async () => {
        try {
            const response = await fetch('/api/auth/google-drive/status');
            if (response.ok) {
                const data = await response.json();
                setGoogleDriveConnected(data.connected);
            }
        } catch (error) {
            console.error('Error checking Google Drive status:', error);
        }
    };

    const fetchSettings = async () => {
        try {
            const response = await fetch('/api/user/settings');
            if (response.ok) {
                const data = await response.json();
                setSettings(data.settings);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDevices = async () => {
        try {
            const response = await fetch('/api/user/devices');
            if (response.ok) {
                const data = await response.json();
                // Filter to only show active sessions
                const activeSessions = (data.devices || []).filter((d: DeviceSession) => d.is_active);
                setDevices(activeSessions);
            }
        } catch (error) {
            console.error('Error fetching devices:', error);
        }
    };

    const updateSettings = async (updates: Partial<UserSettings>) => {
        setSaving(true);
        try {
            const response = await fetch('/api/user/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            
            if (response.ok) {
                const data = await response.json();
                setSettings(data.settings);
            }
        } catch (error) {
            console.error('Error updating settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const logoutDevice = async (sessionId: string) => {
        try {
            const response = await fetch(`/api/user/devices/${sessionId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                fetchDevices();
            }
        } catch (error) {
            console.error('Error logging out device:', error);
        }
    };

    const connectGoogleDrive = async () => {
        try {
            const response = await fetch('/api/auth/google-drive/connect');
            if (response.ok) {
                const data = await response.json();
                window.location.href = data.authUrl;
            }
        } catch (error) {
            console.error('Error initiating Google Drive connection:', error);
        }
    };

    const disconnectGoogleDrive = async () => {
        try {
            const response = await fetch('/api/auth/google-drive/disconnect', {
                method: 'POST'
            });
            
            if (response.ok) {
                setGoogleDriveConnected(false);
                // Set storage_provider to null since we're no longer using cloud
                await updateSettings({ storage_provider: null });
            }
        } catch (error) {
            console.error('Error disconnecting Google Drive:', error);
        }
    };

    const getDeviceIcon = (deviceType: string | null) => {
        switch (deviceType?.toLowerCase()) {
            case 'mobile': return <Smartphone size={18} />;
            case 'tablet': return <Tablet size={18} />;
            case 'desktop': return <Monitor size={18} />;
            default: return <Globe size={18} />;
        }
    };

    // Check if this device/session is the current one
    const isCurrentDevice = (device: DeviceSession) => {
        return device.ip_address === currentSessionIp;
    };

    // Function to get text/background styles based on current theme
    const getThemeStyles = (isSelected = false) => {
        if (isSelected) {
            return {
                backgroundColor: currentTheme.light,
                color: currentTheme.primary,
                borderColor: currentTheme.primary
            };
        }
        return {};
    };

    const tabs = [
        { id: 'appearance', icon: <Palette size={18} />, label: 'Appearance' },
        { id: 'storage', icon: <HardDrive size={18} />, label: 'Storage' },
        { id: 'devices', icon: <Smartphone size={18} />, label: 'Devices' },
        { id: 'profile', icon: <User size={18} />, label: 'Profile' },
        { id: 'notifications', icon: <Bell size={18} />, label: 'Notifications' },
        { id: 'security', icon: <Shield size={18} />, label: 'Security' },
        { id: 'integrations', icon: <Globe size={18} />, label: 'Integrations' }
    ];

    // Color swatch component for theme selection
    const ColorSwatch = ({ color, selected, onClick }: { color: ColorOption; selected: boolean; onClick: () => void }) => (
        <button
            className={`w-10 h-10 rounded-full transition-all duration-200 flex items-center justify-center ${selected ? 'ring-4 ring-offset-2' : 'hover:scale-110'}`}
            style={{ 
                backgroundColor: color.primary,
                boxShadow: selected ? `0 0 0 2px ${isDarkMode ? '#374151' : 'white'}` : 'none',
                border: `1px solid ${color.primary}`
            }}
            onClick={onClick}
            aria-label={`Select ${color.name} theme`}
        >
            {selected && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            )}
        </button>
    );

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: pageBackground, color: elementColors.text }}>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: currentTheme.primary }}></div>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen pt-24 transition-colors duration-200"
            style={
                pageBackground.includes('gradient') || pageBackground.includes('url(')
                    ? {
                        backgroundImage: pageBackground,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center',
                        backgroundSize: 'cover',
                        color: elementColors.text,
                    }
                    : {
                        backgroundColor: pageBackground,
                        color: elementColors.text,
                    }
            }
        >
            <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 sm:py-6 lg:px-6 lg:py-8">
                <div
                    className="mb-6 flex items-center gap-3 rounded-2xl border px-5 py-4 shadow-[0_10px_24px_rgba(94,71,51,0.1)]"
                    style={{
                        backgroundColor: isDarkMode ? 'rgba(17,24,39,0.72)' : 'rgba(255,248,242,0.9)',
                        borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(213,193,178,0.7)',
                    }}
                >
                    <SettingsIcon size={22} style={{ color: currentTheme.primary }} />
                    <h1 className="text-2xl font-bold md:text-3xl" style={{ fontFamily: "'Iowan Old Style', 'Palatino Linotype', serif" }}>Settings</h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Sidebar Navigation */}
                    <div className="lg:col-span-1">
                        <div
                            className="overflow-hidden rounded-2xl border shadow-[0_8px_22px_rgba(94,71,51,0.09)]"
                            style={{
                                backgroundColor: isDarkMode ? 'rgba(17,24,39,0.72)' : 'rgba(255,249,244,0.92)',
                                borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(217,198,184,0.7)',
                            }}
                        >
                            <nav className="flex flex-col">
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center px-4 py-3 transition-all duration-200 ${activeTab === tab.id ? 'font-medium' : 'hover:bg-[#f6eee6]'}`}
                                        style={activeTab === tab.id ? { backgroundColor: '#f4e9df', color: '#6d5647', borderLeft: '3px solid #9b7a67' } : { color: '#695446' }}
                                    >
                                        <span className="mr-3">{tab.icon}</span>
                                        <span>{tab.label}</span>
                                        <ChevronRight 
                                            size={18} 
                                            className="ml-auto"
                                            style={{ 
                                                opacity: activeTab === tab.id ? 1 : 0.5,
                                                color: activeTab === tab.id ? currentTheme.primary : 'inherit'
                                            }}
                                        />
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="lg:col-span-3">
                        <div
                            className="rounded-2xl border p-5 shadow-[0_8px_22px_rgba(94,71,51,0.09)] md:p-6"
                            style={{
                                backgroundColor: isDarkMode ? 'rgba(17,24,39,0.72)' : 'rgba(255,249,244,0.92)',
                                borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(217,198,184,0.7)',
                            }}
                        >
                            {/* Storage Tab */}
                            {activeTab === 'storage' && (
                                <div>
                                    <h2 className="text-xl font-semibold mb-6">Storage Settings</h2>
                                    
                                    {/* Storage Provider */}
                                    <div className="mb-8">
                                        <h3 className="text-lg font-medium mb-4">Storage Provider</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <button
                                                onClick={() => updateSettings({ storage_provider: 'supabase' })}
                                                className={`p-4 rounded-lg border-2 transition-all ${
                                                    settings?.storage_provider === 'supabase' ? 'ring-2' : 'hover:border-opacity-60'
                                                }`}
                                                style={{
                                                    borderColor: settings?.storage_provider === 'supabase' ? currentTheme.primary : isDarkMode ? '#374151' : '#E5E7EB',
                                                    backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF'
                                                }}
                                            >
                                                <Database size={32} className="mb-2" style={{ color: currentTheme.primary }} />
                                                <h4 className="font-medium mb-1">Supabase</h4>
                                                <p className="text-xs opacity-70">Fast, secure cloud storage</p>
                                                {settings?.storage_provider === 'supabase' && (
                                                    <CheckCircle2 size={16} className="mt-2" style={{ color: currentTheme.primary }} />
                                                )}
                                            </button>

                                            <button
                                                onClick={() => {
                                                    if (googleDriveConnected) {
                                                        updateSettings({ storage_provider: 'google_drive' });
                                                    } else {
                                                        connectGoogleDrive();
                                                    }
                                                }}
                                                className={`p-4 rounded-lg border-2 transition-all ${
                                                    settings?.storage_provider === 'google_drive' ? 'ring-2' : 'hover:border-opacity-60'
                                                }`}
                                                style={{
                                                    borderColor: settings?.storage_provider === 'google_drive' ? currentTheme.primary : isDarkMode ? '#374151' : '#E5E7EB',
                                                    backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF'
                                                }}
                                            >
                                                <Cloud size={32} className="mb-2" style={{ color: '#4285F4' }} />
                                                <h4 className="font-medium mb-1">Google Drive</h4>
                                                <p className="text-xs opacity-70">Sync with Google Drive</p>
                                                {settings?.storage_provider === 'google_drive' && (
                                                    <CheckCircle2 size={16} className="mt-2" style={{ color: currentTheme.primary }} />
                                                )}
                                                {!googleDriveConnected && (
                                                    <p className="text-xs mt-2" style={{ color: currentTheme.primary }}>Click to connect</p>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Google Drive Connection Status */}
                                    {googleDriveConnected && (
                                        <div className="mb-8 p-4 rounded-lg border" style={{
                                            backgroundColor: isDarkMode ? '#1F2937' : '#F0FDF4',
                                            borderColor: '#10B981'
                                        }}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <CheckCircle2 size={20} style={{ color: '#10B981' }} />
                                                    <div>
                                                        <h4 className="font-medium">Google Drive Connected</h4>
                                                        <p className="text-sm opacity-70">Your journals are synced with Google Drive</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={disconnectGoogleDrive}
                                                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                                    style={{
                                                        backgroundColor: '#FEE2E2',
                                                        color: '#DC2626'
                                                    }}
                                                >
                                                    Disconnect
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Storage Scope */}
                                    <div className="mb-8">
                                        <h3 className="text-lg font-medium mb-4">Storage Scope</h3>
                                        <div className="space-y-3">
                                            {[
                                                { value: 'device_only', label: 'Device Only', desc: 'Store data only on this device' },
                                                { value: 'cloud_backup', label: 'Cloud Backup', desc: 'Backup data to the cloud' },
                                                { value: 'full_cloud', label: 'Full Cloud', desc: 'Store all data in the cloud' }
                                            ].map((scope) => (
                                                <button
                                                    key={scope.value}
                                                    onClick={() => {
                                                        // When changing to device_only, clear storage_provider
                                                        if (scope.value === 'device_only') {
                                                            updateSettings({ storage_scope: scope.value as any, storage_provider: null });
                                                        } else {
                                                            updateSettings({ storage_scope: scope.value as any });
                                                        }
                                                    }}
                                                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                                                        settings?.storage_scope === scope.value ? 'ring-2' : ''
                                                    }`}
                                                    style={{
                                                        borderColor: settings?.storage_scope === scope.value ? currentTheme.primary : isDarkMode ? '#374151' : '#E5E7EB',
                                                        backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF'
                                                    }}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <h4 className="font-medium">{scope.label}</h4>
                                                            <p className="text-sm opacity-70">{scope.desc}</p>
                                                        </div>
                                                        {settings?.storage_scope === scope.value && (
                                                            <CheckCircle2 size={20} style={{ color: currentTheme.primary }} />
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* AI Features Toggle */}
                                    <div className="mb-4">
                                        <div className="flex items-center justify-between p-4 rounded-lg" style={{
                                            backgroundColor: isDarkMode ? '#1F2937' : '#F9FAFB'
                                        }}>
                                            <div>
                                                <h3 className="text-lg font-medium">AI Features</h3>
                                                <p className="text-sm opacity-70">Enable AI-powered insights and suggestions</p>
                                            </div>
                                            <button
                                                onClick={() => updateSettings({ ai_features_enabled: !settings?.ai_features_enabled })}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                    settings?.ai_features_enabled ? 'bg-opacity-100' : 'bg-opacity-30'
                                                }`}
                                                style={{ backgroundColor: settings?.ai_features_enabled ? currentTheme.primary : '#9CA3AF' }}
                                            >
                                                <span
                                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                        settings?.ai_features_enabled ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                                />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Devices Tab */}
                            {activeTab === 'devices' && (
                                <div>
                                    <h2 className="text-xl font-semibold mb-6">Device Management</h2>
                                    <p className="mb-6 opacity-70">Manage devices where you're currently logged in</p>
                                    
                                    <div className="space-y-4">
                                        {devices.map((device) => (
                                            <div
                                                key={device.id}
                                                className="p-4 rounded-lg border"
                                                style={{
                                                    backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                                                    borderColor: isCurrentDevice(device) ? currentTheme.primary : isDarkMode ? '#374151' : '#E5E7EB'
                                                }}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-start gap-4">
                                                        <div
                                                            className="w-12 h-12 rounded-full flex items-center justify-center"
                                                            style={{ backgroundColor: currentTheme.light, color: currentTheme.primary }}
                                                        >
                                                            {getDeviceIcon(device.device_type)}
                                                        </div>
                                                        <div className="flex-1">
                                                            <h4 className="font-medium flex items-center gap-2">
                                                                {device.device_name || device.device_type || 'Unknown Device'}
                                                                {isCurrentDevice(device) && (
                                                                    <span className="text-xs px-2 py-1 rounded-full" style={{
                                                                        backgroundColor: `${currentTheme.primary}20`,
                                                                        color: currentTheme.primary
                                                                    }}>
                                                                        Current Device
                                                                    </span>
                                                                )}
                                                            </h4>
                                                            <div className="text-sm opacity-70 mt-1 space-y-1">
                                                                <p>{device.browser} on {device.os}</p>
                                                                <p>IP: {device.ip_address}</p>
                                                                <p>Last active: {new Date(device.last_activity).toLocaleString()}</p>
                                                                <p className="text-xs">Signed in: {new Date(device.created_at).toLocaleDateString()}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {!isCurrentDevice(device) && (
                                                        <button
                                                            onClick={() => logoutDevice(device.id)}
                                                            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80 flex items-center gap-2"
                                                            style={{
                                                                backgroundColor: '#FEE2E2',
                                                                color: '#DC2626'
                                                            }}
                                                        >
                                                            <LogOut size={16} />
                                                            Logout
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        
                                        {devices.length === 0 && (
                                            <div className="text-center py-8 opacity-70">
                                                <Smartphone size={48} className="mx-auto mb-4" />
                                                <p>No active devices found</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Appearance Tab */}
                            {activeTab === 'appearance' && (
                                <ThemeStudioPanel />
                            )}

                            {/* Profile Tab */}
                            {activeTab === 'profile' && (
                                <div>
                                    <h2 className="text-xl font-semibold mb-6">Profile Settings</h2>
                                    <div className="space-y-4">
                                        <Link 
                                            href="/profile" 
                                            className="p-4 rounded-lg hover:bg-opacity-80 transition-all flex items-center justify-between"
                                            style={{ backgroundColor: isDarkMode ? '#2a303c' : '#f8fafc' }}
                                        >
                                            <div className="flex items-center">
                                                <div className="w-10 h-10 rounded-full flex items-center justify-center mr-3"
                                                    style={{ backgroundColor: currentTheme.light, color: currentTheme.primary }}
                                                >
                                                    <User size={18} />
                                                </div>
                                                <div>
                                                    <h3 className="font-medium">View Profile</h3>
                                                    <p className="text-sm opacity-70">See how others view your profile</p>
                                                </div>
                                            </div>
                                            <ChevronRight size={20} className="opacity-60" />
                                        </Link>
                                        
                                        <Link 
                                            href="/settings/profile" 
                                            className=" p-4 rounded-lg hover:bg-opacity-80 transition-all flex items-center justify-between"
                                            style={{ backgroundColor: isDarkMode ? '#2a303c' : '#f8fafc' }}
                                        >
                                            <div className="flex items-center">
                                                <div className="w-10 h-10 rounded-full flex items-center justify-center mr-3"
                                                    style={{ backgroundColor: currentTheme.light, color: currentTheme.primary }}
                                                >
                                                    <SettingsIcon size={18} />
                                                </div>
                                                <div>
                                                    <h3 className="font-medium">Manage Profile</h3>
                                                    <p className="text-sm opacity-70">Update your profile information</p>
                                                </div>
                                            </div>
                                            <ChevronRight size={20} className="opacity-60" />
                                        </Link>
                                    </div>
                                </div>
                            )}

                            {/* Notifications Tab */}
                            {activeTab === 'notifications' && (
                                <div>
                                    <h2 className="text-xl font-semibold mb-6">Notification Preferences</h2>
                                    <div className="space-y-4">
                                        <Link 
                                            href="/settings/notifications" 
                                            className=" p-4 rounded-lg hover:bg-opacity-80 transition-all flex items-center justify-between"
                                            style={{ backgroundColor: isDarkMode ? '#2a303c' : '#f8fafc' }}
                                        >
                                            <div className="flex items-center">
                                                <div className="w-10 h-10 rounded-full flex items-center justify-center mr-3"
                                                    style={{ backgroundColor: currentTheme.light, color: currentTheme.primary }}
                                                >
                                                    <Bell size={18} />
                                                </div>
                                                <div>
                                                    <h3 className="font-medium">Notification Settings</h3>
                                                    <p className="text-sm opacity-70">Manage all your notification preferences</p>
                                                </div>
                                            </div>
                                            <ChevronRight size={20} className="opacity-60" />
                                        </Link>
                                    </div>
                                </div>
                            )}

                            {/* Security Tab */}
                            {activeTab === 'security' && (
                                <div>
                                    <h2 className="text-xl font-semibold mb-2">Security</h2>
                                    <p className="mb-6 text-sm opacity-75">All security management now lives in one place. Open the dedicated Security page to manage encryption, password, sessions, and account protection.</p>
                                    <div className="space-y-4">
                                        <Link 
                                            href="/security" 
                                            className="p-4 rounded-lg hover:bg-opacity-80 transition-all flex items-center justify-between"
                                            style={{ backgroundColor: isDarkMode ? '#2a303c' : '#f8fafc' }}
                                        >
                                            <div className="flex items-center">
                                                <div className="w-10 h-10 rounded-full flex items-center justify-center mr-3"
                                                    style={{ backgroundColor: currentTheme.light, color: currentTheme.primary }}
                                                >
                                                    <Shield size={18} />
                                                </div>
                                                <div>
                                                    <h3 className="font-medium">Open Full Security Center</h3>
                                                    <p className="text-sm opacity-70">Manage encryption, migration, password changes, active sessions, alerts, and account deletion</p>
                                                </div>
                                            </div>
                                            <ChevronRight size={20} className="opacity-60" />
                                        </Link>
                                    </div>
                                </div>
                            )}

                            {/* Integrations Tab */}
                            {activeTab === 'integrations' && (
                                <div>
                                    <h2 className="text-xl font-semibold mb-6">Integrations</h2>
                                    <div className="mb-6">
                                        <VektoriMemoryPanel
                                          settings={settings}
                                          saving={saving}
                                          isDarkMode={isDarkMode}
                                          accentColor={currentTheme.primary}
                                          onUpdateSettings={updateSettings}
                                        />
                                    </div>
                                    <div className="mb-6">
                                        <MessagingIntegrationPanel
                                          settings={settings}
                                          isDarkMode={isDarkMode}
                                          accentColor={currentTheme.primary}
                                          onUpdateSettings={updateSettings}
                                        />
                                    </div>
                                    <div className="mb-6">
                                        <CalendarIntegrationPanel />
                                    </div>
                                    <GmailIntegrationPanel />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;