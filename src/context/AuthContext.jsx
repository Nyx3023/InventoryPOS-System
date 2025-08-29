import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../config/firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Lookup role/profile by email in Firestore users collection
          const email = firebaseUser.email || '';
          let profile = null;
          try {
            const q = query(collection(db, 'users'), where('email', '==', email));
            const snap = await getDocs(q);
            if (!snap.empty) {
              const d = snap.docs[0];
              const data = d.data() || {};
              profile = { id: d.id, email: data.email || email, name: data.name || firebaseUser.displayName || email, role: data.role || 'employee' };
            }
          } catch (e) {
            console.warn('Failed to fetch user profile from Firestore:', e);
          }

          const composedUser = profile || {
            id: firebaseUser.uid,
            email,
            name: firebaseUser.displayName || email,
            role: 'employee'
          };
          setUser(composedUser);
          // Persist to storage for refresh handling
          localStorage.setItem('user', JSON.stringify(composedUser));
        } else {
          setUser(null);
          localStorage.removeItem('user');
          sessionStorage.removeItem('user');
        }
      } finally {
        setIsLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Legacy setter for compatibility
  const login = (userData) => {
    setUser(userData);
  };

  const loginWithEmailAndPassword = async (email, password, rememberMe) => {
    const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistence);
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
  };

  const value = {
    user,
    login,
    loginWithEmailAndPassword,
    logout,
    isAuthenticated: !!user,
    isLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 