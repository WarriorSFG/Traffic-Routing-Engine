// Base URL for backend API endpoints.
// When deploying on Vercel, you can set the environment variable VITE_API_BASE_URL in your Vercel project settings
// (e.g. VITE_API_BASE_URL=https://your-backend.onrender.com).
// If empty, relative requests (e.g. /api/simulate) are used, which work seamlessly with vercel.json rewrites or local Vite dev proxy.
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
