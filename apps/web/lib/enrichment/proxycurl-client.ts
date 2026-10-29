/**
 * Force V2 — Proxycurl LinkedIn API Client
 * Fetches verified LinkedIn career history, current role, and skills.
 *
 * @author Rohit (Context & Platform Engineering)
 * @version 2.0.0
 */

export interface LinkedInProfileData {
  full_name?: string;
  headline?: string;
  summary?: string;
  current_role?: string;
  current_company?: string;
  experiences?: Array<{
    title: string;
    company: string;
    starts_at?: { year: number; month?: number };
    ends_at?: { year: number; month?: number };
    description?: string;
  }>;
  skills?: string[];
  education?: Array<{
    school: string;
    degree_name?: string;
    field_of_study?: string;
  }>;
  languages?: string[];
  public_url?: string;
}

export interface ProxycurlResponse {
  data: LinkedInProfileData | null;
  success: boolean;
  error?: string;
}

export async function fetchProxycurlLinkedIn(profileUrl: string): Promise<ProxycurlResponse> {
  const apiKey = process.env.PROXYCURL_API_KEY;

  if (!apiKey) {
    console.warn('[ProxycurlClient] PROXYCURL_API_KEY is not configured in environment.');
    return {
      data: null,
      success: false,
      error: 'PROXYCURL_API_KEY not configured',
    };
  }

  // Basic URL cleanup
  const cleanUrl = profileUrl.trim().replace(/\/$/, '');

  try {
    const endpoint = `https://nubela.co/proxycurl/api/v2/linkedin?url=${encodeURIComponent(cleanUrl)}&fallback_to_cache=on-error&use_cache=if-present&skills=include`;
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(5000), // 5s timeout budget
    });

    if (response.status === 404) {
      return {
        data: null,
        success: false,
        error: 'LinkedIn profile not found or profile is completely private.',
      };
    }

    if (!response.ok) {
      const errText = await response.text();
      return {
        data: null,
        success: false,
        error: `Proxycurl returned ${response.status}: ${errText}`,
      };
    }

    const json = await response.json();
    const currentExp = json.experiences?.[0];

    const structuredData: LinkedInProfileData = {
      full_name: `${json.first_name || ''} ${json.last_name || ''}`.trim(),
      headline: json.headline,
      summary: json.summary,
      current_role: currentExp?.title,
      current_company: currentExp?.company,
      experiences: (json.experiences || []).slice(0, 5).map((exp: any) => ({
        title: exp.title,
        company: exp.company,
        starts_at: exp.starts_at,
        ends_at: exp.ends_at,
        description: exp.description,
      })),
      skills: json.skills || [],
      education: (json.education || []).slice(0, 3).map((edu: any) => ({
        school: edu.school,
        degree_name: edu.degree_name,
        field_of_study: edu.field_of_study,
      })),
      languages: json.languages || [],
      public_url: cleanUrl,
    };

    return {
      data: structuredData,
      success: true,
    };
  } catch (error: any) {
    console.error('[ProxycurlClient] LinkedIn fetch error:', error?.message || error);
    return {
      data: null,
      success: false,
      error: error?.name === 'TimeoutError' ? 'Proxycurl request timed out after 5s' : error?.message,
    };
  }
}
