module.exports = {
  apps: [
    {
      name: 'doocard-backend',
      cwd: '/var/www/doocard/backend',
      script: 'dist/main.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '127.0.0.1',
      },
    },
  ],
};
