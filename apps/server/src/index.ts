import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const { app } = await createApp();

try {
  await app.listen({ host: '0.0.0.0', port });
  console.info(`Gadha Chor server listening on port ${port}`);
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
