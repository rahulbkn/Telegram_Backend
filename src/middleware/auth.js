const API_KEY = process.env.API_KEY;

const authenticate = (req, res, next) => {
  const clientApiKey = req.headers['x-api-key'];

  // 🔍 Debug logs (will show in Vercel logs)
  console.log("ENV API_KEY:", API_KEY);
  console.log("Client API_KEY:", clientApiKey);

  if (!clientApiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  if (clientApiKey !== API_KEY) {
    return res.status(401).json({
      error: 'Invalid API key',
      message: `The provided API key is ${clientApiKey}, but expected ${API_KEY}`
    });
  }

  next();
};

module.exports = authenticate;
