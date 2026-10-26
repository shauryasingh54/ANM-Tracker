import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false, // Prevents double mounting in dev that can disrupt Leaflet maps and Geolocation watch IDs
};

export default nextConfig;
