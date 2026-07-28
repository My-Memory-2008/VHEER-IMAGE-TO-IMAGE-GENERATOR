export async function POST(request) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  try {
    const { image, prompt } = await request.json();

    if (!image || !prompt) {
      return new Response(JSON.stringify({ error: "Missing required payload variables." }), { status: 400, headers: corsHeaders });
    }

    // Clean up base64 prefixes (like "data:image/png;base64,") so the workflow shell can decode it perfectly
    const pureBase64 = image.includes(",") ? image.split(",")[1] : image;

    // Target the repository dispatch endpoint
    const dispatchUrl = `https://github.com`;
    
    const response = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        "Authorization": `token ${process.env.VHEER_GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        event_type: "web_ui_upload", // Matches your yml: types: [web_ui_upload]
        client_payload: {
          image: pureBase64,
          prompt: prompt
        }
      })
    });

    if (response.status !== 204 && response.status !== 200) {
      const errorText = await response.text();
      console.error("GitHub API rejection:", errorText);
      throw new Error("Failed to initialize the GitHub dispatch execution event hook.");
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
