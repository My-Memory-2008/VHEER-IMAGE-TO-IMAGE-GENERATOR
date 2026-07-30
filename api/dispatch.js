// export default async function handler(req, res) {
//   if (req.method !== 'POST') {
//     return res.status(405).json({ error: 'Method not allowed' });
//   }

//   const token = process.env.GITHUB_TOKEN;
//   if (!token) {
//     return res.status(500).json({ error: 'Server configuration error: Missing Token' });
//   }

//   try {
//     const { prompt, image_data } = req.body;
//     const owner = "My-Memory-2008";
//     const repo = "VHEER-IMAGE-TO-IMAGE-GENERATOR";

//     // 1. Upload the image to the repo using Vercel's secret token
//     // We use a unique filename so multiple users don't overwrite each other
//     const fileName = `temp_input_${Date.now()}.png`;
//     const uploadUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${fileName}`;

//     // Get existing SHA to avoid conflicts if the file exists
//     let sha = null;
//     const checkRes = await fetch(uploadUrl, {
//       headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
//     });
//     if (checkRes.ok) {
//       const data = await checkRes.json();
//       sha = data.sha;
//     }

//     const uploadBody = JSON.stringify({
//       message: `[Auto] User upload at ${new Date().toISOString()}`,
//       content: image_data.split(',')[1], // Remove the "data:image..." prefix
//       sha: sha || undefined,
//       branch: "main"
//     });

//     const uploadRes = await fetch(uploadUrl, {
//       method: 'PUT',
//       headers: {
//         'Authorization': `Bearer ${token}`,
//         'Accept': 'application/vnd.github.v3+json',
//         'Content-Type': 'application/json'
//       },
//       body: uploadBody
//     });

//     if (!uploadRes.ok) {
//       throw new Error("Failed to upload image to repository.");
//     }

//     // 2. Trigger the workflow, passing the filename instead of the huge image data
//     const dispatchUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/vheer.yml/dispatches`;
    
//     const dispatchRes = await fetch(dispatchUrl, {
//       method: 'POST',
//       headers: {
//         'Authorization': `Bearer ${token}`,
//         'Accept': 'application/vnd.github.v3+json',
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify({
//         ref: 'main',
//         inputs: {
//           prompt: prompt,
//           input_filename: fileName // Tell the workflow which file to use
//         }
//       })
//     });

//     if (!dispatchRes.ok) {
//       const errText = await dispatchRes.text();
//       throw new Error(`Workflow trigger failed: ${errText}`);
//     }

//     return res.status(200).json({ message: 'Process started successfully' });

//   } catch (error) {
//     console.error("Vercel Proxy Error:", error);
//     return res.status(500).json({ error: error.message });
//   }
// }



// export default async function handler(req, res) {
//   if (req.method !== 'POST') {
//     return res.status(405).json({ error: 'Method not allowed' });
//   }

//   const token = process.env.GITHUB_TOKEN;
//   if (!token) {
//     return res.status(500).json({ error: 'Server configuration error: Missing Token' });
//   }

//   try {
//     const { prompt, image_data } = req.body;
//     const owner = "My-Memory-2008";
//     const repo = "VHEER-IMAGE-TO-IMAGE-GENERATOR";

//     // 1. Upload the image to the repo using Vercel's secret token
//     const fileName = `temp_input_${Date.now()}.png`;
//     const uploadUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${fileName}`;

//     // Get existing SHA to avoid conflicts if the file exists
//     let sha = null;
//     const checkRes = await fetch(uploadUrl, {
//       headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
//     });
//     if (checkRes.ok) {
//       const data = await checkRes.json();
//       sha = data.sha;
//     }

//     const uploadBody = JSON.stringify({
//       message: `[Auto] User upload at ${new Date().toISOString()}`,
//       content: image_data.split(',')[1], // Remove the "data:image..." prefix
//       sha: sha || undefined,
//       branch: "main"
//     });

//     const uploadRes = await fetch(uploadUrl, {
//       method: 'PUT',
//       headers: {
//         'Authorization': `Bearer ${token}`,
//         'Accept': 'application/vnd.github.v3+json',
//         'Content-Type': 'application/json'
//       },
//       body: uploadBody
//     });

//     if (!uploadRes.ok) {
//       throw new Error("Failed to upload image to repository.");
//     }

//     // 2. Trigger the workflow
//     const dispatchUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/vheer.yml/dispatches`;
    
//     const dispatchRes = await fetch(dispatchUrl, {
//       method: 'POST',
//       headers: {
//         'Authorization': `Bearer ${token}`,
//         'Accept': 'application/vnd.github.v3+json',
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify({
//         ref: 'main',
//         inputs: {
//           prompt: prompt,
//           input_filename: fileName
//         }
//       })
//     });

//     if (!dispatchRes.ok) {
//       const errText = await dispatchRes.text();
//       throw new Error(`Workflow trigger failed: ${errText}`);
//     }

//     // 3. Fetch the Run ID so the frontend can track progress
//     // GitHub takes a few seconds to register the new run after dispatch
//     await new Promise(resolve => setTimeout(resolve, 3000));

//     const listUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=1&branch=main`;
//     const listRes = await fetch(listUrl, {
//       headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
//     });

//     let runId = null;
//     if (listRes.ok) {
//       const listData = await listRes.json();
//       if (listData.workflow_runs && listData.workflow_runs.length > 0) {
//         runId = listData.workflow_runs[0].id;
//       }
//     }

//     return res.status(200).json({ 
//       message: 'Process started successfully', 
//       run_id: runId 
//     });

//   } catch (error) {
//     console.error("Vercel Proxy Error:", error);
//     return res.status(500).json({ error: error.message });
//   }
// }




export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Server configuration error: Missing Token' });
  }

  try {
    const { prompt, image_data } = req.body;
    const owner = "My-Memory-2008";
    const repo = "VHEER-IMAGE-TO-IMAGE-GENERATOR";

    // 1. Upload the image
    const fileName = `temp_input_${Date.now()}.png`;
    const uploadUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${fileName}`;

    let sha = null;
    const checkRes = await fetch(uploadUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    if (checkRes.ok) {
      const data = await checkRes.json();
      sha = data.sha;
    }

    const uploadBody = JSON.stringify({
      message: `[Auto] User upload at ${new Date().toISOString()}`,
      content: image_data.split(',')[1],
      sha: sha || undefined,
      branch: "main"
    });

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: uploadBody
    });

    if (!uploadRes.ok) {
      throw new Error("Failed to upload image to repository.");
    }

    // ✅ ADD THIS: Wait 5 seconds for the file to propagate in GitHub
    console.log(`✅ File uploaded. Waiting 5 seconds for propagation...`);
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 2. Trigger the workflow
    const dispatchUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/vheer.yml/dispatches`;
    
    const dispatchRes = await fetch(dispatchUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          prompt: prompt,
          input_filename: fileName
        }
      })
    });

    if (!dispatchRes.ok) {
      const errText = await dispatchRes.text();
      throw new Error(`Workflow trigger failed: ${errText}`);
    }

    // 3. Fetch the Run ID
    await new Promise(resolve => setTimeout(resolve, 3000));

    const listUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=1&branch=main`;
    const listRes = await fetch(listUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
    });

    let runId = null;
    if (listRes.ok) {
      const listData = await listRes.json();
      if (listData.workflow_runs && listData.workflow_runs.length > 0) {
        runId = listData.workflow_runs[0].id;
      }
    }

    return res.status(200).json({ 
      message: 'Process started successfully', 
      run_id: runId 
    });

  } catch (error) {
    console.error("Vercel Proxy Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
