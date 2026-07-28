import { Buffer } from 'buffer';

const REPO_OWNER = "My-Memory-2008";
const REPO_NAME = "VHEER-IMAGE-TO-IMAGE-GENERATOR";
const WORKFLOW_FILE = "vheer.yml";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Vercel reads this securely from your environment variables
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Server token configuration missing' });
  }

  const { imageBase64, prompt } = req.body;
  if (!imageBase64 || !prompt) {
    return res.status(400).json({ error: 'Missing image or prompt' });
  }

  const headers = {
    "Authorization": `token ${token}`,
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json"
  };

  try {
    // 1. Upload Input Image
    const contentUrl = `https://github.com/{REPO_OWNER}/${REPO_NAME}/contents/input-image.png`;
    const checkRes = await fetch(contentUrl, { headers });
    let sha = null;
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      sha = checkData.sha;
    }

    const uploadRes = await fetch(contentUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: `[Server API] Image upload at ${new Date().toISOString()}`,
        content: imageBase64,
        sha: sha || undefined,
        branch: "main"
      })
    });
    if (!uploadRes.ok) throw new Error("Failed to upload image to GitHub.");

    // 2. Dispatch Workflow
    const triggerTime = new Date().toISOString();
    const dispatchUrl = `https://github.com/{REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
    const dispatchRes = await fetch(dispatchUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ ref: "main", inputs: { prompt } })
    });
    if (dispatchRes.status !== 204 && dispatchRes.status !== 200) {
      throw new Error("Failed to dispatch workflow run.");
    }

    // 3. Poll Workflow until completion
    const runsUrl = `https://github.com/{REPO_OWNER}/${REPO_NAME}/actions/runs`;
    let completedRunId = null;
    
    // Simple retry loop (max 3 minutes)
    for (let i = 0; i < 36; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const runsRes = await fetch(runsUrl, { headers });
      if (!runsRes.ok) continue;
      
      const runsData = await runsRes.json();
      const recentRun = runsData.workflow_runs.find(
        run => new Date(run.created_at) >= new Date(triggerTime)
      );

      if (recentRun && recentRun.status === "completed") {
        if (recentRun.conclusion === "success") {
          completedRunId = recentRun.id;
          break;
        } else {
          throw new Error("GitHub workflow ended with a failed status.");
        }
      }
    }

    if (!completedRunId) throw new Error("Workflow timing out or unavailable.");

    // 4. Get Artifacts zip endpoint
    const artifactUrl = `https://github.com/{REPO_OWNER}/${REPO_NAME}/actions/runs/${completedRunId}/artifacts`;
    const artifactRes = await fetch(artifactUrl, { headers });
    if (!artifactRes.ok) throw new Error("Failed to parse run artifacts.");
    
    const artifactData = await artifactRes.json();
    if (!artifactData.artifacts || artifactData.artifacts.length === 0) {
      throw new Error("No output artifacts found.");
    }

    const zipUrl = `https://github.com/{REPO_OWNER}/${REPO_NAME}/actions/artifacts/${artifactData.artifacts[0].id}/zip`;
    
    // Download the ZIP archive binary back to the frontend safely
    const zipFileRes = await fetch(zipUrl, { headers });
    const arrayBuffer = await zipFileRes.arrayBuffer();
    const base64Zip = Buffer.from(arrayBuffer).toString('base64');

    // Return the base64 archive back to frontend to extract client-side
    return res.status(200).json({ zipArchive: base64Zip });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
