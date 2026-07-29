export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.GITHUB_TOKEN;
  const { run_id } = req.query; // We will pass the run ID from the frontend

  if (!token || !run_id) {
    return res.status(400).json({ error: 'Missing token or run_id' });
  }

  try {
    // 1. Check Workflow Status
    const statusRes = await fetch(
      `https://api.github.com/repos/My-Memory-2008/VHEER-IMAGE-TO-IMAGE-GENERATOR/actions/runs/${run_id}`,
      { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' } }
    );
    
    const statusData = await statusRes.json();
    const conclusion = statusData.conclusion;
    const status = statusData.status;

    if (status === 'completed' && conclusion === 'success') {
      // 2. Get Artifacts
      const artRes = await fetch(
        `https://api.github.com/repos/My-Memory-2008/VHEER-IMAGE-TO-IMAGE-GENERATOR/actions/runs/${run_id}/artifacts`,
        { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' } }
      );
      
      const artData = await artRes.json();
      if (artData.artifacts && artData.artifacts.length > 0) {
        // Return the archive URL (Vercel will proxy this download)
        return res.status(200).json({ 
          status: 'success', 
          artifact_url: artData.artifacts[0].archive_download_url 
        });
      }
    }

    return res.status(200).json({ status: status, conclusion: conclusion });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
