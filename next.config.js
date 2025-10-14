/** @type {import('next').NextConfig} */
const nextConfig = {
  // WICHTIG: top-level, nicht unter "experimental"
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;
