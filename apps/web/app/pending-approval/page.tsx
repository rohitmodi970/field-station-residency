'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Clock, Mail, LogOut, CheckCircle2, Zap } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

function PendingApprovalContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reason = searchParams.get('reason');
  const emailParam = searchParams.get('email');
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
      } else if (emailParam) {
        // If no user but email in params (from OAuth signout)
        setUserEmail(emailParam);
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 px-4">
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
            className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center"
          >
            <Clock className="w-10 h-10 text-purple-600" />
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4"
          >
            Your Access is Pending
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-lg text-center text-gray-600 mb-8"
          >
            {reason === 'oauth' 
              ? "Thank you for signing in with Google! Please join our waitlist first to get access."
              : reason === 'not_in_waitlist' 
              ? "Thank you for signing up! Your application is pending review."
              : "Thanks for joining! We're reviewing your application."}
          </motion.p>

          {/* Info Box */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 mb-8"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">
                <Mail className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2">What happens next?</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Our team is reviewing applications on a rolling basis</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>You'll receive an email notification once approved</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>After approval, you can log in and access all features</span>
                  </li>
                </ul>
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
              <p className="text-sm text-gray-500 mb-1">Registered email:</p>
              <p className="text-lg font-medium text-gray-900">{userEmail}</p>
            </motion.div>
          )}

          {/* Feature Preview */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="border-t pt-8 mb-8"
          >
            <h3 className="text-xl font-semibold text-center text-gray-900 mb-6 flex items-center justify-center gap-2">
              <Zap className="w-6 h-6 text-purple-600" />
              What you'll get with FORCE
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-4">
                <div className="w-12 h-12 mx-auto mb-3 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">🧠</span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Mind Mapping</h4>
                <p className="text-sm text-gray-600">Visualize your thoughts and goals</p>
              </div>
              <div className="text-center p-4">
                <div className="w-12 h-12 mx-auto mb-3 bg-pink-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">📝</span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Journaling</h4>
                <p className="text-sm text-gray-600">Track your personal growth journey</p>
              </div>
              <div className="text-center p-4">
                <div className="w-12 h-12 mx-auto mb-3 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">🎯</span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Goal Tracking</h4>
                <p className="text-sm text-gray-600">Turn aspirations into achievements</p>
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
            Questions? Contact us at{' '}
            <a href="mailto:support@force.app" className="text-purple-600 hover:text-purple-700 font-medium">
              support@force.app
            </a>
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}

export default function PendingApprovalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-amber-50">
          <div className="text-xl">Loading...</div>
        </div>
      }
    >
      <PendingApprovalContent />
    </Suspense>
  );
}
