import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';

function buildDevToken() {
    return jwt.sign(
        {
            sub: 'n8',
            name: 'Nathan',
            role: 'admin',
            permissions: ['deploy'],
            tenants: [
                { id: 'town', name: 'Town Workspace', sha: '', connections: [] }
            ],
            tenantId: 'town',
            delegations: []
        },
        process.env.JWT_SECRET!,
        {
            audience: process.env.AUTH_AUDIENCE,
            issuer: process.env.AUTH_ISSUER,
            expiresIn: '1h'
        }
    );
}

test('runtime loads with valid JWT', async ({ page, context }) => {
    const token = buildDevToken();

    await context.addCookies([
        {
            name: 'jwt',
            value: token,
            domain: 'localhost',
            path: '/',
            httpOnly: false,
            secure: false,
            sameSite: 'Strict'
        }
    ]);

    await page.goto('/');

    await expect(page.locator('text=Town Workspace')).toBeVisible();
    await expect(page.locator('text=Nathan')).toBeVisible();
});
