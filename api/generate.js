// api/generate.js
export default async function handler(req, res) {
    // 1. Establish browser-safe CORS configurations
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

    try {
        const { prompt, image_base64 } = req.body;
        
        const GH_TOKEN = process.env.GH_TOKEN;
        const REPO_OWNER = process.env.REPO_OWNER || "My-Memory-2008";
        const REPO_NAME = process.env.REPO_NAME || "VHEER-IMAGE-TO-IMAGE-GENERATOR";
        const WORKFLOW_FILE = "vheer.yml";

        if (!prompt || !image_base64) return res.status(400).json({ error: 'Missing prompt or image data profiles.' });

        const headers = {
            "Authorization": `token ${GH_TOKEN}`,
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        };

        // A. Overwrite input-image.png securely
        const uploadUrl = `https://github.com{REPO_OWNER}/${REPO_NAME}/contents/input-image.png`;
        const checkRes = await fetch(uploadUrl, { headers });
        let sha = null;
        if (checkRes.status === 200) {
            const meta = await checkRes.json();
            sha = meta.sha;
        }

        const putRes = await fetch(uploadUrl, {
            method: "PUT",
            headers,
            body: JSON.stringify({
                message: `[API Proxy] Upload at ${new Date().toISOString()}`,
                content: image_base64,
                sha: sha || undefined,
                branch: "main"
            })
        });
        if (!putRes.ok) throw new Error("Failed to upload file matrix layer to GitHub.");

        // B. Dispatch your vheer.yml workflow loop
        const triggerTime = new Date().toISOString();
        const dispatchUrl = `https://github.com{REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
        const dispatchRes = await fetch(dispatchUrl, {
            method: "POST", headers, body: JSON.stringify({ ref: "main", inputs: { prompt: prompt } })
        });
        if (dispatchRes.status !== 204 && dispatchRes.status !== 200) throw new Error("Failed to dispatch active cloud workflow.");

        // C. SERVER-SIDE POLLING: Wait directly on Vercel's fast architecture for completion
        const runsUrl = `https://github.com{REPO_OWNER}/${REPO_NAME}/actions/runs?event=workflow_dispatch`;
        let activeRunId = null;
        
        // Loop for up to 3 minutes to locate the launched run ID
        for (let attempt = 0; attempt < 15; attempt++) {
            await new Promise(r => setTimeout(r, 4000));
            const runsRes = await fetch(runsUrl, { headers });
            const runsData = await runsRes.json();
            const foundRun = runsData.workflow_runs.find(run => new Date(run.created_at) >= new Date(triggerTime));
            if (foundRun) {
                activeRunId = foundRun.id;
                break;
            }
        }

        if (!activeRunId) throw new Error("Cloud execution failed to register in time window boundaries.");

        // Monitor run completion logs status
        let executionSuccess = false;
        for (let cycle = 0; cycle < 30; cycle++) {
            await new Promise(r => setTimeout(r, 6000));
            const runCheckUrl = `https://github.com{REPO_OWNER}/${REPO_NAME}/actions/runs/${activeRunId}`;
            const checkStatusRes = await fetch(runCheckUrl, { headers });
            const statusData = await checkStatusRes.json();
            
            if (statusData.status === "completed") {
                if (statusData.conclusion === "success") executionSuccess = true;
                break;
            }
        }

        if (!executionSuccess) throw new Error("The cloud generation workspace runner failed or hit an error.");

        // D. Fetch artifact allocations data directly
        const artifactUrl = `https://github.com{REPO_OWNER}/${REPO_NAME}/actions/runs/${activeRunId}/artifacts`;
        const artRes = await fetch(artifactUrl, { headers });
        const artData = await artRes.json();
        
        if (!artData.artifacts || artData.artifacts.length === 0) throw new Error("Generated image asset omitted from artifact profiles.");
        
        const targetArtifactId = artData.artifacts[0].id;
        const zipDownloadUrl = `https://github.com{REPO_OWNER}/${REPO_NAME}/actions/artifacts/${targetArtifactId}/zip`;

        // Pass the raw download URL proxy back to the frontend web app interface
        return res.status(200).json({
            success: true,
            download_url: zipDownloadUrl,
            token_fallback: GH_TOKEN
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
