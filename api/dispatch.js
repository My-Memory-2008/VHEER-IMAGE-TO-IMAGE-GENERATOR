export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, image_data } = req.body;
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    return res.status(500).json({ error: 'Server configuration error: Missing token' });
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/My-Memory-2008/VHEER-IMAGE-TO-IMAGE-GENERATOR/actions/workflows/vheer.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            prompt: prompt,
            image_data: image_data // Passing the full base64 string
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`GitHub API Error: ${response.status} - ${errText}`);
    }

    return res.status(200).json({ message: 'Workflow dispatched successfully' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
