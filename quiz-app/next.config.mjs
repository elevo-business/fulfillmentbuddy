/** @type {import('next').NextConfig} */
const nextConfig = {
  // Läuft unter fulfillmentbuddy.de/quiz1 (Pfad auf der Hauptdomain,
  // keine eigene Subdomain) — Next.js prefixt Routing/Assets damit
  // automatisch. Manuelle absolute Pfade (fetch, url(), <img src>)
  // müssen den Prefix weiterhin selbst tragen.
  basePath: '/quiz1',
};

export default nextConfig;
