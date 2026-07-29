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
    
    if (!runRes.ok) throw new Error(`GitHub Run API failed: ${runRes.status}`);
    const runData = await runRes.json();

    if (runData.status !== 'completed') {
      return res.status(200).json({ status: runData.status });
    }

    if (runData.conclusion !== 'success') {
      return res.status(200).json({ status: 'completed', conclusion: runData.conclusion });
    }

    // 2. Get Artifacts List (Must use application/json here)
    const artUrl = `https://api.github.com/repos/My-Memory-2008/VHEER-IMAGE-TO-IMAGE-GENERATOR/actions/runs/${run_id}/artifacts`;
    const artRes = await fetch(artUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    
    if (!artRes.ok) throw new Error(`Artifact API failed: ${artRes.status}`);
    const artData = await artRes.json();

    if (!artData.artifacts || artData.artifacts.length === 0) {
      return res.status(200).json({ status: 'processing', message: 'Waiting for artifacts...' });
    }

    // 3. Download the ZIP
    const artifact = artData.artifacts[0];
    const zipUrl = artifact.archive_download_url;
    
    // Fetch the ZIP. We do NOT set Accept: octet-stream here because this URL 
    // is a redirect to S3/GCS which doesn't care about headers, but the initial 
    // GitHub redirect endpoint might. We use standard headers.
    const zipResponse = await fetch(zipUrl, {
      headers: { 
        'Authorization': `Bearer ${token}`
      },
      redirect: 'follow' 
    });

    if (!zipResponse.ok) {
      const errText = await zipResponse.text();
      throw new Error(`Failed to download ZIP: ${zipResponse.status} - ${errText}`);
    }

    const zipBlob = await zipResponse.blob();
    
    // Safety check: Ensure it's actually a ZIP file (starts with PK)
    const arrayBuffer = await zipBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    if (uint8Array[0] !== 0x50 || uint8Array[1] !== 0x4B) {
      throw new Error('Downloaded file is not a valid ZIP. It might be an error page.');
    }

    // 4. Extract Image using JSZip
    const zip = await JSZip.loadAsync(arrayBuffer);
    let imageFile = null;
    
    zip.forEach((relativePath, file) => {
      if (!file.dir && (file.name.endsWith('.png') || file.name.endsWith('.jpg'))) {
        imageFile = file;
      }
    });

    if (!imageFile) {
      throw new Error('No image found in ZIP');
    }

    const base64Image = await imageFile.async("base64");
    const mimeType = imageFile.name.endsWith('.png') ? 'image/png' : 'image/jpeg';
    
    return res.status(200).json({ 
      status: 'success', 
      image_data: `data:${mimeType};base64,${base64Image}` 
    });

  } catch (error) {
    console.error("❌ STATUS API ERROR:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
