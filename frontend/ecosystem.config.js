module.exports = {
  apps: [
    {
      name: "doocard-frontend",
      cwd: "/var/www/doocard/frontend/.next/standalone",
      script: "server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "127.0.0.1",
        HOST: "127.0.0.1"
      }
    }
  ]
};

