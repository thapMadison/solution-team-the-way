// GitHub API Configuration
const GITHUB_CONFIG = {
  owner: 'thapMadison',
  repo: 'solution-team-the-way',
  // Token chỉ cần quyền trigger workflow (không cần Contents write)
  // Permissions: Actions = Read and Write
  token: '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', // Replace with Fine-grained PAT
  branch: 'main',
  apiBase: 'https://api.github.com',

  // Data paths (for reading)
  requestsDataPath: 'data/requests',
  requestsIndexPath: 'data/requests-index.json',

  // Team members for assignment
  teamMembers: [
    'Unassigned',
    'Thap Nguyen',
    'Team Member 2',
    'Team Member 3',
    'Team Member 4',
    'Team Member 5'
  ]
};

// GitHub API helper functions
const GitHubAPI = {
  // Get file from GitHub (unauthenticated - works for public repos)
  async getFile(path) {
    const url = `${GITHUB_CONFIG.apiBase}/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github+json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // File doesn't exist
      }
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Decode base64 content
    const content = atob(data.content.replace(/\s/g, ''));

    return {
      content: JSON.parse(content),
      sha: data.sha
    };
  },

  // Trigger GitHub Action via repository_dispatch
  async dispatchAction(eventType, payload) {
    const url = `${GITHUB_CONFIG.apiBase}/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/dispatches`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_CONFIG.token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event_type: eventType,
        client_payload: payload
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub Actions dispatch error: ${response.status} ${error}`);
    }

    // repository_dispatch returns 204 No Content on success
    return { success: true };
  }
};
