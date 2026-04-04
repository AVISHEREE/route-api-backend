import dotenv from "dotenv";

dotenv.config();

const requiredEnvVars = [
  'MONGO_URI',
  'JWT_SECRET',
  'GOOGLE_MAPS_API_KEY',
  'RAILRADAR_API_KEY',
  'SERP_API_KEY'
];

export function validateEnvironment() {
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nPlease check your .env file or environment variables.');
    console.error('Use .env.example as a template.');
    process.exit(1);
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.warn('⚠️  JWT_SECRET is weak. Use at least 32 characters for production.');
  }

  console.log('✅ Environment variables validated successfully');
}
