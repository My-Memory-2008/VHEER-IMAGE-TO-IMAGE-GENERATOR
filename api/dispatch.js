export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Missing GITHUB_TOKEN' });
  }

  try {
    const { prompt, image_data } = req.body;
    
    // CONFIGURATION - CHECK THESE NAMES AGAINST YOUR REPO
    const repoOwner = "My-Memory-2008";
    const repoName = "VHEER-IMAGE-TO-IMAGE-GENERATOR";
    const workflowFile = "vheer.yml"; // <--- MUST MATCH EXACTLY

    console.log(`Attempting to trigger: ${workflowFile} in ${repoOwner}/${repoName}`);

    const response = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows/${workflowFile}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            prompt: prompt,
            image_data: image_data
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`GitHub API Error (${response.status}):`, errorText);
      
      // If it's a 422, let's try to list workflows to see what GitHub actually sees
      if (response.status === 422) {
         const listRes = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows`,
            { headers: { 'Authorization': `Bearer ${token}` } }
         );
         const listData = await listRes.json();
         console.error("Available workflows:", listData.workflows.map(w => w.name));
      }

      return res.status(response.status).json({ 
        error: 'Workflow trigger failed', 
        details: errorText 
      });
    }

    return res.status(200).json({ message: 'Workflow dispatched successfully' });

  } catch (error) {
    console.error("Dispatch Exception:", error);
    return res.status(500).json({ error: error.message });
  }
}
