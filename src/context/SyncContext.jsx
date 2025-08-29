import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { db, firebaseEnabled } from '../config/firebase';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { outboxService } from '../services/api';

const SyncContext = createContext();

export const useSync = () => {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
};

export const SyncProvider = ({ children }) => {
  // Firestore-only mode disables sync
  const [status, setStatus] = useState('disabled');
  const [lastRun, setLastRun] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastError, setLastError] = useState(null);

  const value = useMemo(() => ({ status, lastRun, pendingCount, lastError }), [status, lastRun, pendingCount, lastError]);

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
};



