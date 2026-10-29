'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { XCircle, Mail, LogOut, HelpCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

function AccessDeniedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reason = searchParams.get('reason');
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUserStatus();
  }, []);

  const checkUserStatus = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user?.email) {
        setUserEmail(user.email);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error checking user status:', error);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full"
      >
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12">
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-red-100 to-orange-100 rounded-full flex items-center justify-center"
          >
            <XCircle className="w-10 h-10 text-red-600" />
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4"
          >
            Access Not Available
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-lg text-center text-gray-600 mb-8"
          >
            Unfortunately, we're unable to grant access to FORCE at this time.
          </motion.p>

          {/* Info Box */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-6 mb-8"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">
                <HelpCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2">Why was my application not approved?</h3>
                <p className="text-gray-700 mb-4">
                  We carefully review each application to ensure FORCE is the right fit. At this time, we're prioritizing users who align closely with our platform's mission and values.
                </p>
                <p className="text-gray-700">
                  This doesn't mean you can't join in the future! We encourage you to reapply or stay updated with our announcements.
                </p>
              </div>
            </div>
          </motion.div>

          {/* User Email Display */}
          {userEmail && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-center mb-8"
            >
              <p className="text-sm text-gray-500 mb-1">Account email:</p>
              <p className="text-lg font-medium text-gray-900">{userEmail}</p>
            </motion.div>
          )}

          {/* Next Steps */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="border-t pt-8 mb-8"
          >
            <h3 className="text-xl font-semibold text-center text-gray-900 mb-6">
              What you can do
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <Mail className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Contact Support</h4>
                  <p className="text-sm text-gray-600">
                    If you believe this was a mistake, reach out to our team for clarification.
                  </p>
                  <a
                    href="mailto:support@force.app"
                    className="text-purple-600 hover:text-purple-700 font-medium text-sm mt-2 inline-block"
                  >
                    support@force.app →
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <span className="text-2xl">🔔</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Stay Updated</h4>
                  <p className="text-sm text-gray-600">
                    Join our newsletter to be notified when we open applications again.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <span className="text-2xl">🌐</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Follow Our Journey</h4>
                  <p className="text-sm text-gray-600">
                    Stay connected on social media for updates and announcements.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <button
              onClick={() => router.push('/')}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:shadow-lg transition-all duration-300 hover:scale-105"
            >
              Return to Home
            </button>
            <button
              onClick={handleLogout}
              className="px-8 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </motion.div>

          {/* Help Text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="text-center text-sm text-gray-500 mt-8"
          >
            We appreciate your interest in FORCE. Thank you for understanding.
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}

export default function AccessDeniedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50">
          <div className="text-xl">Loading...</div>
        </div>
      }
    >
      <AccessDeniedContent />
    </Suspense>
  );
}
