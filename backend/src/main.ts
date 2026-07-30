import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.FRONTEND_URL?.split(',') ?? true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Bodya CRM API')
    .setDescription('API модуля клієнтів Bodya CRM')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Авторизація та поточна сесія')
    .addTag('clients', 'Керування клієнтами')
    .addTag('tasks', 'Глобальне керування завданнями')
    .addTag('analytics', 'Зведена аналітика CRM')
    .addTag('team chat', 'Внутрішнє спілкування команди')
    .addTag('managers', 'Довідник менеджерів')
    .build();

  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  await app.listen(Number(process.env.PORT) || 3000, '0.0.0.0');
}

void bootstrap();
