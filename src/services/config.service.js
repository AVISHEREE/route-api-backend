export const config = {
  env: process.env.NODE_ENV || "development",
  google: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY,
  },
  railRadar:{
    apiKey:process.env.RAILRADAR_API_KEY,
  },
  serp:{
    apiKey:process.env.SERP_API_KEY
  },

  logging: {
    enabled: process.env.ENABLE_LOGS === "true",
  },

  cache: {
    ttl: Number(process.env.CACHE_TTL) || 1800,
  },
};
