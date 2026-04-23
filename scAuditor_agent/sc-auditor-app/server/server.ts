import { createApp, lakebase, server } from '@databricks/appkit';
import { initLakebaseSchema } from './db/init-schema.js';
import { setupAuditRoutes } from './routes/audit-routes.js';
import { setupAgentRoutes } from './routes/agent-routes.js';
import { setupPatternRoutes } from './routes/pattern-routes.js';
import { setupScreenshotRoutes } from './routes/screenshot-routes.js';
import { setupCredentialRoutes } from './routes/credential-routes.js';

createApp({
  plugins: [
    server({ autoStart: false }),
    lakebase(),
  ],
})
  .then(async (appkit) => {
    // Initialize Lakebase schema (idempotent — safe on every startup)
    await initLakebaseSchema(appkit);

    // Register API routes
    await setupAuditRoutes(appkit);
    await setupAgentRoutes(appkit);
    await setupPatternRoutes(appkit);
    await setupScreenshotRoutes(appkit);
    await setupCredentialRoutes(appkit);

    await appkit.server.start();
  })
  .catch(console.error);
