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


import JSZip from 'jszip'; // Note: You might need to run 'npm install jszip' locally before pushing if Vercel complains, 
                           // but usually Vercel handles standard imports. If not, use the fetch-blob method below.

export default async function handler(req, res) {
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
    const runData = await runRes.json();

    // If not finished yet, just return status
    if (runData.status !== 'completed') {
      return res.status(200).json({ status: runData.status, conclusion: runData.conclusion });
    }

    // If failed, return failure
    if (runData.conclusion !== 'success') {
      return res.status(200).json({ status: 'completed', conclusion: runData.conclusion });
    }

    // 2. Get Artifact List
    const artUrl = `https://api.github.com/repos/My-Memory-2008/VHEER-IMAGE-TO-IMAGE-GENERATOR/actions/runs/${run_id}/artifacts`;
    const artRes = await fetch(artUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    const artData = await artRes.json();

    if (!artData.artifacts || artData.artifacts.length === 0) {
      return res.status(404).json({ error: 'No artifacts found' });
    }

    // 3. Download the Artifact (ZIP)
    // We use the archive_download_url which redirects to a storage bucket
    const artifact = artData.artifacts[0];
    const zipUrl = artifact.archive_download_url; 
    
    // Fetch the ZIP content. We need to follow redirects manually or use a library.
    // For simplicity in Edge functions, we'll fetch the redirect location.
    let finalZipUrl = zipUrl;
    const redirectRes = await fetch(zipUrl, { 
        headers: { 'Authorization': `Bearer ${token}` },
        redirect: 'manual' 
    });
    
    if (redirectRes.status === 302) {
        finalZipUrl = redirectRes.headers.get('location');
    }

    // Now fetch the actual ZIP from the S3/storage URL (no auth needed for this specific redirected URL usually)
    const zipBlob = await fetch(finalZipUrl).then(r => r.blob());
    
    // 4. Extract Image from ZIP using JSZip
    const zip = await JSZip.loadAsync(zipBlob);
    
    // Find the first image file in the zip
    let imageFile = null;
    zip.forEach((relativePath, file) => {
      if (!file.dir && (file.name.endsWith('.png') || file.name.endsWith('.jpg'))) {
        imageFile = file;
      }
    });

    if (!imageFile) {
      return res.status(404).json({ error: 'No image found in artifact' });
    }

    // 5. Convert to Base64 and Send to Browser
    const base64Image = await imageFile.async("base64");
    const mimeType = imageFile.name.endsWith('.png') ? 'image/png' : 'image/jpeg';
    
    return res.status(200).json({ 
      status: 'success', 
      image_data: `data:${mimeType};base64,${base64Image}` 
    });

  } catch (error) {
    console.error("Artifact Fetch Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
