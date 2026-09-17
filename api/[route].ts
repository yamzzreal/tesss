import type { VercelRequest, VercelResponse } from '@vercel/node';

import register from '../lib/routes/register';
import login from '../lib/routes/login';
import logout from '../lib/routes/logout';
import me from '../lib/routes/me';
import products from '../lib/routes/products';
import transactions from '../lib/routes/transactions';
import qrisSave from '../lib/routes/qris-save';
import paymentCreate from '../lib/routes/payment-create';
import paymentStatus from '../lib/routes/payment-status';
import adminLogin from '../lib/routes/admin-login';
import adminStats from '../lib/routes/admin-stats';
import setupDb from '../lib/routes/setup-db';
import docs from '../lib/routes/docs';

type Handler = (
  req: VercelRequest,
  res: VercelResponse
) => unknown | Promise<unknown>;

const routes: Record<string, Handler> = {
  register,
  login,
  logout,
  me,
  products,
  transactions,
  'qris-save': qrisSave,
  'payment-create': paymentCreate,
  'payment-status': paymentStatus,
  'admin-login': adminLogin,
  'admin-stats': adminStats,
  'setup-db': setupDb,
  docs
};

function setupCors(req: VercelRequest, res: VercelResponse) {
  const origin = String(req.headers.origin || '');

  const allowedOrigins = [
    'http://localhost',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://localhost:8000',

    'http://127.0.0.1',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:8000',

    'https://tesss-lbbv-eight.vercel.app'
  ];

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Vary', 'Origin');

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  );

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type,X-API-Key,Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}

function getRoute(req: VercelRequest): string {
  const route = req.query?.route;

  if (Array.isArray(route)) {
    return String(route[0] || '')
      .replace(/^\/+|\/+$/g, '')
      .toLowerCase();
  }

  return String(route || '')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (setupCors(req, res)) return;

  const route = getRoute(req);

  if (!route) {
    return res.status(404).json({
      success: false,
      error: 'API route not found',
      available: Object.keys(routes)
    });
  }

  const target = routes[route];

  if (!target) {
    return res.status(404).json({
      success: false,
      error: 'API route not found',
      route,
      available: Object.keys(routes)
    });
  }

  try {
    return await target(req, res);
  } catch (error) {
    console.error(`[API ERROR] ${route}`, error);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Internal server error'
      });
    }
  }
}
