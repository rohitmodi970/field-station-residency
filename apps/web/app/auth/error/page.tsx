'use client'

import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

// Separate component to handle search params
const AuthErrorContent = () => {
    const searchParams = useSearchParams()
    const error = searchParams.get('error')
    
    // Map error codes to user-friendly messages
    const getErrorMessage = (errorCode: string | null) => {
        switch (errorCode) {
            case 'CredentialsSignin':
                return 'Invalid credentials. Please check your email and password.'
            case 'AccessDenied':
                return 'Access denied. You don\'t have permission to sign in.'
            case 'OAuthSignin':
            case 'OAuthCallback':
            case 'OAuthCreateAccount':
                return 'There was a problem with your Google sign in. Please try again.'
            case 'EmailCreateAccount':
                return 'There was a problem creating your account. Please try again.'
            case 'Callback':
                return 'There was a problem during the authentication process.'
            case 'Configuration':
                return 'There is a configuration issue. Please contact support.'
            case 'Verification':
                return 'The verification token is invalid or has expired.'
            case 'Default':
                return 'Authentication failed. Please try again.'
            default:
                return error 
                    ? 'An unexpected authentication error occurred. Please try again.'
                    : 'Email verification may have failed. Please check if your email is already verified or request a new verification link.'
        }
    }

    const getErrorTitle = (errorCode: string | null) => {
        switch (errorCode) {
            case 'CredentialsSignin':
                return 'Invalid Credentials'
            case 'AccessDenied':
                return 'Access Denied'
            case 'OAuthSignin':
            case 'OAuthCallback':
            case 'OAuthCreateAccount':
                return 'OAuth Error'
            case 'EmailCreateAccount':
                return 'Account Creation Failed'
            case 'Callback':
                return 'Authentication Failed'
            case 'Configuration':
                return 'Configuration Error'
            case 'Verification':
                return 'Verification Failed'
            default:
                return 'Verification Issue'
        }
    }

    const shouldShowRetry = (errorCode: string | null) => {
        // Don't show retry for configuration errors or access denied 
        // Don't show retry for configuration errors or access denied 
        return errorCode !== 'Configuration' && errorCode !== 'AccessDenied'
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-gray-800 rounded-xl shadow-2xl p-8">
                <div className="text-center">
                    <div className="mx-auto h-12 w-12 text-yellow-500">
                        <svg
                            className="h-12 w-12"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.268 18.5c-.77.833.192 2.5 1.732 2.5z"
                            />
                        </svg>
                    </div>
                    <h2 className="mt-6 text-3xl font-extrabold text-white">
                        {getErrorTitle(error)}
                    </h2>
                    <div className="mt-4 space-y-2">
                        <p className="text-lg text-gray-300">
                            {getErrorMessage(error)}
                        </p>
                        {error && (
                            <p className="text-sm text-gray-500">
                                Error code: {error}
                            </p>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <Link
                        href="/login"
                        className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                        Go to Login
                    </Link>
                    
                    <Link
                        href="/register"
                        className="group relative w-full flex justify-center py-3 px-4 border border-gray-600 text-sm font-medium rounded-lg text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                    >
                        Register New Account
                    </Link>

                    <Link
                        href="/"
                        className="group relative w-full flex justify-center py-3 px-4 border border-gray-600 text-sm font-medium rounded-lg text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                    >
                        Go to Homepage
                    </Link>
                </div>

                {/* Additional help text */}
                <div className="text-center">
                    <p className="text-sm text-gray-400">
                        Need help?{' '}
                        <Link
                            href="/login"
                            className="text-blue-400 hover:text-blue-300 underline"
                        >
                            Try logging in
                        </Link>
                        {' '}or check your email for the verification link.
                    </p>
                </div>
            </div>
        </div>
    )
}

// Loading fallback component
const LoadingFallback = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800">
        <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-400">Loading...</p>
        </div>
    </div>
)

// Main component with Suspense boundary
const AuthErrorPage = () => {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <AuthErrorContent />
        </Suspense>
    )
}

export default AuthErrorPage
