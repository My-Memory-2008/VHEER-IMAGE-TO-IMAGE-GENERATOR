// import { Buffer } from 'buffer';

// const REPO_OWNER = "My-Memory-2008";
// const REPO_NAME = "VHEER-IMAGE-TO-IMAGE-GENERATOR";
// const WORKFLOW_FILE = "vheer.yml";

// export default async function handler(req, res) {
//   if (req.method !== 'POST') {
//     return res.status(405).json({ error: 'Method not allowed' });
//   }

//   // Vercel reads this securely from your environment variables
//   const token = process.env.GITHUB_TOKEN;
//   if (!token) {
//     return res.status(500).json({ error: 'Server token configuration missing' });
//   }

//   const { imageBase64, prompt } = req.body;
//   if (!imageBase64 || !prompt) {
//     return res.status(400).json({ error: 'Missing image or prompt' });
//   }

//   const headers = {
//     "Authorization": `token ${token}`,
//     "Accept": "application/vnd.github.v3+json",
//     "Content-Type": "application/json"
//   };

//   try {
//     // 1. Upload Input Image
//     const contentUrl = `https://github.com/{REPO_OWNER}/${REPO_NAME}/contents/input-image.png`;
//     const checkRes = await fetch(contentUrl, { headers });
//     let sha = null;
//     if (checkRes.ok) {
//       const checkData = await checkRes.json();
//       sha = checkData.sha;
//     }

//     const uploadRes = await fetch(contentUrl, {
//       method: "PUT",
//       headers,
//       body: JSON.stringify({
//         message: `[Server API] Image upload at ${new Date().toISOString()}`,
//         content: imageBase64,
//         sha: sha || undefined,
//         branch: "main"
//       })
//     });
//     if (!uploadRes.ok) throw new Error("Failed to upload image to GitHub.");

//     // 2. Dispatch Workflow
//     const triggerTime = new Date().toISOString();
//     const dispatchUrl = `https://github.com/{REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
//     const dispatchRes = await fetch(dispatchUrl, {
//       method: "POST",
//       headers,
//       body: JSON.stringify({ ref: "main", inputs: { prompt } })
//     });
//     if (dispatchRes.status !== 204 && dispatchRes.status !== 200) {
//       throw new Error("Failed to dispatch workflow run.");
//     }

//     // 3. Poll Workflow until completion
//     const runsUrl = `https://github.com/{REPO_OWNER}/${REPO_NAME}/actions/runs`;
//     let completedRunId = null;
    
//     // Simple retry loop (max 3 minutes)
//     for (let i = 0; i < 36; i++) {
//       await new Promise(resolve => setTimeout(resolve, 5000));
//       const runsRes = await fetch(runsUrl, { headers });
//       if (!runsRes.ok) continue;
      
//       const runsData = await runsRes.json();
//       const recentRun = runsData.workflow_runs.find(
//         run => new Date(run.created_at) >= new Date(triggerTime)
//       );

//       if (recentRun && recentRun.status === "completed") {
//         if (recentRun.conclusion === "success") {
//           completedRunId = recentRun.id;
//           break;
//         } else {
//           throw new Error("GitHub workflow ended with a failed status.");
//         }
//       }
//     }

//     if (!completedRunId) throw new Error("Workflow timing out or unavailable.");

//     // 4. Get Artifacts zip endpoint
//     const artifactUrl = `https://github.com/{REPO_OWNER}/${REPO_NAME}/actions/runs/${completedRunId}/artifacts`;
//     const artifactRes = await fetch(artifactUrl, { headers });
//     if (!artifactRes.ok) throw new Error("Failed to parse run artifacts.");
    
//     const artifactData = await artifactRes.json();
//     if (!artifactData.artifacts || artifactData.artifacts.length === 0) {
//       throw new Error("No output artifacts found.");
//     }

//     const zipUrl = `https://github.com/{REPO_OWNER}/${REPO_NAME}/actions/artifacts/${artifactData.artifacts[0].id}/zip`;
    
//     // Download the ZIP archive binary back to the frontend safely
//     const zipFileRes = await fetch(zipUrl, { headers });
//     const arrayBuffer = await zipFileRes.arrayBuffer();
//     const base64Zip = Buffer.from(arrayBuffer).toString('base64');

//     // Return the base64 archive back to frontend to extract client-side
//     return res.status(200).json({ zipArchive: base64Zip });

//   } catch (error) {
//     return res.status(500).json({ error: error.message });
//   }
// }



const REPO_OWNER = "My-Memory-2008";
const REPO_NAME = "VHEER-IMAGE-TO-IMAGE-GENERATOR";
const WORKFLOW_FILE = "vheer.yml";

