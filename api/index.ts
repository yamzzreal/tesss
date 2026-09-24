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
import dashboard from '../lib/routes/dashboard';
import apiKeyRegenerate from '../lib/routes/api-key-regenerate';
import account from '../lib/routes/account';
import appStatus from '../lib/routes/app-status';
import invoiceDetail from '../lib/routes/invoice-detail';
import publicPaymentStatus from '../lib/routes/public-payment-status';
import financeReport from '../lib/routes/finance-report';
import integrations from '../lib/routes/integrations';
import markPaid from '../lib/routes/mark-paid';
import cancel from '../lib/routes/cancel';

type Handler = (req: VercelRequest, res: VercelResponse) => unknown;

const routes: Record<string, Handler> = {
  register, login, logout, me, products, transactions,
  'qris-save': qrisSave, 'payment-create': paymentCreate,
  'payment-status': paymentStatus, 'admin-login': adminLogin,
  'admin-stats': adminStats, 'setup-db': setupDb, docs,
  dashboard, 'api-key-regenerate': apiKeyRegenerate, account,
  'app-status': appStatus, 'invoice-detail': invoiceDetail,
  'public-payment-status': publicPaymentStatus, 'finance-report': financeReport, integrations, 'mark-paid': markPaid, cancel,
};

function getRoute(req: VercelRequest): string {
  const q = req.query?.route;
  if (Array.isArray(q) && q.length) return String(q[0]).replace(/^\/+|\/+$/g, '').toLowerCase();
  if (typeof q === 'string' && q) return q.replace(/^\/+|\/+$/g, '').toLowerCase();
  return '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS: merchant websites may call the API from localhost or another domain.
  const origin = String(req.headers.origin || '');
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const route = getRoute(req);
  if (!route) {
    res.status(404).json({ success: false, error: 'API route not found', available: Object.keys(routes) });
    return;
  }
  const target = routes[route];
  if (!target) {
    res.status(404).json({ success: false, error: 'API route not found', route, available: Object.keys(routes) });
    return;
  }
  try {
    return await target(req, res);
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ success: false, error: e instanceof Error ? e.message : 'Internal server error' });
  }
}
