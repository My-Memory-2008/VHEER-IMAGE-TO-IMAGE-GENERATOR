// api/generate.js
export async function POST(request) {
  const GITHUB_TOKEN = process.env.VHEER_GITHUB_TOKEN;
  const REPO_OWNER = "My-Memory-2008";
  const REPO_NAME = "VHEER-IMAGE-TO-IMAGE-GENERATOR";
  const WORKFLOW_FILE = "vheer.yml";

  // CORS response headers setup
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (!GITHUB_TOKEN) {
    return new Response(JSON.stringify({ error: "Vercel environment token is missing." }), { status: 500, headers: corsHeaders });
  }

  try {
    const { image, prompt } = await request.json();
    if (!image || !prompt) {
      return new Response(JSON.stringify({ error: "Missing required 'image' or 'prompt' parameters." }), { status: 400, headers: corsHeaders });
    }

    const authHeaders = {
      "Authorization": `token ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    };

    // --- 1. Push image data payload directly to GitHub Tree ---
    const uploadUrl = `https://github.com{REPO_OWNER}/${REPO_NAME}/contents/input-image.png`;
    const checkRes = await fetch(uploadUrl, { headers: authHeaders });
    let sha = null;
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      sha = checkData.sha;
    }

    const cleanBase64 = image.includes(",") ? image.split(",")[1] : image;

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        message: `[Serverless Proxy] Image update at ${new Date().toISOString()}`,
        content: cleanBase64,
        sha: sha || undefined,
        branch: "main"
      })
    });

    if (!uploadRes.ok) {
      throw new Error("Failed to upload assets securely into repository tree.");
    }

    // --- 2. Safe remote launch of vheer.yml Runner ---
    const dispatchUrl = `https://github.com{REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
    const triggerTime = new Date().toISOString();

    const dispatchRes = await fetch(dispatchUrl, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ ref: "main", inputs: { prompt } })
    });

    if (dispatchRes.status !== 204 && dispatchRes.status !== 200) {
      throw new Error("Failed to dispatch active pipeline run engine.");
    }

    return new Response(JSON.stringify({ success: true, triggerTime }), { status: 200, headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
}

// Handle browser preflight checks
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
