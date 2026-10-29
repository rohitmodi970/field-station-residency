"use client";

import React, { useState, useEffect } from 'react';
import Layout from "@/components/layout/Layout";
import { getAllJournalEntries } from "@/utilities/journal-data";
import JournalGallery from "@/components/Journal/JournalGallery";
import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { JournalEntry } from "@/components/Journal/types";
import { createClient } from '@/utils/supabase/client';
import { initializeEncryption, isEncryptionInitialized } from '@/utils/encryption/keyManager';

const JournalGalleryPage = () => {
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Initialize encryption on mount
    useEffect(() => {
        async function initEncryption() {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                
                if (user && !isEncryptionInitialized()) {
                    // Try to restore from IndexedDB first
                    const { restoreEncryptionFromCache } = await import('@/utils/encryption/keyManager');
                    const restored = await restoreEncryptionFromCache(user.id);
                    
                    if (restored) {
                        console.log('[JournalGallery] Encryption restored from cache');
                        return;
                    }
                    
                    // If not restored, try auto-initialization for OAuth users
                    const isOAuthUser = user.app_metadata?.provider !== 'email';
                    
                    if (isOAuthUser) {
                        const { autoInitializeEncryptionForOAuthUser } = await import('@/utils/encryption');
                        await autoInitializeEncryptionForOAuthUser(user.id);
                        console.log('[JournalGallery] Encryption initialized for OAuth user');
                    }
                    // For email users, encryption should already be in IndexedDB from login
                }
            } catch (err) {
                console.error('[JournalGallery] Failed to initialize encryption:', err);
            }
        }

        initEncryption();
    }, []);

    useEffect(() => {
        async function loadJournalEntries() {
            try {
                setIsLoading(true);
                const fetchedEntries = await getAllJournalEntries();
                setEntries(fetchedEntries);
                console.log('Fetched journal entries:', fetchedEntries);
            } catch (err) {
                console.error('Failed to load journal entries:', err);
                setError('Failed to load journal entries. Please try again later.');
            } finally {
                setIsLoading(false);
            }
        }

        loadJournalEntries();
    }, []);

    return (
        <Layout>
            <div className="max-w-7xl mx-auto">
                {isLoading ? (
                    <div className="text-center py-8">
                        <p>Loading your journal entries...</p>
                    </div>
                ) : error ? (
                    <div className="text-center py-8 text-red-500">
                        <p>{error}</p>
                    </div>
                ) : entries.length === 0 ? (
                    <div className="text-center py-8">
                        <p>No journal entries found. Start creating your first entry!</p>
                    </div>
                ) : (
                    <JournalGallery entries={entries} />
                )}
            </div>
            <div className="fixed bottom-8 right-8 z-50">
                <Link
                    href="/journal/new"
                    className="flex items-center gap-2 bg-amber-800 hover:bg-primary/90 text-white px-4 py-2 rounded-full shadow-lg transition-colors"
                >
                    <NotebookPen className="w-5 h-5" />
                    <span>New Entry</span>
                </Link>
            </div>
        </Layout>
    );
};

export default JournalGalleryPage;