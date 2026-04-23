/**
 * Audit report generator.
 *
 * Builds HTML audit reports from session data (screenshots, findings,
 * extractions) and uploads them to a UC Volume. Uses ai_query to
 * generate the executive summary.
 */
import type { AppKitServer } from '@databricks/appkit';
import { v4 as uuid } from 'uuid';

interface ReportInput {
  sessionId: string;
  targetSystem: string;
  auditType: string | null;
  userId: string;
  startedAt: string;
  completedAt: string | null;
  findings: ReportFinding[];
  screenshots: ReportScreenshot[];
  extractions: ReportExtraction[];
  reportType: string;
}

interface ReportFinding {
  finding_id: string;
  finding_type: string;
  category: string;
  description: string;
  severity: string;
  regulation_ref: string | null;
  evidence: unknown;
}

interface ReportScreenshot {
  screenshot_id: string;
  screen_label: string | null;
  page_url: string | null;
  volume_path: string;
  captured_at: string;
}

interface ReportExtraction {
  extraction_id: string;
  screenshot_id: string;
  extraction_prompt: string;
  extracted_data: unknown;
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return '#BD2B26';
    case 'high':
      return '#FF3621';
    case 'medium':
      return '#FFAB00';
    case 'low':
      return '#2272B4';
    default:
      return '#5A6F77';
  }
}

