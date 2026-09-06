/** @type {import('next').NextConfig} */
const nextConfig = {
  // Eine App bedient die ganze Domain: der statische Onepager (reines
  // HTML aus public/) unter "/", "/impressum", "/datenschutz" sowie das
  // eigentliche React/Next-Quiz unter "/quiz1" (echte App-Router-Route,
  // kein Rewrite — braucht die API-Route für die monday-Anbindung).
  // Kein basePath mehr nötig, da alles in derselben App unter eigenen
  // Pfaden lebt statt unter einem gemeinsamen Prefix.
  async rewrites() {
    return [
      { source: '/', destination: '/index.html' },
      { source: '/impressum', destination: '/impressum.html' },
      { source: '/datenschutz', destination: '/datenschutz.html' },
    ];
  },
};

export default nextConfig;
