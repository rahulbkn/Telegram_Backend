const API_KEY = process.env.API_KEY;

const authenticate = (req, res, next) => {
  const clientApiKey = req.headers['x-api-key'];
  
  if (!clientApiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  if (clientApiKey !== API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
};

module.exports = authenticate;