import type { VercelRequest, VercelResponse } from '@vercel/node';
import register from './register';
import payment-create from './payment-create';
import payment-status from './payment-status';
import setup-db from './setup-db';
import login from './login';
import docs from './docs';
import products from './products';
import logout from './logout';
import transactions from './transactions';
import admin-stats from './admin-stats';
import admin-login from './admin-login';
import qris-save from './qris-save';
import me from './me';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const route = String(req.query.route || '').replace(/^\/+|\/+$/g, '');
  switch (route) {
    case 'register': return register(req, res);
    case 'payment-create': return payment-create(req, res);
    case 'payment-status': return payment-status(req, res);
    case 'setup-db': return setup-db(req, res);
    case 'login': return login(req, res);
    case 'docs': return docs(req, res);
    case 'products': return products(req, res);
    case 'logout': return logout(req, res);
    case 'transactions': return transactions(req, res);
    case 'admin-stats': return admin-stats(req, res);
    case 'admin-login': return admin-login(req, res);
    case 'qris-save': return qris-save(req, res);
    case 'me': return me(req, res);
    default:
      return res.status(404).json({ success: false, error: 'API route tidak ditemukan' });
  }
}
