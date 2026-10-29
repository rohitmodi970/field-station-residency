// app\api\prompts\random\route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Hardcoded prompts for now - will be replaced with LLM-generated content later
const loadingPrompt = {
  text: "Loading a thoughtful prompt...",
  explanation: "Give us a moment while we fetch a tailored journaling prompt for you."
}

// Prompts are stored in the `journal_prompts` table in Supabase (columns: `text`, `explanation`).
// This endpoint now queries the DB instead of returning a hardcoded list.

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get('loading') === 'true') {
      return NextResponse.json(loadingPrompt, { status: 200 })
    }

    // Verify authentication with Supabase
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch prompts from Supabase
    const { data: prompts, error: dbError } = await supabase
      .from('journal_prompts')
      .select('text, explanation')

    if (dbError) {
      console.error('Error fetching prompts from DB:', dbError)
      // Fall back to loading prompt to avoid client errors
      return NextResponse.json(loadingPrompt, { status: 200 })
    }

    if (!prompts || prompts.length === 0) {
      return NextResponse.json(loadingPrompt, { status: 200 })
    }

    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)]
    return NextResponse.json(randomPrompt, { status: 200 })
  } catch (error) {
    console.error("Error in random prompt API:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
