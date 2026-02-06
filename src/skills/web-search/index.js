/**
 * Web Search Skill
 * Uses Brave Search API or fallback to HTTP search
 */

import axios from 'axios';

/**
 * Execute web search
 */
export default async function webSearchSkill({ task, context }) {
  const results = {
    query: task,
    timestamp: new Date().toISOString(),
    sources: [],
    summary: '',
  };

  try {
    // Extract search query from task
    const query = extractSearchQuery(task);
    
    if (!query) {
      results.summary = 'No search query found in task';
      return results;
    }

    // Try Brave API if available
    if (process.env.BRAVE_API_KEY) {
      const braveResults = await searchBrave(query);
      results.sources = braveResults;
    } else {
      // Fallback to DuckDuckGo instant answer API
      const ddgResults = await searchDuckDuckGo(query);
      results.sources = ddgResults;
    }

    // Generate summary
    results.summary = generateSearchSummary(results.sources);
    
  } catch (error) {
    results.error = error.message;
    results.summary = `Search failed: ${error.message}`;
  }

  return results;
}

/**
 * Extract search query from task
 */
function extractSearchQuery(task) {
  // Common patterns
  const patterns = [
    /search (?:for |about |on )?["']([^"']+)["']/i,
    /find (?:information about |details on )?["']([^"']+)["']/i,
    /["']([^"']+)["']/,
  ];

  for (const pattern of patterns) {
    const match = task.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // Return task as query if no pattern matched
  return task.length > 10 ? task.substring(0, 100) : task;
}

/**
 * Search using Brave API
 */
async function searchBrave(query) {
  const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
    params: {
      q: query,
      count: 10,
    },
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': process.env.BRAVE_API_KEY,
    },
    timeout: 30000,
  });

  return response.data.web?.results?.map(result => ({
    title: result.title,
    url: result.url,
    description: result.description,
    publishedAt: result.published_at,
  })) || [];
}

/**
 * Search using DuckDuckGo (no API key needed)
 */
async function searchDuckDuckGo(query) {
  try {
    // Use HTML scraping for DuckDuckGo
    const response = await axios.get('https://html.duckduckgo.com/html/', {
      params: {
        q: query,
        kl: 'us-en',
      },
      timeout: 30000,
    });

    // Parse HTML results
    const results = [];
    const regex = /<a class="result__a" href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([^<]+)</g;
    let match;
    
    while ((match = regex.exec(response.data)) !== null && results.length < 5) {
      results.push({
        title: match[2]?.trim(),
        url: match[1],
        description: match[3]?.trim(),
      });
    }

    return results;
  } catch (error) {
    // Fallback to alternative
    return [{ error: 'Search failed', message: error.message }];
  }
}

/**
 * Generate search summary
 */
function generateSearchSummary(sources) {
  if (!sources || sources.length === 0) {
    return 'No results found';
  }

  const count = sources.length;
  const validSources = sources.filter(s => s.title || s.url);
  
  return `Found ${count} result${count > 1 ? 's' : ''} for your query. Top result: "${validSources[0]?.title || 'N/A'}"`;
}
