// PM2 config for a persistent host (EC2, VPS, Render background worker, ...).
// This is the entry point that runs live Socket.IO games; Vercel's serverless
// functions cannot keep the game loop alive.
module.exports = {
  apps: [
    {
      name: 'sbg-buk-quiz-api',
      cwd: './server',
      script: 'dist/index.js',
      instances: 1, // increase only after adding a Redis Socket.IO adapter
      env: { NODE_ENV: 'production' },
      max_memory_restart: '400M',
    },
  ],
};
