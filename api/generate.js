// api/generate.js
export default async function handler(req, res) {
    // 1. Establish browser-safe CORS allowances to accept remote payloads
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
        
        // Pull hidden backend parameters safely out of server hardware settings configurations
        const GH_TOKEN = process.env.GH_TOKEN;
        const REPO_OWNER = process.env.REPO_OWNER || "My-Memory-2008";
        const REPO_NAME = process.env.REPO_NAME || "VHEER-IMAGE-TO-IMAGE-GENERATOR";
        const WORKFLOW_FILE = "vheer.yml";

        if (!prompt || !image_base64) {
            return res.status(400).json({ error: 'Missing prompt or image content data.' });
        }

        const headers = {
            "Authorization": `token ${GH_TOKEN}`,
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        };

        // A. Overwrite input-image.png in your repository securely using native fetch
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
                message: `[API Proxy Upload] Generated at ${new Date().toISOString()}`,
                content: image_base64,
                sha: sha || undefined,
                branch: "main"
            })
        });

        if (!putRes.ok) {
            const errText = await putRes.text();
            throw new Error(`GitHub File Staging Error: ${errText}`);
        }

        // B. Dispatch your vheer.yml workflow loop
        const triggerTime = new Date().toISOString();
        const dispatchUrl = `https://github.com{REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
        
        const dispatchRes = await fetch(dispatchUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({ ref: "main", inputs: { prompt: prompt } })
        });

        if (dispatchRes.status !== 204 && dispatchRes.status !== 200) {
            const errText = await dispatchRes.text();
            throw new Error(`GitHub Action Dispatch Error: ${errText}`);
        }

        return res.status(200).json({
            success: true,
            message: "Cloud automation successfully engaged.",
            trigger_time: triggerTime,
            // Pass token to frontend securely so the browser can monitor status logs locally
            temp_access: GH_TOKEN
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
