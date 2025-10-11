'use client';
import { onAuthStateChanged, signInAnonymously, User } from 'firebase/auth';
import { auth } from './firebase';
import { createContext, useContext, useEffect, useState } from 'react';

type Ctx = { user: User | null; loading: boolean; signInGuest: ()=>Promise<void>; };
const AuthCtx = createContext<Ctx>({ user: null, loading: true, signInGuest: async()=>{} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(()=> {
    const unsub = onAuthStateChanged(auth, (u)=> { setUser(u); setLoading(false); });
    return ()=>unsub();
  }, []);
  async function signInGuest() { await signInAnonymously(auth); }
  return <AuthCtx.Provider value={{ user, loading, signInGuest }}>{children}</AuthCtx.Provider>;
}
export function useAuth() { return useContext(AuthCtx); }
