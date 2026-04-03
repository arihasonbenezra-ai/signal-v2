function anthropicApiKey() {
  return (
    process.env.ANTHROPIC_API_KEY ||
    process.env.VITE_ANTHROPIC_API_KEY ||
    ''
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const key = anthropicApiKey();
  if (!key) {
    return res.status(500).json({
      error: {
        message:
          'ANTHROPIC_API_KEY is not set. In Vercel: Project → Settings → Environment Variables.',
      },
    });
  }
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      // Needed if Anthropic classifies the request as browser/CORS (some hosts forward Origin).
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(req.body),
  });
  const text = await response.text();
  let data;
  try {
    data = text && text.trim() ? JSON.parse(text) : {};
  } catch {
    return res.status(502).json({
      error: { message: 'Anthropic returned a non-JSON response.' },
      detail: text.slice(0, 400),
    });
  }
  res.status(response.status).json(data);
}
