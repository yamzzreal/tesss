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

type Handler = (req: VercelRequest, res: VercelResponse) => unknown;
const routes: Record<string, Handler> = {
  register, login, logout, me, products, transactions,
  'qris-save': qrisSave, 'payment-create': paymentCreate,
  'payment-status': paymentStatus, 'admin-login': adminLogin,
  'admin-stats': adminStats, 'setup-db': setupDb, docs,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.query.route;
  const fromQuery = Array.isArray(raw) ? raw[0] : raw;
  const pathname = String(req.url || '').split('?')[0].replace(/^\/api\//, '').replace(/^\/+|\/+$/g, '');
  const route = String(fromQuery || pathname || '').toLowerCase();
  const target = routes[route];
  if (!target) {
    res.status(404).json({ success: false, error: 'API route not found', available: Object.keys(routes) });
    return;
  }
  return target(req, res);
}