export default async function handler(req, res) {
  // 1. Enforce POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Read and log token presence safely
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("CRITICAL CRASH: GITHUB_TOKEN environment variable is undefined in Vercel settings.");
    return res.status(500).json({ error: 'Server token configuration missing. Please verify Vercel Environment Variables.' });
  }

  // 3. Destructure payload
  const { imageBase64, prompt } = req.body;
  if (!imageBase64 || !prompt) {
    return res.status(400).json({ error: 'Missing imageBase64 or prompt payload parameter' });
  }

  const headers = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Vheer-AI-Image-App-Engine",
    "Content-Type": "application/json"
  };


    // Extract only raw Base64 characters if a data URL prefix is present
  let cleanBase64 = imageBase64;
  
  // 1. If it's an array or containing stringified elements, extract the last item
  if (Array.isArray(cleanBase64)) {
    cleanBase64 = cleanBase64[cleanBase64.length - 1];
  } else if (typeof cleanBase64 === 'string' && cleanBase64.includes(',')) {
    cleanBase64 = cleanBase64.split(',').pop();
  }
  
  // 2. Clear out any browser metadata headers, whitespaces, or hidden line breaks
  cleanBase64 = cleanBase64.replace(/^data:image\/[a-z]+;base64,/, "");
  cleanBase64 = cleanBase64.replace(/\s/g, '');

  // Verify the string is clear
  console.log("Sanitized Base64 Head Check:", cleanBase64.substring(0, 30));

  try {
    console.log("Pipeline started. checking if old input-image exists...");
    
    // Step A: Handle content on GitHub
    const contentUrl = `https://github.com/{REPO_OWNER}/${REPO_NAME}/contents/input-image.png`;
    const checkRes = await fetch(contentUrl, { headers });
    let sha = null;
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      sha = checkData.sha;
    }

        console.log("Uploading file to GitHub repository...");
    const uploadRes = await fetch(contentUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: `[Server API] Sync at ${new Date().toISOString()}`,
        content: cleanBase64, // <-- Ensure this is changed from imageBase64 to cleanBase64
        branch: "main"
      })
    });


    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`GitHub Upload failed: ${errText}`);
    }

    // Step B: Run the actions pipeline
    console.log("Triggering GitHub Action workflow run...");
    const triggerTime = new Date().toISOString();
    const dispatchUrl = `https://github.com/{REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
    const dispatchRes = await fetch(dispatchUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ ref: "main", inputs: { prompt } })
    });
    if (dispatchRes.status !== 204 && dispatchRes.status !== 200) {
      throw new Error(`Workflow trigger failed with status ${dispatchRes.status}`);
    }

    // Step C: Poll for completion
    const runsUrl = `https://github.com/{REPO_OWNER}/${REPO_NAME}/actions/runs`;
    let completedRunId = null;
    
    console.log("Polling workflow execution status...");
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
          throw new Error(`GitHub Action run finished with conclusion: ${recentRun.conclusion}`);
        }
      }
    }

    if (!completedRunId) throw new Error("GitHub workflow execution timed out.");

    // Step D: Retrieve and route binary archive bundle
    console.log(`Workflow complete (ID: ${completedRunId}). Fetching download target...`);
    const artifactUrl = `https://github.com/REPO_OWNER}/${REPO_NAME}/actions/runs/${completedRunId}/artifacts`;
    const artifactRes = await fetch(artifactUrl, { headers });
    if (!artifactRes.ok) throw new Error("Could not fetch workflow artifacts metadata.");
    
    const artifactData = await artifactRes.json();
    if (!artifactData.artifacts || artifactData.artifacts.length === 0) {
      throw new Error("No artifacts found for this generation run.");
    }

    // Grab the first available artifact item ID
    const targetArtifactId = artifactData.artifacts[0].id;
    const zipUrl = `https://github.com/{REPO_OWNER}/${REPO_NAME}/actions/artifacts/${targetArtifactId}/zip`;
    
    console.log("Downloading artifact archive package from GitHub...");
    const zipFileRes = await fetch(zipUrl, { headers });
    if (!zipFileRes.ok) throw new Error("Failed to download ZIP cluster data from GitHub.");
    
    const arrayBuffer = await zipFileRes.arrayBuffer();
    
    // Native Node environment base64 converter (requires no dependencies)
    const base64Zip = Buffer.from(arrayBuffer).toString('base64');

    console.log("Returning zip payload binary safely back to client frontend!");
    return res.status(200).json({ zipArchive: base64Zip });

  } catch (error) {
    console.error("RUNTIME PIPELINE CRASH:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
