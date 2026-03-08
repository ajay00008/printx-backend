import 'dotenv/config'

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/printxai',
  modelServerUrl: process.env.MODEL_SERVER_URL || 'ws://127.0.0.1:8001/infer',
  modelServerToken: (process.env.MODEL_SERVER_TOKEN || '').trim(),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  printxBaseUrl: (process.env.PRINTX_BASE_URL || '').replace(/\/$/, ''),
  corsOrigins: process.env.CORS_ORIGINS || '*',
  logLevel: process.env.LOG_LEVEL || 'info',
  jwtSecret: process.env.JWT_SECRET || 'printx-ai-jwt-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
}
