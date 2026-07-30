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







// import JSZip from 'jszip';

// export default async function handler(req, res) {
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
//     // 1. Check Workflow Status
//     const runUrl = `https://api.github.com/repos/My-Memory-2008/VHEER-IMAGE-TO-IMAGE-GENERATOR/actions/runs/${run_id}`;
//     const runRes = await fetch(runUrl, {
//       headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
//     });
    
//     if (!runRes.ok) throw new Error(`GitHub Run API failed: ${runRes.status}`);
//     const runData = await runRes.json();

//     if (runData.status !== 'completed') {
//       return res.status(200).json({ status: runData.status });
//     }

//     if (runData.conclusion !== 'success') {
//       return res.status(200).json({ status: 'completed', conclusion: runData.conclusion });
//     }

//     // 2. Get Artifacts List
//     const artUrl = `https://api.github.com/repos/My-Memory-2008/VHEER-IMAGE-TO-IMAGE-GENERATOR/actions/runs/${run_id}/artifacts`;
//     const artRes = await fetch(artUrl, {
//       headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
//     });
    
//     if (!artRes.ok) throw new Error(`Artifact API failed: ${artRes.status}`);
//     const artData = await artRes.json();

//     if (!artData.artifacts || artData.artifacts.length === 0) {
//       return res.status(200).json({ status: 'processing', message: 'Waiting for artifacts...' });
//     }

//     // 3. Download the ZIP
//     const artifact = artData.artifacts[0];
//     const zipUrl = artifact.archive_download_url;
    
//     const zipResponse = await fetch(zipUrl, {
//       headers: { 'Authorization': `Bearer ${token}` },
//       redirect: 'follow' 
//     });

//     if (!zipResponse.ok) {
//       const errText = await zipResponse.text();
//       throw new Error(`Failed to download ZIP: ${zipResponse.status} - ${errText}`);
//     }

//     const zipBlob = await zipResponse.blob();
//     const arrayBuffer = await zipBlob.arrayBuffer();
    
//     // Safety check: Ensure it's actually a ZIP file
//     const uint8Array = new Uint8Array(arrayBuffer);
//     if (uint8Array[0] !== 0x50 || uint8Array[1] !== 0x4B) {
//       throw new Error('Downloaded file is not a valid ZIP.');
//     }

//     // 4. Extract Image using JSZip
//     const zip = await JSZip.loadAsync(arrayBuffer);
//     let imageFile = null;
//     let allFiles = [];
    
//     zip.forEach((relativePath, file) => {
//       allFiles.push(relativePath);
//       const lowerName = file.name.toLowerCase();
//       // Check for png, jpg, jpeg, or webp (case-insensitive)
//       if (!file.dir && (lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.webp'))) {
//         imageFile = file;
//       }
//     });

//     if (!imageFile) {
//       // This will print exactly what is inside the ZIP to your Vercel logs
//       console.error("❌ Files found in ZIP:", allFiles);
//       throw new Error(`No image found in ZIP. Files present: ${allFiles.join(', ')}`);
//     }

//     const base64Image = await imageFile.async("base64");
    
//     // Determine MIME type based on the actual extension
//     const lowerName = imageFile.name.toLowerCase();
//     let mimeType = 'image/png';
//     if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) mimeType = 'image/jpeg';
//     else if (lowerName.endsWith('.webp')) mimeType = 'image/webp';

//     return res.status(200).json({ 
//       status: 'success', 
//       image_data: `data:${mimeType};base64,${base64Image}` 
//     });

//   } catch (error) {
//     console.error("❌ STATUS API ERROR:", error.message);
//     return res.status(500).json({ error: error.message });
//   }
// }






import JSZip from 'jszip';

const referer = req.headers.referer || "";
const origin = req.headers.origin || "";
const allowed = "https://perchance.org/awram-ai-image-generator-0-pro"; // your exact URL

if (!referer.includes(allowed) && !origin.includes(allowed)) {
  return res.status(403).json({ error: "Access denied" });
}



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

    // 2. Get Artifacts List
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
    
    const zipResponse = await fetch(zipUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
      redirect: 'follow' 
    });

    if (!zipResponse.ok) {
      const errText = await zipResponse.text();
      throw new Error(`Failed to download ZIP: ${zipResponse.status} - ${errText}`);
    }

    const zipBlob = await zipResponse.blob();
    const arrayBuffer = await zipBlob.arrayBuffer();
    
    // Safety check: Ensure it's actually a ZIP file
    const uint8Array = new Uint8Array(arrayBuffer);
    if (uint8Array[0] !== 0x50 || uint8Array[1] !== 0x4B) {
      throw new Error('Downloaded file is not a valid ZIP.');
    }

    // 4. Extract Image using JSZip with Magic Byte Detection
    const zip = await JSZip.loadAsync(arrayBuffer);
    let imageFile = null;
    
    // Helper function to detect image type by its binary signature
    const checkMagicBytes = (bytes) => {
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
      if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
      if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return 'image/webp'; // RIFF
      return null;
    };

    for (const [relativePath, file] of Object.entries(zip.files)) {
      if (file.dir) continue; // Skip directories
      
      const fileBytes = await file.async("uint8array");
      const mimeType = checkMagicBytes(fileBytes);
      
      if (mimeType) {
        imageFile = { data: fileBytes, mimeType };
        console.log(`✅ Found valid image file: ${relativePath} (Detected as: ${mimeType})`);
        break; // Stop at the first valid image
      } else {
        // Log the first 4 bytes in hex so we know exactly what this file is
        const hexBytes = Array.from(fileBytes.slice(0, 4)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
        console.log(`⚠️ Skipping non-image file: ${relativePath} (First bytes: ${hexBytes})`);
      }
    }

    if (!imageFile) {
      const allFiles = Object.keys(zip.files).filter(k => !zip.files[k].dir);
      console.error("❌ No valid image found in ZIP. Files present:", allFiles);
      throw new Error(`No valid image found in ZIP. Files present: ${allFiles.join(', ')}`);
    }

    // Convert the detected image bytes to base64
    const base64Image = Buffer.from(imageFile.data).toString('base64');
    
    return res.status(200).json({ 
      status: 'success', 
      image_data: `data:${imageFile.mimeType};base64,${base64Image}` 
    });

  } catch (error) {
    console.error("❌ STATUS API ERROR:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
