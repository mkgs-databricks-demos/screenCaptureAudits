import { createApp, lakebase, server } from '@databricks/appkit';
import { initLakebaseSchema } from './db/init-schema.js';
import { prependMiddleware } from './middleware/otel-server-spans.js';
import { setupAuditRoutes } from './routes/audit-routes.js';
import { setupAgentRoutes } from './routes/agent-routes.js';
import { setupPatternRoutes } from './routes/pattern-routes.js';
import { setupScreenshotRoutes } from './routes/screenshot-routes.js';
import { setupCredentialRoutes } from './routes/credential-routes.js';
import { setupReportRoutes } from './routes/report-routes.js';

createApp({
  plugins: [
    server({ autoStart: false }),
    lakebase(),
  ],
})
  .then(async (appkit) => {
    await initLakebaseSchema(appkit);

    appkit.server.extend((app: any) => {
      // Prepend OTel server-span middleware into Express stack.
      prependMiddleware(app);

      setupAuditRoutes(appkit, app);
      setupAgentRoutes(appkit, app);
      setupPatternRoutes(appkit, app);
      setupScreenshotRoutes(appkit, app);
      setupCredentialRoutes(appkit, app);
      setupReportRoutes(appkit, app);
    });

    await appkit.server.start();
  })
  .catch(console.error);
