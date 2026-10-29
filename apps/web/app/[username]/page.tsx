import { createAdminClient } from '@/utils/supabase/admin';
import AccessCodeGate from './AccessCodeGate';

type UsernamePageProps = {
  params: Promise<{ username: string }>;
};

const RESERVED_USERNAMES = new Set([
  'auth',
  'login',
  'signup',
  'register',
  'api',
  'waitlist',
  'pending-approval',
  'access-denied',
  'dashboard',
  'journal',
  'analysis',
  'settings',
  'profile',
  'security',
  'notifications',
  'todo',
  'vault',
  'new',
  'ocr',
  'onboarding',
]);

export default async function UsernameAccessPage({ params }: UsernamePageProps) {
  const { username: rawUsername } = await params;
  const username = decodeURIComponent(rawUsername || '').trim().toLowerCase();

  if (!username || RESERVED_USERNAMES.has(username)) {
    return (
      <main className="min-h-screen bg-[#f6efe6] text-[#2f2b26] px-6 py-12 md:py-20">
        <div className="mx-auto max-w-xl rounded-3xl border border-[#e6d7c4] bg-white/80 p-8 shadow-[0_20px_60px_-30px_rgba(81,57,36,0.35)]">
          <h1 className="text-2xl font-semibold">Invalid access path</h1>
          <p className="mt-3 text-[15px] text-[#6d5d4b]">
            This username path is reserved. Please use the exact access link sent in your email.
          </p>
        </div>
      </main>
    );
  }

  const admin = createAdminClient();
  const { data: codeRows, error: codeLookupError } = await admin
    .from('waitlist_access_codes')
    .select('waitlist_submission_id, email')
    .eq('username_slug', username)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1);

  if (codeLookupError || !codeRows || codeRows.length === 0) {
    return (
      <main className="min-h-screen bg-[#f6efe6] text-[#2f2b26] px-6 py-12 md:py-20">
        <div className="mx-auto max-w-xl rounded-3xl border border-[#e6d7c4] bg-white/80 p-8 shadow-[0_20px_60px_-30px_rgba(81,57,36,0.35)]">
          <h1 className="text-2xl font-semibold">No access found</h1>
          <p className="mt-3 text-[15px] text-[#6d5d4b]">
            We could not find an active access request for this username. Please check your invite email or contact support.
          </p>
        </div>
      </main>
    );
  }

  const accessRecord = codeRows[0];
  if (!accessRecord) {
    return (
      <main className="min-h-screen bg-[#f6efe6] text-[#2f2b26] px-6 py-12 md:py-20">
        <div className="mx-auto max-w-xl rounded-3xl border border-[#e6d7c4] bg-white/80 p-8 shadow-[0_20px_60px_-30px_rgba(81,57,36,0.35)]">
          <h1 className="text-2xl font-semibold">No access found</h1>
          <p className="mt-3 text-[15px] text-[#6d5d4b]">
            We could not find an active access request for this username. Please check your invite email or contact support.
          </p>
        </div>
      </main>
    );
  }

  const { data: waitlistRows } = await admin
    .from('waitlist_submissions')
    .select('name, email, status')
    .eq('id', accessRecord.waitlist_submission_id)
    .eq('status', 'approved')
    .limit(1);

  if (!waitlistRows || waitlistRows.length === 0) {
    return (
      <main className="min-h-screen bg-[#f6efe6] text-[#2f2b26] px-6 py-12 md:py-20">
        <div className="mx-auto max-w-xl rounded-3xl border border-[#e6d7c4] bg-white/80 p-8 shadow-[0_20px_60px_-30px_rgba(81,57,36,0.35)]">
          <h1 className="text-2xl font-semibold">Access not approved yet</h1>
          <p className="mt-3 text-[15px] text-[#6d5d4b]">
            Your waitlist request is not approved yet. Please wait for the approval email from the admin team.
          </p>
        </div>
      </main>
    );
  }

  const waitlistUser = waitlistRows[0];
  if (!waitlistUser) {
    return (
      <main className="min-h-screen bg-[#f6efe6] text-[#2f2b26] px-6 py-12 md:py-20">
        <div className="mx-auto max-w-xl rounded-3xl border border-[#e6d7c4] bg-white/80 p-8 shadow-[0_20px_60px_-30px_rgba(81,57,36,0.35)]">
          <h1 className="text-2xl font-semibold">Access not approved yet</h1>
          <p className="mt-3 text-[15px] text-[#6d5d4b]">
            Your waitlist request is not approved yet. Please wait for the approval email from the admin team.
          </p>
        </div>
      </main>
    );
  }

  const displayName = (waitlistUser.name || waitlistUser.email.split('@')[0] || 'there').trim();

  return <AccessCodeGate username={username} displayName={displayName} />;
}
