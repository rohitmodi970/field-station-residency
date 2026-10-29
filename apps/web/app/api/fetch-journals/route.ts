// apps/web/app/api/fetch-journals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    // Use getSession() to read from cookies instead of making HTTP call
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user;

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const page = parseInt(searchParams.get('page') || '1');
    const mood = searchParams.get('mood');
    const tag = searchParams.get('tag');
    const sortByParam = searchParams.get('sortBy') || 'created_at';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const search = searchParams.get('search');

    // Map camelCase to snake_case for database columns
    const sortByMap: Record<string, string> = {
      'createdAt': 'created_at',
      'updatedAt': 'updated_at',
      'created_at': 'created_at',
      'updated_at': 'updated_at',
      'date': 'date',
      'title': 'title',
      'word_count': 'word_count',
      'wordCount': 'word_count'
    };
    
    const sortBy = sortByMap[sortByParam] || 'created_at';

    const adminClient = createAdminClient();
    
    // Start building query
    let query = adminClient
      .from('journals')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('is_deleted', false);

    // Apply filters
    if (mood) {
      query = query.ilike('mood', `%${mood}%`);
    }

    if (tag) {
      query = query.contains('tags', [tag]);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }

    // Apply sorting
    const ascending = sortOrder === 'asc';
    query = query.order(sortBy, { ascending });

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: journals, error, count } = await query;

    if (error) {
      console.error("Error fetching journals:", error);
      return NextResponse.json({ error: "Failed to fetch journals" }, { status: 500 });
    }

    const totalPages = count ? Math.ceil(count / limit) : 0;

    return NextResponse.json({
      journals: journals || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages
      }
    }, { status: 200 });

  } catch (error) {
    console.error("Error in fetch journals API:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
