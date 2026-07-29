// export default async function handler(req, res) {
//   // Allow CORS just in case
//   res.setHeader('Access-Control-Allow-Origin', '*');
  
//   if (req.method !== 'GET') {
//     return res.status(405).json({ error: 'Method not allowed' });
//   }

//   const token = process.env.GITHUB_TOKEN;
//   const { run_id } = req.query;

//   if (!token || !run_id) {
//     return res.status(400).json({ error: 'Missing token or run_id' });
//   }

//   try {
//     const url = `https://api.github.com/repos/My-Memory-2008/VHEER-IMAGE-TO-IMAGE-GENERATOR/actions/runs/${run_id}`;
    
//     const response = await fetch(url, {
//       headers: { 
//         'Authorization': `Bearer ${token}`, 
//         'Accept': 'application/vnd.github.v3+json' 
//       }
//     });

//     if (!response.ok) {
//       throw new Error(`GitHub API returned ${response.status}`);
//     }

//     const data = await response.json();

//     // Return EXACTLY what the HTML expects
//     return res.status(200).json({ 
//       status: data.status,       // e.g., "queued", "in_progress", "completed"
//       conclusion: data.conclusion // e.g., "success", "failure", null
//     });

//   } catch (error) {
//     console.error("Status Check Error:", error);
//     return res.status(500).json({ error: error.message });
//   }
// }





// import JSZip from 'jszip';

// export default async function handler(req, res) {
//   // Allow CORS just in case
//   res.setHeader('Access-Control-Allow-Origin', '*');
  
//   if (req.method !== 'GET') {
//     return res.status(405).json({ error: 'Method not allowed' });
//   }

//   const token = process.env.GITHUB_TOKEN;
//   const { run_id } = req.query;

//   if (!token || !run_id) {
//     return res.status(400).json({ error: 'Missing token or run_id' });
//   }

//   try {
//     const url = `https://api.github.com/repos/My-Memory-2008/VHEER-IMAGE-TO-IMAGE-GENERATOR/actions/runs/${run_id}`;
    
//     const response = await fetch(url, {
//       headers: { 
//         'Authorization': `Bearer ${token}`, 
//         'Accept': 'application/vnd.github.v3+json' 
//       }
//     });

//     if (!response.ok) {
//       throw new Error(`GitHub API returned ${response.status}`);
//     }

//     const data = await response.json();

//     // Return EXACTLY what the HTML expects
//     return res.status(200).json({ 
//       status: data.status,       // e.g., "queued", "in_progress", "completed"
//       conclusion: data.conclusion // e.g., "success", "failure", null
//     });

//   } catch (error) {
//     console.error("Status Check Error:", error);
//     return res.status(500).json({ error: error.message });
//   }
// }





import JSZip from 'jszip';

export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.GITHUB_TOKEN;
  const { run_id } = req.query;

  if (!token || !run_id) {
    return res.status(400).json({ error: 'Missing token or run_id' });
  }

  try {
    // 1. Check Workflow Status
    const runUrl = `https://api.github.com/repos/My-Memory-2008/VHEER-IMAGE-TO-IMAGE-GENERATOR/actions/runs/${run_id}`;
    const runRes = await fetch(runUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    
    if (!runRes.ok) throw new Error(`GitHub API Error: ${runRes.status}`);
    const runData = await runRes.json();

    // If not finished, tell frontend to keep waiting
    if (runData.status !== 'completed') {
      return res.status(200).json({ status: runData.status });
    }

    if (runData.conclusion !== 'success') {
      return res.status(200).json({ status: 'completed', conclusion: runData.conclusion });
    }

    // 2. Get Artifacts
    const artUrl = `https://api.github.com/repos/My-Memory-2008/VHEER-IMAGE-TO-IMAGE-GENERATOR/actions/runs/${run_id}/artifacts`;
    const artRes = await fetch(artUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    
    if (!artRes.ok) throw new Error(`Artifact API Error: ${artRes.status}`);
    const artData = await artRes.json();

    if (!artData.artifacts || artData.artifacts.length === 0) {
      // Return 200 but with an error flag so the frontend keeps polling
      return res.status(200).json({ status: 'processing', message: 'Artifacts not ready yet' });
    }

    // 3. Download the Artifact ZIP
    const artifact = artData.artifacts[0];
    const zipUrl = artifact.archive_download_url;
    
    // Follow redirect to get the actual storage URL
    const redirectRes = await fetch(zipUrl, { 
      headers: { 'Authorization': `Bearer ${token}` },
      redirect: 'manual' 
    });
    
    let finalZipUrl = zipUrl;
    if (redirectRes.status === 302) {
      finalZipUrl = redirectRes.headers.get('location');
    }

    // Fetch the ZIP content
    const zipBlob = await fetch(finalZipUrl).then(r => r.blob());
    const zip = await JSZip.loadAsync(zipBlob);

    // 4. Extract the Image
    let imageFile = null;
    zip.forEach((relativePath, file) => {
      if (!file.dir && (file.name.endsWith('.png') || file.name.endsWith('.jpg'))) {
        imageFile = file;
      }
    });

    if (!imageFile) {
      throw new Error('No image file found inside the artifact ZIP');
    }

    // 5. Convert to Base64 and Send
    const base64Image = await imageFile.async("base64");
    const mimeType = imageFile.name.endsWith('.png') ? 'image/png' : 'image/jpeg';
    
    return res.status(200).json({ 
      status: 'success', 
      image_data: `data:${mimeType};base64,${base64Image}` 
    });

  } catch (error) {
    console.error("❌ Status API Crash:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