function buildHtmlReport(input: ReportInput, summary: string): string {
  const { sessionId, targetSystem, auditType, userId, startedAt, completedAt, findings, screenshots } = input;

  const findingsBySeverity = ['critical', 'high', 'medium', 'low', 'info'].map((sev) => ({
    severity: sev,
    items: findings.filter((f) => f.severity === sev),
  })).filter((g) => g.items.length > 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Audit Report — ${targetSystem}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'DM Sans', -apple-system, sans-serif; color: #1B3139; line-height: 1.5; }
    .page { max-width: 800px; margin: 0 auto; padding: 48px 32px; }
    .header { border-bottom: 3px solid #FF3621; padding-bottom: 24px; margin-bottom: 32px; }
    .header h1 { font-size: 28px; font-weight: 700; }
    .header .subtitle { font-size: 14px; color: #5A6F77; margin-top: 4px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0; }
    .meta-item { font-size: 13px; }
    .meta-item .label { color: #5A6F77; font-weight: 500; }
    .meta-item .value { font-weight: 600; }
    .section { margin-bottom: 32px; }
    .section h2 { font-size: 20px; font-weight: 700; margin-bottom: 16px; border-bottom: 1px solid #DCE0E2; padding-bottom: 8px; }
    .summary { background: #F9F7F4; border-radius: 8px; padding: 20px; font-size: 14px; }
    .finding { border: 1px solid #DCE0E2; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .finding .finding-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .finding .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; color: white; text-transform: uppercase; }
    .finding .category { font-size: 12px; color: #5A6F77; }
    .finding .description { font-size: 14px; margin-top: 8px; }
    .finding .regulation { font-size: 12px; color: #2272B4; margin-top: 4px; }
    .screenshot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .screenshot-item { border: 1px solid #DCE0E2; border-radius: 8px; padding: 12px; font-size: 12px; }
    .screenshot-item .label { font-weight: 600; }
    .screenshot-item .path { color: #5A6F77; font-family: 'DM Mono', monospace; font-size: 11px; word-break: break-all; }
    .stats { display: flex; gap: 24px; margin: 16px 0; }
    .stat { text-align: center; }
    .stat .num { font-size: 28px; font-weight: 700; color: #FF3621; }
    .stat .lbl { font-size: 12px; color: #5A6F77; }
    .footer { border-top: 1px solid #DCE0E2; padding-top: 16px; margin-top: 48px; font-size: 11px; color: #5A6F77; text-align: center; }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <h1>Audit Report</h1>
    <p class="subtitle">${targetSystem}${auditType ? ` — ${auditType}` : ''}</p>
  </div>

  <div class="meta-grid">
    <div class="meta-item"><span class="label">Session ID:</span> <span class="value">${sessionId}</span></div>
    <div class="meta-item"><span class="label">Auditor:</span> <span class="value">${userId}</span></div>
    <div class="meta-item"><span class="label">Started:</span> <span class="value">${new Date(startedAt).toLocaleString()}</span></div>
    <div class="meta-item"><span class="label">Completed:</span> <span class="value">${completedAt ? new Date(completedAt).toLocaleString() : 'In progress'}</span></div>
  </div>

  <div class="stats">
    <div class="stat"><div class="num">${findings.length}</div><div class="lbl">Findings</div></div>
    <div class="stat"><div class="num">${screenshots.length}</div><div class="lbl">Screenshots</div></div>
    <div class="stat"><div class="num">${findings.filter((f) => f.severity === 'critical' || f.severity === 'high').length}</div><div class="lbl">High/Critical</div></div>
  </div>

  <div class="section">
    <h2>Executive Summary</h2>
    <div class="summary">${summary}</div>
  </div>

  ${findingsBySeverity.length > 0 ? `
  <div class="section">
    <h2>Findings</h2>
    ${findingsBySeverity.map((group) => group.items.map((f) => `
    <div class="finding">
      <div class="finding-header">
        <span class="badge" style="background:${severityColor(f.severity)}">${f.severity}</span>
        <span class="category">${f.category}</span>
        <span class="category">${f.finding_type}</span>
      </div>
      <p class="description">${f.description}</p>
      ${f.regulation_ref ? `<p class="regulation">Ref: ${f.regulation_ref}</p>` : ''}
    </div>`).join('\n')).join('\n')}
  </div>` : ''}

  ${screenshots.length > 0 ? `
  <div class="section">
    <h2>Screenshots Captured</h2>
    <div class="screenshot-grid">
      ${screenshots.map((s, i) => `
      <div class="screenshot-item">
        <div class="label">${i + 1}. ${s.screen_label ?? 'Untitled'}</div>
        <div class="path">${s.volume_path}</div>
      </div>`).join('\n')}
    </div>
  </div>` : ''}

  <div class="footer">
    Generated by SC Auditor Agent &bull; ${new Date().toISOString()}
  </div>
</div>
</body>
</html>`;
}

export async function generateAuditReport(
  appkit: AppKitServer,
  sessionId: string,
  reportType: string = 'summary'
): Promise<{
  reportId: string;
  volumePath: string;
  summary: string;
  pageCount: number;
  fileSizeBytes: number;
}> {
  const pool = appkit.lakebase.pool;

  // 1. Fetch session info from Lakebase
  const sessionResult = await pool.query(
    `SELECT * FROM app.agent_sessions WHERE id = $1`,
    [sessionId]
  );
  const session = sessionResult.rows[0];
  if (!session) throw new Error(`Session ${sessionId} not found`);

  // 2. Fetch findings from UC
  let findings: ReportFinding[] = [];
  try {
    const findingsResult = await appkit.analytics.executeStatement(`
      SELECT finding_id, finding_type, category, description,
             severity, regulation_ref, evidence
      FROM audit_findings
      WHERE session_id = '${sessionId}'
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END
    `);
    const rows = findingsResult?.result?.data_array ?? [];
    findings = rows.map((r: string[]) => ({
      finding_id: r[0],
      finding_type: r[1],
      category: r[2],
      description: r[3],
      severity: r[4],
      regulation_ref: r[5] ?? null,
      evidence: r[6] ? JSON.parse(r[6]) : null,
    }));
  } catch (err) {
    console.error('[report] Findings fetch failed:', err);
  }

  // 3. Fetch screenshots from UC
  let screenshots: ReportScreenshot[] = [];
  try {
    const ssResult = await appkit.analytics.executeStatement(`
      SELECT screenshot_id, screen_label, page_url, volume_path, captured_at
      FROM audit_screenshots
      WHERE session_id = '${sessionId}'
      ORDER BY capture_order ASC
    `);
    const rows = ssResult?.result?.data_array ?? [];
    screenshots = rows.map((r: string[]) => ({
      screenshot_id: r[0],
      screen_label: r[1] ?? null,
      page_url: r[2] ?? null,
      volume_path: r[3],
      captured_at: r[4],
    }));
  } catch (err) {
    console.error('[report] Screenshots fetch failed:', err);
  }

  // 4. Fetch extractions
  let extractions: ReportExtraction[] = [];
  try {
    const exResult = await appkit.analytics.executeStatement(`
      SELECT extraction_id, screenshot_id, extraction_prompt, extracted_data
      FROM audit_extractions
      WHERE session_id = '${sessionId}'
      ORDER BY extracted_at ASC
    `);
    const rows = exResult?.result?.data_array ?? [];
    extractions = rows.map((r: string[]) => ({
      extraction_id: r[0],
      screenshot_id: r[1],
      extraction_prompt: r[2],
      extracted_data: r[3] ? JSON.parse(r[3]) : null,
    }));
  } catch (err) {
    console.error('[report] Extractions fetch failed:', err);
  }

  // 5. Generate executive summary via LLM
  let summary = 'No executive summary available.';
  try {
    const findingsSummary = findings.map(
      (f) => `[${f.severity.toUpperCase()}] ${f.category}: ${f.description}`
    ).join('\n');

    const summaryPrompt = `Summarize this audit in 2-3 paragraphs for an executive audience.
Target system: ${session.target_system}
Audit type: ${session.audit_type ?? 'general'}
Total findings: ${findings.length}
Screenshots: ${screenshots.length}
Findings:
${findingsSummary || '(No findings recorded)'}`;

    const summaryResult = await appkit.analytics.executeStatement(`
      SELECT ai_query(
        'databricks-claude-sonnet-4',
        '${JSON.stringify({ messages: [{ role: 'user', content: summaryPrompt }], max_tokens: 1024 }).replace(/'/g, "''")}'
      ) AS response
    `);
    const rows = summaryResult?.result?.data_array;
    if (rows && rows.length > 0 && rows[0][0]) {
      const parsed = JSON.parse(rows[0][0] as string);
      summary = parsed?.choices?.[0]?.message?.content ?? summary;
    }
  } catch (err) {
    console.error('[report] Summary generation failed:', err);
  }

  // 6. Build HTML report
  const html = buildHtmlReport(
    {
      sessionId,
      targetSystem: session.target_system,
      auditType: session.audit_type,
      userId: session.user_id,
      startedAt: session.started_at,
      completedAt: session.completed_at,
      findings,
      screenshots,
      extractions,
      reportType,
    },
    summary
  );

  // 7. Upload to UC Volume
  const reportId = uuid();
  const volumePath = `/Volumes/${process.env.DATABRICKS_VOLUME_FILES ?? 'catalog/schema/reports'}/${sessionId}/${reportId}.html`;
  const buffer = Buffer.from(html, 'utf-8');

  try {
    await appkit.files.upload(volumePath, buffer);
  } catch (err) {
    console.error('[report] Volume upload failed:', err);
    throw new Error('Failed to upload report to volume');
  }

  // 8. Record in UC audit_reports table
  const now = new Date().toISOString();
  try {
    await appkit.analytics.executeStatement(`
      INSERT INTO audit_reports (
        report_id, session_id, report_type, report_format,
        volume_path, generated_at, page_count, file_size_bytes, summary
      ) VALUES (
        '${reportId}', '${sessionId}', '${reportType}', 'html',
        '${volumePath}', '${now}', 1, ${buffer.length},
        '${summary.replace(/'/g, "''").substring(0, 2000)}'
      )
    `);
  } catch (err) {
    console.error('[report] UC report insert failed:', err);
  }

  // 9. Update session report_path
  try {
    await appkit.analytics.executeStatement(`
      UPDATE audit_sessions SET report_path = '${volumePath}' WHERE session_id = '${sessionId}'
    `);
  } catch {
    // Non-critical
  }

  return {
    reportId,
    volumePath,
    summary,
    pageCount: 1,
    fileSizeBytes: buffer.length,
  };
}
