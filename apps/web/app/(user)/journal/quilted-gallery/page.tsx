'use client';

import React, { useEffect } from 'react';
import AllJournalsGallery from '@/components/Journal/AllJournalsGallery';
import { createClient } from '@/utils/supabase/client';
import { initializeEncryption, isEncryptionInitialized } from '@/utils/encryption/keyManager';

const Gallery = () => {
  // Initialize encryption on mount
  useEffect(() => {
    async function initEncryption() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user && !isEncryptionInitialized()) {
          const isOAuthUser = user.app_metadata?.provider !== 'email';
          
          if (isOAuthUser) {
            const { autoInitializeEncryptionForOAuthUser } = await import('@/utils/encryption');
            await autoInitializeEncryptionForOAuthUser(user.id);
            console.log('[QuiltedGallery] Encryption initialized');
          }
        }
      } catch (err) {
        console.error('[QuiltedGallery] Failed to initialize encryption:', err);
      }
    }

    initEncryption();
  }, []);

  return (
    <div>
      <AllJournalsGallery />
    </div>
  );
};

export default Gallery; 
