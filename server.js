const express = require('express');
const os = require('os');

const app = express();
const PORT = 3001;

// Simple middleware to parse JSON (for future extensibility)
app.use(express.json());

// Basic demo routes
app.get('/', (req, res) => {
  res.send(`Hello World ${new Date().toISOString()}`);
});

app.get('/api/v1/hello', (req, res) => {
  res.send('Good Afternoon');
});

/**
 * Health endpoint.
 *
 * NOTE: A single container cannot reliably know the total number of
 * replicas/instances in Azure Container Apps. That information lives in
 * Azure's control plane. This endpoint reports per-instance health and
 * includes placeholders for cluster-level info that you can later wire
 * up to Azure APIs if needed.
 */
app.get('/api/v1/health', (req, res) => {
  const now = new Date();

  const health = {
    status: 'ok',
    timestamp: now.toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    instance: {
      hostname: os.hostname(),
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version,
      memory: process.memoryUsage(),
    },
    // Placeholders: to be filled by a separate service that talks to Azure APIs
    cluster: {
      totalInstances: null,
      running: null,
      stopped: null,
      starting: null,
    },
  };

  res.json(health);
});

/**
 * Admin endpoint to intentionally kill this server instance.
 *
 * Security:
 * - Requires an API key provided via `x-api-key` header.
 * - Configure the key via the ADMIN_API_KEY environment variable.
 */
app.post('/api/v1/admin/kill', (req, res) => {
  const providedKey = req.header('x-api-key');
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey) {
    return res.status(500).json({
      error: 'ADMIN_API_KEY is not configured on the server',
    });
  }

  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.json({ message: 'Server will shut down now for test purposes' });

  // Give the response a moment to flush, then exit.
  setTimeout(() => {
    // Non-zero exit code so orchestrator treats this as a failure and can restart it.
    process.exit(1);
  }, 100);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});