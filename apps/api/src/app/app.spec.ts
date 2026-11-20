import {
  Body,
  Controller,
  Get,
  Post,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { zLoginRequest, type LoginRequest } from '@rule-studio/shared-types';
import request from 'supertest';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { AppModule } from './app.module';

// A throwaway controller, only for this test, to exercise the pipe and filter end to end.
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
    const moduleRef = await Test.createTestingModule({
      imports: [
        AppModule.register({
          NODE_ENV: 'test',
          PORT: 0,
          DATABASE_URL: 'postgresql://unused:unused@localhost:5432/unused',
        }),
      ],
      controllers: [TestController],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
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
