// Vercel Serverless API — proxies GitHub API calls with the token hidden server-side
// The GITHUB_TOKEN is stored in Vercel Environment Variables (invisible to users)

const CONFIG = {
  REPO_OWNER: "My-Memory-2008",
  REPO_NAME: "VHEER-IMAGE-TO-IMAGE-GENERATOR",
  WORKFLOW_FILE: "vheer.yml",
};

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ ok: false, error: "Server token not configured. Add GITHUB_TOKEN to Vercel env vars." });

  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ ok: false, error: "Invalid JSON" });
  }

  const headers = {
    Authorization: "token " + token,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  };
  const base = "https://api.github.com/repos/" + CONFIG.REPO_OWNER + "/" + CONFIG.REPO_NAME;

  // STEP 1: Upload image to repo
  if (body.action === "upload") {
    if (!body.image) return res.status(400).json({ ok: false, error: "Missing image" });

    let sha = null;
    const checkRes = await fetch(base + "/contents/input-image.png", { headers });
    if (checkRes.ok) sha = (await checkRes.json()).sha;

    const uploadRes = await fetch(base + "/contents/input-image.png", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: "[Vercel API] Image upload at " + new Date().toISOString(),
        content: body.image,
        sha: sha || undefined,
        branch: "main",
      }),
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return res.status(502).json({ ok: false, error: "Upload failed (" + uploadRes.status + "): " + errText });
    }

    return res.json({ ok: true });
  }

  // STEP 2: Dispatch workflow
  if (body.action === "dispatch") {
    if (!body.prompt) return res.status(400).json({ ok: false, error: "Missing prompt" });

    const triggerTime = new Date().toISOString();
    const dispRes = await fetch(base + "/actions/workflows/" + CONFIG.WORKFLOW_FILE + "/dispatches", {
      method: "POST",
      headers,
      body: JSON.stringify({ ref: "main", inputs: { prompt: body.prompt } }),
    });

    if (dispRes.status !== 204 && dispRes.status !== 200) {
      const errText = await dispRes.text();
      return res.status(502).json({ ok: false, error: "Dispatch failed (" + dispRes.status + "): " + errText });
    }

    return res.json({ ok: true, triggerTime });
  }

  // STEP 3: Poll workflow status
  if (body.action === "poll") {
    if (!body.triggerTime) return res.status(400).json({ ok: false, error: "Missing triggerTime" });

    const runsRes = await fetch(base + "/actions/runs?per_page=10", { headers });
    if (!runsRes.ok) return res.status(502).json({ ok: false, error: "Failed to fetch runs" });

    const runsData = await runsRes.json();
    const recentRun = runsData.workflow_runs.find(function (r) {
      return new Date(r.created_at) >= new Date(body.triggerTime) && r.path === ".github/workflows/vheer.yml";
    });

    if (!recentRun) return res.json({ ok: true, status: "pending", message: "Waiting for workflow to start..." });

    if (recentRun.status !== "completed") {
      return res.json({
        ok: true,
        status: "pending",
        message: recentRun.status === "queued" ? "Workflow queued..." : "Generating image...",
      });
    }

    if (recentRun.conclusion !== "success") {
      return res.json({ ok: true, status: "failed", error: "Workflow failed. Check GitHub Actions logs." });
    }

    // Download artifact
    const artRes = await fetch(base + "/actions/runs/" + recentRun.id + "/artifacts", { headers });
    if (!artRes.ok) return res.status(502).json({ ok: false, error: "Failed to fetch artifacts" });

    const artData = await artRes.json();
    if (!artData.artifacts || artData.artifacts.length === 0) {
      return res.json({ ok: true, status: "failed", error: "No artifacts found" });
    }

    const artifact = artData.artifacts[0];
    const zipRes = await fetch(base + "/actions/artifacts/" + artifact.id + "/zip", { headers });
    if (!zipRes.ok) return res.status(502).json({ ok: false, error: "Failed to download artifact" });

    // Return the zip as base64 — the client will extract it with JSZip
    const zipBuffer = Buffer.from(await zipRes.arrayBuffer());
    const zipBase64 = zipBuffer.toString("base64");

    return res.json({ ok: true, status: "done", zip: zipBase64 });
  }

  return res.status(400).json({ ok: false, error: "Unknown action: " + body.action });
};
