// apps/web/components/settings/PasswordChangeSection.tsx
'use client';

// Deprecated: full password/security management lives in /security.
// Keep this component only for backward compatibility until safe removal.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';

interface PasswordChangeSectionProps {
  onPasswordChanged?: () => void;
}

export function PasswordChangeSection({ onPasswordChanged }: PasswordChangeSectionProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Check if migration is needed
  useEffect(() => {
    checkMigrationStatus();
  }, []);

  const checkMigrationStatus = async () => {
    try {
      const response = await fetch('/api/user/migrate-encryption');
      const data = await response.json();
      
      setMigrationNeeded(!data.isMigrated);
      setMigrationComplete(data.isMigrated);
    } catch (error) {
      console.error('Failed to check migration status:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleMigration = async () => {
    if (!currentPassword) {
      setMessage({ type: 'error', text: 'Please enter your current password' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/user/migrate-encryption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: currentPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: 'success',
          text: data.message || 'Migration completed successfully!',
        });
        setMigrationNeeded(false);
        setMigrationComplete(true);
        setCurrentPassword('');
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Migration failed',
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to migrate encryption. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: 'All fields are required' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }

    if (migrationNeeded) {
      setMessage({
        type: 'error',
        text: 'Please migrate your account first before changing password',
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: 'success',
          text: data.message || 'Password changed successfully!',
        });
        // Clear form
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onPasswordChanged?.();
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to change password',
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to change password. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingStatus) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Checking encryption status...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Password & Security
        </CardTitle>
        <CardDescription>
          {migrationNeeded
            ? 'Your account needs to be upgraded to enable safe password changes'
            : 'Change your password securely without affecting your encrypted journals'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Migration Warning */}
        {migrationNeeded && (
          <div className="flex gap-3 p-4 border border-yellow-200 bg-yellow-50 rounded-md">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-yellow-600" />
            <div className="text-sm text-yellow-800">
              <strong>Action Required:</strong> Your account uses an older encryption system.
              Please migrate to the new system to enable password changes. This process will
              re-encrypt your journals with a master key, allowing you to change passwords
              safely in the future.
            </div>
          </div>
        )}

        {/* Migration Success */}
        {migrationComplete && !migrationNeeded && (
          <div className="flex gap-3 p-4 border border-green-200 bg-green-50 rounded-md">
            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-green-600" />
            <div className="text-sm text-green-800">
              Your account is using the master key system. Password changes are safe and won't
              affect your encrypted journals.
            </div>
          </div>
        )}

        {/* Message Display */}
        {message && (
          <div className={`flex gap-3 p-4 rounded-md ${message.type === 'error' ? 'border border-red-200 bg-red-50' : 'border border-green-200 bg-green-50'}`}>
            <div className={`text-sm ${message.type === 'error' ? 'text-red-800' : 'text-green-800'}`}>
              {message.text}
            </div>
          </div>
        )}

        {/* Current Password Field (always shown) */}
        <div className="space-y-2">
          <Label htmlFor="current-password">Current Password</Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter your current password"
            disabled={loading}
          />
        </div>

        {/* Migration Button */}
        {migrationNeeded && (
          <Button
            onClick={handleMigration}
            disabled={loading || !currentPassword}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Migrating...
              </>
            ) : (
              'Migrate to Master Key System'
            )}
          </Button>
        )}

        {/* Password Change Fields (only after migration) */}
        {!migrationNeeded && (
          <>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 8 characters)"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                disabled={loading}
              />
            </div>

            <Button
              onClick={handlePasswordChange}
              disabled={loading || !currentPassword || !newPassword || !confirmPassword}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Changing Password...
                </>
              ) : (
                'Change Password'
              )}
            </Button>
          </>
        )}

        {/* Info Text */}
        <p className="text-sm text-muted-foreground">
          {migrationNeeded
            ? 'Migration is a one-time process and typically takes a few seconds. Your journals will remain encrypted and secure.'
            : 'After changing your password, you\'ll need to sign in again with your new password. If your current password is not accepted, use Forgot Password first.'}
        </p>

        <p className="text-xs text-muted-foreground">
          Need to create your first password?{' '}
          <Link href="/forgot-password" className="underline">
            Use Forgot Password
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
