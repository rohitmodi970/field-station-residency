import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getVektoriMetrics, getVektoriRuntimeStatus, healthCheckVektori } from '@/utils/vektori/client';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const runtime = getVektoriRuntimeStatus();
    const metrics = getVektoriMetrics();
    const health = await healthCheckVektori();

    return NextResponse.json(
      {
        ok: health.ok,
        runtime,
        metrics,
        service: health,
      },
      { status: health.ok ? 200 : 503 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
