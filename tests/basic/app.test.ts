import { describe, test, expect } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app';

describe('Basic App Tests', () => {
  test('should start the express app', () => {
    expect(app).toBeDefined();
  });

  test('should return 404 for unknown routes', async () => {
    const response = await request(app).get('/api/v1/unknown-route').expect(404);

    expect(response.body).toHaveProperty('message', 'Not Found');
  });

  test('should have security headers', async () => {
    const response = await request(app).get('/api/v1/unknown-route');

    // Check for helmet security headers
    expect(response.headers).toHaveProperty('x-content-type-options');
    expect(response.headers).toHaveProperty('x-frame-options');
  });

  test('should handle JSON parsing', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({ test: 'data' });

    // Should not crash on JSON parsing
    expect(response.status).toBeDefined();
  });

  test('should handle auth routes', async () => {
    // Test that auth routes are mounted
    const response = await request(app).post('/api/v1/auth/register').send({});

    // Should reach the route (even if validation fails)
    expect(response.status).not.toBe(404);
  });

  test('should handle user routes', async () => {
    // Test that user routes are mounted
    const response = await request(app).get('/api/v1/user/me');

    // Should reach the route (even if auth fails)
    expect(response.status).not.toBe(404);
  });
});
