import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Sitio 100 % estático: todo el cálculo ocurre en el navegador (ver docs/DECISIONES.md, ADR-002).
  output: 'export',
  reactStrictMode: true,
  trailingSlash: true,
};

export default nextConfig;
