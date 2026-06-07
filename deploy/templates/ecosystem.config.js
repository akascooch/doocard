/** PM2 ecosystem — Doocard production */
module.exports = {
  apps: [
    {
      name: 'doocard-backend',
      cwd: '/var/www/doocard/backend',
      script: 'dist/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      max_memory_restart: '512M',
      error_file: '/var/log/doocard/backend-error.log',
      out_file: '/var/log/doocard/backend-out.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'doocard-frontend',
      cwd: '/var/www/doocard/frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '768M',
      error_file: '/var/log/doocard/frontend-error.log',
      out_file: '/var/log/doocard/frontend-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
