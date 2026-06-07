/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',

  reactStrictMode: true,
  swcMinify: true,

  // PWA optimizations
  experimental: {
    optimizeCss: true,
    scrollRestoration: true,
    optimizePackageImports: ['@heroicons/react', 'lucide-react'],
    // Fix router state issues
    serverComponentsExternalPackages: [],
  },

  // Optimize images
  images: {
    domains: ['doocardbarbershop.com', '45.159.115.148'],
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'doocardbarbershop.com',
        pathname: '/uploads/**',
      },
      {
        protocol: 'http',
        hostname: '45.159.115.148',
        pathname: '/uploads/**',
      },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Enhanced security headers
  async headers() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Dynamic CSP based on environment
    const connectSrc = isDevelopment
      ? "'self' http://localhost:3000 http://localhost:3001 ws://localhost:3001"
      : "'self' https://www.doocardbarbershop.com wss://www.doocardbarbershop.com http://doocardbarbershop.com https://doocardbarbershop.com http://185.255.88.158:3001 ws://185.255.88.158:3001 http://45.159.115.148";
    
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `connect-src ${connectSrc}`,
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: http://doocardbarbershop.com https://doocardbarbershop.com http://45.159.115.148",
              "frame-ancestors 'none'",
              "frame-src 'self' https://www.google.com https://www.google.com/maps",
              "base-uri 'self'",
              "form-action 'self'",
              "worker-src 'self' blob:",
              "child-src 'self' blob: https://www.google.com https://www.google.com/maps",
            ].join('; ')
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()'
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, max-age=0'
          },
          {
            key: 'Pragma',
            value: 'no-cache'
          },
          {
            key: 'Expires',
            value: '0'
          }
        ]
      },
      // PWA specific headers
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json'
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript'
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate'
          }
        ]
      },
      {
        source: '/logo/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      }
    ]
  },

  // API rewrites for production and development
  async rewrites() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const backendUrl = isDevelopment 
      ? 'http://localhost:3001' 
      : 'http://backend:3001';
    
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },

  // Enable compression
  compress: true,

  // Environment variables for production
  env: {
    BACKEND_URL: process.env.BACKEND_URL || 'http://doocardbarbershop.com/api',
    NEXT_PUBLIC_PWA_ENABLED: 'true',
    NEXT_PUBLIC_APP_NAME: 'Doocard Salon',
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },
}

module.exports = nextConfig
