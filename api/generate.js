// api/generate.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
    // 1. Enforce CORS protection and allow incoming payloads
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    try {
        const { prompt, image_base64 } = req.body;
        
        // Securely fetch your GitHub token from the hosted environment variables
        const GH_TOKEN = process.env.GH_TOKEN;
        const REPO_OWNER = process.env.REPO_OWNER;
        const REPO_NAME = process.env.REPO_NAME;
        const WORKFLOW_FILE = "vheer_runner.yml";

        if (!prompt || !image_base64) {
            return res.status(400).json({ error: 'Missing prompt or image data components.' });
        }

        const headers = {
            "Authorization": `token ${GH_TOKEN}`,
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        };

        // A. Upload and overwrite 'input-image.png' in the repo
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
                message: "API Gateway Proxy Automated Upload",
                content: image_base64,
                sha: sha || undefined,
                branch: "main"
            })
        });

        if (!putRes.ok) {
            const errText = await putRes.text();
            throw new Error(`GitHub File Staging Error: ${errText}`);
        }

        // B. Trigger the GitHub Actions Workflow
        const triggerTime = new Date().toISOString();
        const dispatchUrl = `https://github.com{REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
        
        const dispatchRes = await fetch(dispatchUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({ ref: "main", inputs: { prompt: prompt } })
        });

        if (dispatchRes.status !== 204 && dispatchRes.status !== 200) {
            const errText = await dispatchRes.text();
            throw new Error(`GitHub Workflow Activation Error: ${errText}`);
        }

        // C. Fetch the immediate run logs to send back a tracking tracker ID
        await new Promise(resolve => setTimeout(resolve, 3000));
        const runsUrl = `https://github.com{REPO_OWNER}/${REPO_NAME}/actions/runs?event=workflow_dispatch`;
        const runsRes = await fetch(runsUrl, { headers });
        const runsData = await runsRes.json();
        const activeRun = runsData.workflow_runs.find(run => new Date(run.created_at) >= new Date(triggerTime));

        return res.status(200).json({
            success: true,
            message: "Automation engine initialized successfully.",
            run_id: activeRun ? activeRun.id : null,
            trigger_time: triggerTime
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
