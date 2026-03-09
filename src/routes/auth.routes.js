import { Router } from 'express'
import { login, signup, me, listUsers, deactivateUser } from '../controllers/authController.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication and user management
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: admin@printx-ai.in
 *               password:
 *                 type: string
 *                 example: Admin123
 *               redirect_uri:
 *                 type: string
 *                 description: Optional; relative path to redirect after login (e.g. /dashboard/record?session=xxx). Echoed back in response so client redirects to same page as host.
 *     responses:
 *       200:
 *         description: Login successful — returns JWT token, user object, and redirect_uri if provided
 *       401:
 *         description: Invalid credentials
 */
router.post('/api/auth/login', login)

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new account (public)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jane Doe
 *               email:
 *                 type: string
 *                 example: jane@example.com
 *               password:
 *                 type: string
 *                 example: secret123
 *     responses:
 *       201:
 *         description: Account created — returns JWT token and user object
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already exists
 */
router.post('/api/auth/signup', signup)

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user object
 *       401:
 *         description: Not authenticated
 */
router.get('/api/auth/me', requireAuth, me)

/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: List all users (admin only)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of user objects
 *       403:
 *         description: Admin role required
 */
router.get('/api/auth/users', requireAuth, requireRole('admin'), listUsers)

/**
 * @swagger
 * /api/auth/users/{id}/deactivate:
 *   patch:
 *     summary: Deactivate a user account (admin only)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deactivated
 *       403:
 *         description: Admin role required
 *       404:
 *         description: User not found
 */
router.patch('/api/auth/users/:id/deactivate', requireAuth, requireRole('admin'), deactivateUser)

export default router
