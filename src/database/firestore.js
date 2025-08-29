import { db } from '../config/firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';

// Collection names
const COLLECTIONS = {
  USERS: 'users',
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  TRANSACTIONS: 'transactions',
  INVENTORY_MOVEMENTS: 'inventory_movements'
};

// Helper functions for users
export const userOperations = {
  create: async (userData) => {
    const userRef = await addDoc(collection(db, COLLECTIONS.USERS), {
      ...userData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return userRef.id;
  },

  update: async (userId, userData) => {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    await updateDoc(userRef, {
      ...userData,
      updatedAt: serverTimestamp()
    });
  },

  delete: async (userId) => {
    await deleteDoc(doc(db, COLLECTIONS.USERS, userId));
  },

  getById: async (userId) => {
    const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, userId));
    return userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null;
  }
};

// Helper functions for products
export const productOperations = {
  create: async (productData) => {
    const productRef = await addDoc(collection(db, COLLECTIONS.PRODUCTS), {
      ...productData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return productRef.id;
  },

  update: async (productId, productData) => {
    const productRef = doc(db, COLLECTIONS.PRODUCTS, productId);
    await updateDoc(productRef, {
      ...productData,
      updatedAt: serverTimestamp()
    });
  },

  delete: async (productId) => {
    await deleteDoc(doc(db, COLLECTIONS.PRODUCTS, productId));
  },

  getById: async (productId) => {
    const productDoc = await getDoc(doc(db, COLLECTIONS.PRODUCTS, productId));
    return productDoc.exists() ? { id: productDoc.id, ...productDoc.data() } : null;
  },

  getByCategory: async (categoryId) => {
    const q = query(
      collection(db, COLLECTIONS.PRODUCTS),
      where('categoryId', '==', categoryId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  getLowStock: async (threshold) => {
    const q = query(
      collection(db, COLLECTIONS.PRODUCTS),
      where('quantity', '<=', threshold)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
};

// Helper functions for transactions
export const transactionOperations = {
  create: async (transactionData) => {
    const transactionRef = await addDoc(collection(db, COLLECTIONS.TRANSACTIONS), {
      ...transactionData,
      createdAt: serverTimestamp(),
      items: transactionData.items.map(item => ({
        ...item,
        createdAt: serverTimestamp()
      }))
    });
    return transactionRef.id;
  },

  update: async (transactionId, transactionData) => {
    const transactionRef = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);
    await updateDoc(transactionRef, {
      ...transactionData,
      updatedAt: serverTimestamp()
    });
  },

  getById: async (transactionId) => {
    const transactionDoc = await getDoc(doc(db, COLLECTIONS.TRANSACTIONS, transactionId));
    return transactionDoc.exists() ? { id: transactionDoc.id, ...transactionDoc.data() } : null;
  },

  getByDateRange: async (startDate, endDate) => {
    const q = query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where('createdAt', '>=', startDate),
      where('createdAt', '<=', endDate)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
};

// Helper functions for inventory movements
export const inventoryOperations = {
  create: async (movementData) => {
    const movementRef = await addDoc(collection(db, COLLECTIONS.INVENTORY_MOVEMENTS), {
      ...movementData,
      createdAt: serverTimestamp()
    });
    return movementRef.id;
  },

  getByProduct: async (productId) => {
    const q = query(
      collection(db, COLLECTIONS.INVENTORY_MOVEMENTS),
      where('productId', '==', productId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
};

// Helper functions for categories
export const categoryOperations = {
  create: async (categoryData) => {
    const categoryRef = await addDoc(collection(db, COLLECTIONS.CATEGORIES), {
      ...categoryData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return categoryRef.id;
  },

  update: async (categoryId, categoryData) => {
    const categoryRef = doc(db, COLLECTIONS.CATEGORIES, categoryId);
    await updateDoc(categoryRef, {
      ...categoryData,
      updatedAt: serverTimestamp()
    });
  },

  delete: async (categoryId) => {
    await deleteDoc(doc(db, COLLECTIONS.CATEGORIES, categoryId));
  },

  getAll: async () => {
    const querySnapshot = await getDocs(collection(db, COLLECTIONS.CATEGORIES));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
}; 