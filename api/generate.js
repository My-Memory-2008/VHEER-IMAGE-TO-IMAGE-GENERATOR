// Vercel Serverless API Route — handles VHEER image-to-image generation
// The GITHUB_TOKEN is read from Vercel environment variables (invisible to users)
// Deploy this file at: api/generate.js in your repo root

const zlib = require("zlib");

const CONFIG = {
  REPO_OWNER: "My-Memory-2008",
  REPO_NAME: "VHEER-IMAGE-TO-IMAGE-GENERATOR",
  WORKFLOW_FILE: "vheer.yml",
};

function ghHeaders(token) {
  return {
    Authorization: "token " + token,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  };
}

// Extract image from a zip buffer WITHOUT any npm dependency (uses built-in zlib)
function extractImageFromZip(buffer) {
  let offset = 0;
  while (offset < buffer.length - 4) {
    if (buffer[offset] === 0x50 && buffer[offset + 1] === 0x4b && buffer[offset + 2] === 0x03 && buffer[offset + 3] === 0x04) {
      const compressionMethod = buffer.readUInt16LE(offset + 8);
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const filenameLength = buffer.readUInt16LE(offset + 26);
      const extraFieldLength = buffer.readUInt16LE(offset + 28);
      const filename = buffer.toString("utf8", offset + 30, offset + 30 + filenameLength);
      const dataStart = offset + 30 + filenameLength + extraFieldLength;

      if (filename.match(/\.(png|jpg|jpeg)$/i)) {
        let imageData;
        if (compressionMethod === 0) {
          imageData = buffer.slice(dataStart, dataStart + compressedSize);
        } else if (compressionMethod === 8) {
          imageData = zlib.inflateSync(buffer.slice(dataStart, dataStart + compressedSize));
        } else {
          offset++;
          continue;
        }
        const ext = filename.split(".").pop().toLowerCase();
        const mime = ext === "png" ? "image/png" : "image/jpeg";
        return { data: imageData, mime };
      }
      offset = dataStart + compressedSize;
    } else {
      offset++;
    }
  }
  return null;
}

module.exports = async (req, res) => {
  // CORS — allow AWRAM (and any site) to call this API
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ ok: false, error: "Server token not configured." });

  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ ok: false, error: "Invalid JSON" });
  }

  const headers = ghHeaders(token);
  const base = `https://api.github.com/repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}`;

  // ---- ACTION: START (upload image + dispatch workflow) ----
  if (body.action === "start") {
    if (!body.image || !body.prompt) return res.status(400).json({ ok: false, error: "Missing image or prompt" });

    try {
      // Upload image to repo (overwrite if exists)
      let sha = null;
      const checkRes = await fetch(`${base}/contents/input-image.png`, { headers });
      if (checkRes.ok) sha = (await checkRes.json()).sha;

      const uploadRes = await fetch(`${base}/contents/input-image.png`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: "[Vercel API] Image upload at " + new Date().toISOString(),
          content: body.image,
          sha: sha || undefined,
          branch: "main",
        }),
      });
      if (!uploadRes.ok) return res.status(502).json({ ok: false, error: "Upload failed (" + uploadRes.status + ")" });

      // Dispatch workflow
      const triggerTime = new Date().toISOString();
      const dispRes = await fetch(`${base}/actions/workflows/${CONFIG.WORKFLOW_FILE}/dispatches`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ref: "main", inputs: { prompt: body.prompt } }),
      });
      if (dispRes.status !== 204) return res.status(502).json({ ok: false, error: "Workflow dispatch failed (" + dispRes.status + ")" });

      return res.json({ ok: true, triggerTime });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ---- ACTION: POLL (check workflow status, download artifact if done) ----
  if (body.action === "poll") {
    if (!body.triggerTime) return res.status(400).json({ ok: false, error: "Missing triggerTime" });

    try {
      const runsRes = await fetch(`${base}/actions/runs`, { headers });
      if (!runsRes.ok) return res.status(502).json({ ok: false, error: "Failed to check runs" });
      const runsData = await runsRes.json();

      const recentRun = runsData.workflow_runs.find((r) => new Date(r.created_at) >= new Date(body.triggerTime));
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
      const artRes = await fetch(`${base}/actions/runs/${recentRun.id}/artifacts`, { headers });
      if (!artRes.ok) return res.status(502).json({ ok: false, error: "Failed to fetch artifacts" });
      const artData = await artRes.json();
      if (!artData.artifacts || artData.artifacts.length === 0) {
        return res.json({ ok: true, status: "failed", error: "No artifacts found" });
      }

      const artifact = artData.artifacts[0];
      const zipRes = await fetch(`${base}/actions/artifacts/${artifact.id}/zip`, { headers });
      if (!zipRes.ok) return res.status(502).json({ ok: false, error: "Failed to download artifact" });

      const zipBuffer = Buffer.from(await zipRes.arrayBuffer());
      const extracted = extractImageFromZip(zipBuffer);
      if (!extracted) return res.json({ ok: true, status: "failed", error: "No image found in artifact" });

      const dataUrl = `data:${extracted.mime};base64,${extracted.data.toString("base64")}`;
      return res.json({ ok: true, status: "done", image: dataUrl });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(400).json({ ok: false, error: "Unknown action" });
};
