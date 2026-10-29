// Daily cron: send unfinished tasks digest email at 12:00 PM IST (06:30 UTC).

import { NextRequest, NextResponse } from 'next/server';
import { notificationService } from '@/utils/notifications/notificationService';

const CRON_SECRET = process.env.CRON_SECRET;

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const digest = await notificationService.runDailyImportantTasksDigestSweep();

    return NextResponse.json({
      success: true,
      digest,
      message: 'Daily unfinished tasks digest email sweep completed',
    });
  } catch (err) {
    console.error('[DailyTasksEmail] Critical error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
