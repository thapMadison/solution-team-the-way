// GitHub API Configuration
const GITHUB_CONFIG = {
  owner: 'thapMadison',
  repo: 'solution-team-the-way',
  token: 'github_pat_REPLACE_WITH_YOUR_TOKEN', // Replace with actual Fine-grained PAT
  branch: 'main',
  apiBase: 'https://api.github.com',

  // Data paths
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
  // Get file from GitHub
  async getFile(path) {
    const url = `${GITHUB_CONFIG.apiBase}/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${GITHUB_CONFIG.token}`,
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
    const content = atob(data.content);

    return {
      content: JSON.parse(content),
      sha: data.sha
    };
  },

  // Create or update file on GitHub
  async putFile(path, content, message, sha = null) {
    const url = `${GITHUB_CONFIG.apiBase}/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}`;

    const body = {
      message: message,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2)))),
      branch: GITHUB_CONFIG.branch
    };

    if (sha) {
      body.sha = sha; // Required for updates
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_CONFIG.token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`GitHub API error: ${error.message || response.statusText}`);
    }

    return await response.json();
  },

  // Delete file from GitHub
  async deleteFile(path, sha, message) {
    const url = `${GITHUB_CONFIG.apiBase}/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${GITHUB_CONFIG.token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: message,
        sha: sha,
        branch: GITHUB_CONFIG.branch
      })
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    return await response.json();
  }
};
