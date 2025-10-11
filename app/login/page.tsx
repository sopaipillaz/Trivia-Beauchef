'use client';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthProvider';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string|null>(null);
  const router = useRouter();
  const { signInGuest } = useAuth();

  async function onSubmit(e: any) {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <main>
      <h2>Iniciar sesión</h2>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button type="submit" style={{ background: '#2563eb', color: 'white', padding: '8px 12px', borderRadius: 8 }}>Entrar</button>
      </form>
      {error && <p style={{ color: 'salmon' }}>{error}</p>}
      <div style={{ marginTop: 12 }}>
        <button onClick={signInGuest} style={{ background: '#374151', color: 'white', padding: '8px 12px', borderRadius: 8 }}>Entrar como invitado</button>
      </div>
    </main>
  );
}
