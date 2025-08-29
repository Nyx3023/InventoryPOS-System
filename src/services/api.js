import { db } from '../config/firebase';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';

export const productService = {
  getAll: async () => {
    const snap = await getDocs(collection(db, 'products'));
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Ensure expected fields exist
    return products.map(p => ({
      id: p.id,
      name: p.name || '',
      description: p.description || '',
      category_name: p.category_name || p.category || '',
      price: Number(p.price || 0),
      costPrice: Number(p.costPrice || p.cost_price || 0),
      quantity: Number(p.quantity || 0),
      lowStockThreshold: Number(p.lowStockThreshold || p.low_stock_threshold || 10),
      barcode: p.barcode || '',
      imageUrl: p.imageUrl || p.image_url || ''
    }));
  },

  getById: async (id) => {
    const ref = doc(db, 'products', id);
    const d = await getDoc(ref);
    if (!d.exists()) throw new Error('Product not found');
    const p = { id: d.id, ...d.data() };
    return {
      id: p.id,
      name: p.name || '',
      description: p.description || '',
      category_name: p.category_name || p.category || '',
      price: Number(p.price || 0),
      costPrice: Number(p.costPrice || p.cost_price || 0),
      quantity: Number(p.quantity || 0),
      lowStockThreshold: Number(p.lowStockThreshold || p.low_stock_threshold || 10),
      barcode: p.barcode || '',
      imageUrl: p.imageUrl || p.image_url || ''
    };
  },

  create: async (product) => {
    // Map category -> category_name to keep UI expectations
    const payload = {
      ...product,
      category_name: product.category_name || product.category || ''
    };
    const ref = await addDoc(collection(db, 'products'), payload);
    return { id: ref.id, ...payload };
  },

  update: async (id, product) => {
    const ref = doc(db, 'products', id);
    const payload = {
      ...product,
      category_name: product.category_name || product.category || ''
    };
    await updateDoc(ref, payload);
    return { id, ...payload };
  },

  delete: async (id) => {
    const ref = doc(db, 'products', id);
    await deleteDoc(ref);
    return { success: true };
  }
};

export const transactionService = {
  getAll: async () => {
    const snap = await getDocs(collection(db, 'transactions'));
    const txns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort by timestamp desc if present
    txns.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    return txns;
  },

  getById: async (id) => {
    const ref = doc(db, 'transactions', id);
    const d = await getDoc(ref);
    if (!d.exists()) throw new Error('Transaction not found');
    return { id: d.id, ...d.data() };
  },

  create: async (transaction) => {
    // Use provided id for consistency with UI
    const ref = doc(db, 'transactions', transaction.id);
    await setDoc(ref, transaction);
    return { ...transaction };
  },

  getByDateRange: async (startDate, endDate) => {
    // If timestamp is stored as ISO string, where filters can compare lexicographically if same format
    const q1 = query(collection(db, 'transactions'), where('timestamp', '>=', startDate));
    const q2 = query(q1, where('timestamp', '<=', endDate));
    const snap = await getDocs(q2);
    const txns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    txns.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
    return txns;
  },

  delete: async (id, _userRole) => {
    const ref = doc(db, 'transactions', id);
    await deleteDoc(ref);
    return { success: true };
  }
};

export const auditService = {
  // Keep as-is (no-op) for now; audits not used in core flows
  create: async (_audit) => {
    throw new Error('Audit create via Firestore not implemented');
  },
  getAll: async () => {
    throw new Error('Audit list via Firestore not implemented');
  }
};

export const outboxService = {
  // Outbox is not needed in Firestore-only mode. Keep placeholders to avoid breaking imports.
  list: async () => [],
  updateStatus: async () => ({ success: true })
};

export const categoryService = {
  getAll: async () => {
    const snap = await getDocs(collection(db, 'categories'));
    // Docs use id=name in migration
    return snap.docs.map(d => {
      const data = d.data() || {};
      return { name: data.name || d.id, description: data.description || '' };
    });
  },
  create: async (name, description) => {
    await setDoc(doc(db, 'categories', name), { name, description: description || '' });
    return { name, description: description || '' };
  },
  delete: async (name) => {
    await deleteDoc(doc(db, 'categories', name));
    return { success: true };
  }
};