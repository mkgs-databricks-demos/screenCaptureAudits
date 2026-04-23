import { createApp, lakebase, server } from '@databricks/appkit';

createApp({
  plugins: [
    server({ autoStart: false }),
    lakebase(),
  ],
})
  .then(async (appkit) => {
    // TODO: Register tRPC routes (audit, agent, patterns, screenshots)
    // TODO: Initialize Lakebase schema (app.* tables) on first startup

    await appkit.server.start();
  })
  .catch(console.error);
