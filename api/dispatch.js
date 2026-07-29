export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, image_data } = req.body;
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    console.error('❌ GITHUB_TOKEN environment variable is not set in Vercel');
    return res.status(500).json({ error: 'Server configuration error: Missing GITHUB_TOKEN' });
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/My-Memory-2008/VHEER-IMAGE-TO-IMAGE-GENERATOR/actions/workflows/vheer.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`, // Changed to Bearer (more reliable than 'token')
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            prompt: prompt,
            image_data: image_data
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      // ✅ THIS IS THE KEY: Log the actual GitHub error to Vercel logs
      console.error(`❌ GitHub API Error (${response.status}):`, errText);
      return res.status(response.status).json({ 
        error: `GitHub API Error: ${response.status}`,
        details: errText 
      });
    }

    return res.status(200).json({ message: 'Workflow dispatched successfully' });
  } catch (error) {
    console.error('❌ Dispatch Exception:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
