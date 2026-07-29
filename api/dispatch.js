export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get the token from Vercel's secure storage
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    console.error("❌ GITHUB_TOKEN is missing in Vercel Environment Variables");
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const { prompt, image_data } = req.body;

    // Trigger the GitHub Workflow
    const response = await fetch(
      `https://api.github.com/repos/My-Memory-2008/VHEER-IMAGE-TO-IMAGE-GENERATOR/actions/workflows/vheer.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`, // Use Bearer for better compatibility
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
      const errorText = await response.text();
      console.error(`GitHub API Error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({ 
        error: 'Failed to trigger workflow', 
        details: errorText 
      });
    }

    return res.status(200).json({ message: 'Workflow dispatched successfully' });

  } catch (error) {
    console.error("Dispatch Exception:", error);
    return res.status(500).json({ error: error.message });
  }
}
