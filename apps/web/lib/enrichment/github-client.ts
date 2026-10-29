/**
 * Force V2 — GitHub Public REST API Client
 * Zero-auth public technical footprint pull (bio, top repos, primary languages, starred topics).
 *
 * @author Rohit (Context & Platform Engineering)
 * @version 2.0.0
 */

export interface GitHubProfileData {
  username: string;
  name?: string;
  bio?: string;
  company?: string;
  location?: string;
  public_repos: number;
  followers: number;
  top_languages: string[];
  top_repositories: Array<{
    name: string;
    description?: string;
    language?: string;
    stargazers_count: number;
    html_url: string;
  }>;
  public_url: string;
}

export interface GitHubFetchResponse {
  data: GitHubProfileData | null;
  success: boolean;
  error?: string;
}

export async function fetchGitHubProfile(usernameOrUrl: string): Promise<GitHubFetchResponse> {
  const startTime = Date.now();

  // Extract clean username (robust against repeated prefixes or full URLs)
  let cleanUsername = usernameOrUrl.trim().replace(/^@/, '');
  if (cleanUsername.includes('github.com/')) {
    const parts = cleanUsername.split('github.com/').pop();
    cleanUsername = parts ? (parts.split('/')[0]?.split('?')[0] ?? '') : '';
  } else {
    cleanUsername = cleanUsername.replace(/\/.*$/, '').split('?')[0] ?? '';
  }
  cleanUsername = cleanUsername.replace(/^[^\w-]+|[^\w-]+$/g, '').trim();

  if (!cleanUsername) {
    console.warn('⚠️ [Enrichment:GitHub] Invalid username provided:', usernameOrUrl);
    return {
      data: null,
      success: false,
      error: 'Invalid GitHub username',
    };
  }

  console.log(`🐱 [Enrichment:GitHub] Fetching public technical profile for @${cleanUsername}...`);

  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Force-App-V2-ContextEngine',
  };

  // Optional token if provided to avoid strict IP rate-limits
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
  }

  try {
    // 1. Fetch user bio
    const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanUsername)}`, {
      headers,
      signal: AbortSignal.timeout(4000),
    });

    if (userRes.status === 404) {
      console.warn(`⚠️ [Enrichment:GitHub] User @${cleanUsername} not found (404)`);
      return {
        data: null,
        success: false,
        error: `GitHub user @${cleanUsername} not found.`,
      };
    }

    if (!userRes.ok) {
      console.error(`❌ [Enrichment:GitHub] Profile lookup failed (HTTP ${userRes.status})`);
      return {
        data: null,
        success: false,
        error: `GitHub API error: ${userRes.status}`,
      };
    }

    const userData = await userRes.json();

    // 2. Fetch public repos
    const reposRes = await fetch(
      `https://api.github.com/users/${encodeURIComponent(cleanUsername)}/repos?sort=updated&per_page=10`,
      { headers, signal: AbortSignal.timeout(4000) }
    );

    let reposData: any[] = [];
    if (reposRes.ok) {
      reposData = await reposRes.json();
    }

    const languagesCount: Record<string, number> = {};
    const topRepos = reposData.slice(0, 5).map((r) => {
      if (r.language) {
        languagesCount[r.language] = (languagesCount[r.language] || 0) + 1;
      }
      return {
        name: r.name,
        description: r.description,
        language: r.language,
        stargazers_count: r.stargazers_count,
        html_url: r.html_url,
      };
    });

    const sortedLanguages = Object.entries(languagesCount)
      .sort((a, b) => b[1] - a[1])
      .map(([lang]) => lang);

    const durationMs = Date.now() - startTime;
    console.log(`✅ [Enrichment:GitHub] Fetched @${cleanUsername} in ${durationMs}ms:`, {
      name: userData.name,
      bio: userData.bio,
      repos: userData.public_repos,
      languages: sortedLanguages.slice(0, 4),
    });

    return {
      data: {
        username: cleanUsername,
        name: userData.name,
        bio: userData.bio,
        company: userData.company,
        location: userData.location,
        public_repos: userData.public_repos,
        followers: userData.followers,
        top_languages: sortedLanguages,
        top_repositories: topRepos,
        public_url: `https://github.com/${cleanUsername}`,
      },
      success: true,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    console.error(`❌ [Enrichment:GitHub] Failed in ${durationMs}ms:`, error?.message || error);
    return {
      data: null,
      success: false,
      error: error?.name === 'TimeoutError' ? 'GitHub API timed out after 4s' : error?.message,
    };
  }
}
