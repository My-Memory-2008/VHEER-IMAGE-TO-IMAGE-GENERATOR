import fetch from 'node-fetch';

export default async function handler(req, res) {
  // 1. Enforce CORS headers so your GitHub Pages site can access it
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight browser checks
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. Safely read configuration directly from Vercel's private server environment
  const GITHUB_TOKEN = process.env.VHEER_GITHUB_TOKEN;
  const REPO_OWNER = "My-Memory-2008";
  const REPO_NAME = "VHEER-IMAGE-TO-IMAGE-GENERATOR";
  const WORKFLOW_FILE = "vheer.yml";

  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: "Server Configuration Error: GitHub Secret Token is missing." });
  }

  try {
    const { image, prompt } = req.body;

    if (!image || !prompt) {
      return res.status(400).json({ error: "Missing required 'image' or 'prompt' parameter." });
    }

    const authHeaders = {
      "Authorization": `token ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    };

    // --- STEP 1: Upload the Input Image safely to GitHub ---
    const uploadUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/input-image.png`;
    
    // Check if file already exists to get its SHA hash string
    const checkRes = await fetch(uploadUrl, { headers: authHeaders });
    let sha = null;
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      sha = checkData.sha;
    }

    // Process the Base64 image payload to clean potential content boundaries
    const cleanBase64 = image.includes(',') ? image.split(',')[1] : image;

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        message: `[Vercel Server Proxy] Image updated at ${new Date().toISOString()}`,
        content: cleanBase64,
        sha: sha || undefined,
        branch: "main"
      })
    });

    if (!uploadRes.ok) {
      const uploadErr = await uploadRes.text();
      console.error("GitHub Upload Error Payload:", uploadErr);
      throw new Error("Failed to relay project data into GitHub Asset Tree.");
    }

    // --- STEP 2: Dispatch the Workflow Runner Pipeline ---
    const dispatchUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
    const triggerTime = new Date().toISOString();

    const dispatchRes = await fetch(dispatchUrl, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        ref: "main",
        inputs: { prompt }
      })
    });

    if (dispatchRes.status !== 204 && dispatchRes.status !== 200) {
      const dispatchErr = await dispatchRes.text();
      console.error("GitHub Dispatch Error Payload:", dispatchErr);
      throw new Error("Failed to securely launch GitHub Action processing automation.");
    }

    // Return the initialization confirmation to the frontend client app
    return res.status(200).json({ 
      success: true, 
      message: "Pipeline successfully initialized securely.",
      triggerTime: triggerTime
    });

  } catch (error) {
    console.error("Server API failure context:", error);
    return res.status(500).json({ error: error.message });
  }
}
