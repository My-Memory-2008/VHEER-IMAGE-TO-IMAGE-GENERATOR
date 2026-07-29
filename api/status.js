export default async function handler(req, res) {
  // Allow CORS just in case
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.GITHUB_TOKEN;
  const { run_id } = req.query;

  if (!token || !run_id) {
    return res.status(400).json({ error: 'Missing token or run_id' });
  }

  try {
    const url = `https://api.github.com/repos/My-Memory-2008/VHEER-IMAGE-TO-IMAGE-GENERATOR/actions/runs/${run_id}`;
    
    const response = await fetch(url, {
      headers: { 
        'Authorization': `Bearer ${token}`, 
        'Accept': 'application/vnd.github.v3+json' 
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }

    const data = await response.json();

    // Return EXACTLY what the HTML expects
    return res.status(200).json({ 
      status: data.status,       // e.g., "queued", "in_progress", "completed"
      conclusion: data.conclusion // e.g., "success", "failure", null
    });

  } catch (error) {
    console.error("Status Check Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
