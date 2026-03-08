import { Router } from 'express'
import {
  listIntegrations,
  connectIntegration,
  disconnectIntegration,
  syncIntegration,
} from '../controllers/integrationController.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   name: Integrations
 *   description: Third-party integration management
 */

/**
 * @swagger
 * /api/integrations:
 *   get:
 *     summary: List all integrations with connection status
 *     tags: [Integrations]
 *     responses:
 *       200:
 *         description: Array of integration objects
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: google_calendar
 *                   name:
 *                     type: string
 *                     example: Google Calendar
 *                   category:
 *                     type: string
 *                     example: calendar
 *                   description:
 *                     type: string
 *                   badge:
 *                     type: string
 *                     nullable: true
 *                   badgeVariant:
 *                     type: string
 *                     nullable: true
 *                   learnMoreUrl:
 *                     type: string
 *                     nullable: true
 *                   requiresEnterprise:
 *                     type: boolean
 *                   connected:
 *                     type: boolean
 *                   account:
 *                     type: string
 *                     nullable: true
 *                   lastSync:
 *                     type: string
 *                     nullable: true
 *                     format: date-time
 */
router.get('/api/integrations', listIntegrations)

/**
 * @swagger
 * /api/integrations/{type}/connect:
 *   post:
 *     summary: Connect an integration
 *     tags: [Integrations]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema: { type: string }
 *         example: google_calendar
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               account: { type: string, example: user@example.com }
 *     responses:
 *       200:
 *         description: Updated integration object with connected=true
 *       403:
 *         description: Enterprise plan required
 *       404:
 *         description: Integration not found
 */
router.post('/api/integrations/:type/connect', connectIntegration)

/**
 * @swagger
 * /api/integrations/{type}/disconnect:
 *   post:
 *     summary: Disconnect an integration
 *     tags: [Integrations]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: '{ success: true }'
 *       404:
 *         description: Integration not found
 */
router.post('/api/integrations/:type/disconnect', disconnectIntegration)

/**
 * @swagger
 * /api/integrations/{type}/sync:
 *   post:
 *     summary: Trigger a manual sync for a connected integration
 *     tags: [Integrations]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: '{ success: true, synced_at: "..." }'
 *       400:
 *         description: Integration not connected
 *       404:
 *         description: Integration not found
 */
router.post('/api/integrations/:type/sync', syncIntegration)

export default router
