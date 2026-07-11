// PM2 config for bare-metal / EC2 deployments (alternative to Docker)
module.exports = {
  apps: [
    {
      name: 'sbg-buk-quiz-api',
      cwd: './server',
      script: 'dist/index.js',
      instances: 1, // increase after adding the Redis Socket.IO adapter
      env: { NODE_ENV: 'production' },
      max_memory_restart: '400M',
    },
  ],
};
