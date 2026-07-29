// export default async function handler(req, res) {
//   // Allow CORS just in case
//   res.setHeader('Access-Control-Allow-Origin', '*');
  
//   if (req.method !== 'GET') {
//     return res.status(405).json({ error: 'Method not allowed' });
//   }

//   const token = process.env.GITHUB_TOKEN;
//   const { run_id } = req.query;

//   if (!token || !run_id) {
//     return res.status(400).json({ error: 'Missing token or run_id' });
//   }

//   try {
//     const url = `https://api.github.com/repos/My-Memory-2008/VHEER-IMAGE-TO-IMAGE-GENERATOR/actions/runs/${run_id}`;
    
//     const response = await fetch(url, {
//       headers: { 
//         'Authorization': `Bearer ${token}`, 
//         'Accept': 'application/vnd.github.v3+json' 
//       }
//     });

//     if (!response.ok) {
//       throw new Error(`GitHub API returned ${response.status}`);
//     }

//     const data = await response.json();

//     // Return EXACTLY what the HTML expects
//     return res.status(200).json({ 
//       status: data.status,       // e.g., "queued", "in_progress", "completed"
//       conclusion: data.conclusion // e.g., "success", "failure", null
//     });

//   } catch (error) {
//     console.error("Status Check Error:", error);
//     return res.status(500).json({ error: error.message });
//   }
// }


import JSZip from 'jszip'; // Note: You might need to run 'npm install jszip' locally before pushing if Vercel complains, 
                           // but usually Vercel handles standard imports. If not, use the fetch-blob method below.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.GITHUB_TOKEN;
  const { run_id } = req.query;

  if (!token || !run_id) {
    return res.status(400).json({ error: 'Missing token or run_id' });
  }

  try {
    // 1. Check Workflow Status
    const runUrl = `https://api.github.com/repos/My-Memory-2008/VHEER-IMAGE-TO-IMAGE-GENERATOR/actions/runs/${run_id}`;
    const runRes = await fetch(runUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    const runData = await runRes.json();

    if (runData.status !== 'completed') {
      return res.status(200).json({ status: runData.status, conclusion: runData.conclusion });
    }

    if (runData.conclusion !== 'success') {
      return res.status(200).json({ status: 'completed', conclusion: runData.conclusion });
    }

    // 2. Get Artifacts (Grab the first one since there is only one)
    const artUrl = `https://api.github.com/repos/My-Memory-2008/VHEER-IMAGE-TO-IMAGE-GENERATOR/actions/runs/${run_id}/artifacts`;
    const artRes = await fetch(artUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    const artData = await artRes.json();

    if (artData.artifacts && artData.artifacts.length > 0) {
      const artifact = artData.artifacts[0];
      
      // 3. Get the Redirect URL for the ZIP
      const zipUrl = artifact.archive_download_url;
      
      // We must follow the redirect manually to get the actual storage URL
      const redirectRes = await fetch(zipUrl, { 
        headers: { 'Authorization': `Bearer ${token}` },
        redirect: 'manual' 
      });
      
      let finalUrl = zipUrl;
      if (redirectRes.status === 302) {
        finalUrl = redirectRes.headers.get('location');
      }

      return res.status(200).json({ 
        status: 'success', 
        download_url: finalUrl 
      });
    }

    return res.status(404).json({ error: 'No artifacts found in this run' });

  } catch (error) {
    console.error("Status API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
