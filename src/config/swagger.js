import swaggerJsdoc from 'swagger-jsdoc'

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Printx.ai API',
      version: '1.0.0',
      description: 'REST + WebSocket API for Printx.ai — Parakeet 600M STT bridge, share rooms, AI features',
      contact: { name: 'Printx.ai', url: 'https://printx-ai.in' },
    },
    servers: [
      { url: 'http://localhost:3001', description: 'Local dev' },
      { url: 'https://printx-ai.in', description: 'Production' },
    ],
    components: {
      securitySchemes: {
        sessionToken: {
          type: 'apiKey',
          in: 'query',
          name: 'token',
          description: 'Session token returned by POST /api/session/start',
        },
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT returned by POST /api/auth/login',
        },
      },
      schemas: {
        Session: {
          type: 'object',
          properties: {
            session_id: { type: 'string', example: 'uuid-v4' },
            session_token: { type: 'string', example: 'uuid-v4' },
          },
        },
        Segment: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            time: { type: 'string', example: '0:05' },
            timestamp: { type: 'number', example: 5000 },
            speakerName: { type: 'string', example: 'Speaker 1' },
          },
        },
        Share: {
          type: 'object',
          properties: {
            share_id: { type: 'string' },
            title: { type: 'string' },
            full_text: { type: 'string' },
            segments: { type: 'array', items: { $ref: '#/components/schemas/Segment' } },
            created_at: { type: 'number' },
            visibility: { type: 'string', enum: ['public', 'restricted'] },
            recording_url: { type: 'string', nullable: true },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js'],
}

export const swaggerSpec = swaggerJsdoc(options)
