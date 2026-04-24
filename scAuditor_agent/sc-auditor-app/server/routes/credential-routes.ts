/**
 * Credential reference CRUD routes.
 * Manages pointers to credentials — NEVER stores actual secrets.
 */
import type { AppKitServer } from '@databricks/appkit';
import type { Express } from 'express';
import { v4 as uuid } from 'uuid';

export function setupCredentialRoutes(appkit: AppKitServer, app: Express): void {
  const pool = appkit.lakebase.pool;

  // List credential references for current user (includes shared admin-managed)
  app.get('/api/credentials', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string ?? 'anonymous';

      const result = await pool.query(
        `SELECT id, user_id, target_system, credential_source,
                secret_scope, username_key, password_key,
                uc_connection_name, auth_method, mfa_method,
                login_url, token_url, scopes,
                is_admin_managed, created_by, created_at, updated_at
         FROM app.credential_references
         WHERE user_id = $1 OR user_id IS NULL
         ORDER BY target_system, credential_source`,
        [userId]
      );

      res.json({ credentials: result.rows });
    } catch (err) {
      console.error('[credentials] List failed:', err);
      res.status(500).json({ error: 'Failed to list credentials' });
    }
  });

  // Create a user credential reference (secret_scope source)
  app.post('/api/credentials', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string ?? 'anonymous';
      const {
        targetSystem, credentialSource, secretScope, usernameKey, passwordKey,
        ucConnectionName, authMethod, mfaMethod, loginUrl, tokenUrl, scopes,
        isAdminManaged,
      } = req.body;

      if (!targetSystem || !credentialSource || !authMethod) {
        res.status(400).json({ error: 'targetSystem, credentialSource, and authMethod are required' });
        return;
      }

      const id = uuid();
      const effectiveUserId = isAdminManaged ? null : userId;

      await pool.query(
        `INSERT INTO app.credential_references (
           id, user_id, target_system, credential_source,
           secret_scope, username_key, password_key,
           uc_connection_name, auth_method, mfa_method,
           login_url, token_url, scopes,
           is_admin_managed, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          id, effectiveUserId, targetSystem, credentialSource,
          secretScope ?? null, usernameKey ?? null, passwordKey ?? null,
          ucConnectionName ?? null, authMethod, mfaMethod ?? null,
          loginUrl ?? null, tokenUrl ?? null, scopes ?? null,
          isAdminManaged ?? false, userId,
        ]
      );

      res.json({ id, created: true });
    } catch (err) {
      console.error('[credentials] Create failed:', err);
      res.status(500).json({ error: 'Failed to create credential reference' });
    }
  });

  // Update a credential reference
  app.patch('/api/credentials/:credentialId', async (req, res) => {
    try {
      const { credentialId } = req.params;
      const {
        authMethod, mfaMethod, loginUrl, tokenUrl, scopes,
        secretScope, usernameKey, passwordKey, ucConnectionName,
      } = req.body;

      const sets: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      const fields: Record<string, unknown> = {
        auth_method: authMethod,
        mfa_method: mfaMethod,
        login_url: loginUrl,
        token_url: tokenUrl,
        scopes,
        secret_scope: secretScope,
        username_key: usernameKey,
        password_key: passwordKey,
        uc_connection_name: ucConnectionName,
      };

      for (const [col, val] of Object.entries(fields)) {
        if (val !== undefined) {
          sets.push(`${col} = $${idx++}`);
          params.push(val);
        }
      }

      if (sets.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      sets.push(`updated_at = NOW()`);
      params.push(credentialId);

      await pool.query(
        `UPDATE app.credential_references SET ${sets.join(', ')} WHERE id = $${idx}`,
        params
      );

      res.json({ updated: true });
    } catch (err) {
      console.error('[credentials] Update failed:', err);
      res.status(500).json({ error: 'Failed to update credential reference' });
    }
  });

  // Delete a credential reference
  app.delete('/api/credentials/:credentialId', async (req, res) => {
    try {
      await pool.query(
        `DELETE FROM app.credential_references WHERE id = $1`,
        [req.params.credentialId]
      );
      res.json({ deleted: true });
    } catch (err) {
      console.error('[credentials] Delete failed:', err);
      res.status(500).json({ error: 'Failed to delete credential reference' });
    }
  });
}
