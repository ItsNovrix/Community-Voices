import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort, reddit, redis, settings } from '@devvit/web/server';
import type { OnPostCreateRequest, OnAppInstallRequest, OnAppUpgradeRequest } from '@devvit/web/shared';

// --- IMPORT TRIGGERS ---
import { handleAppInstall } from './triggers/install.js';
import { handleAppUpgrade } from './triggers/upgrade.js';
import { handlePostSubmit } from './triggers/post.js';
import { handleCommentCreate } from './triggers/comment.js';

// --- IMPORT SCHEDULER ---
import { handleUpgradeCheckJob } from './scheduler/upgradeJob.js';

const app = new Hono();

// ==========================================
// ROUTES
// ==========================================

// Triggers
app.post('/internal/triggers/on-app-install', handleAppInstall);
app.post('/internal/triggers/on-app-upgrade', handleAppUpgrade);
app.post('/internal/triggers/on-post-submit', handlePostSubmit);
app.post('/internal/triggers/on-comment-create', handleCommentCreate);

// Scheduler
app.post('/internal/scheduler/upgrade-notifier-job', handleUpgradeCheckJob);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});