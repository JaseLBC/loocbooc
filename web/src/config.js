/**
 * Loocbooc Configuration
 */

export const API_BASE_URL = import.meta.env.PROD 
  ? 'https://loocbooc-api.onrender.com' 
  : 'http://localhost:3000';

export const config = {
  api: {
    baseUrl: API_BASE_URL,
    timeout: 30000
  },
  features: {
    analytics: true,
    waitlist: true
  }
};

export default config;
