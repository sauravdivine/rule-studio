import {
  Body,
  Controller,
  Get,
  Post,
  type INestApplication,
} from '@nestjs/common';
import { zLoginRequest, type LoginRequest } from '@rule-studio/shared-types';
import request from 'supertest';
import { Public } from '../auth/decorators/public.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { createTestApp } from '../test/test-app';

// A throwaway controller, only for this test, to exercise the pipe and filter end to end.
// Public, so these tests check the pipe and filter without needing to sign in.
@Public()
@Controller('test')
class TestController {
  @Post('echo')
  echo(@Body(new ZodValidationPipe(zLoginRequest)) body: LoginRequest) {
    return body;
  }

  @Get('boom')
  boom() {
    throw new Error('secret internal detail');
  }
}

describe('API skeleton (HTTP)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp({ controllers: [TestController] }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers an unknown route with a problem-details 404', async () => {
    const response = await request(app.getHttpServer()).get('/api/nope');
    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body).toMatchObject({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      instance: '/api/nope',
    });
  });

  it('validates a body against the contract and lists the bad fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/test/echo')
      .send({ email: 'nope', password: '' });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ status: 400, title: 'Bad Request' });
    expect(response.body.errors).toHaveLength(2);
  });

  it('passes a valid body through, with unknown keys removed', async () => {
    const response = await request(app.getHttpServer())
      .post('/test/echo')
      .send({ email: 'viewer@rulestudio.dev', password: 'x', role: 'ADMIN' });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      email: 'viewer@rulestudio.dev',
      password: 'x',
    });
  });

  it('hides the details of an unexpected error', async () => {
    const response = await request(app.getHttpServer()).get('/test/boom');
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain(
      'secret internal detail',
    );
  });
});
