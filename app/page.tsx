'use client';
import Link from 'next/link';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthProvider';

export default function Page() {
  const [trivias, setTrivias] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(()=>{
    async function load() {
      const q = query(collection(db, 'trivias'), orderBy('curso'));
      const snap = await getDocs(q);
      setTrivias(snap.docs.map(d=> ({ id: d.id, ...d.data() })));
    }
    load();
  },[]);

  return (
    <main>
      <p>Bienvenido{user ? `, ${user.isAnonymous ? 'Invitado' : user.email}` : ''}. Elige una trivia para jugar.</p>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {trivias.map((t: any) => (
          <li key={t.id} style={{ background: '#151923', margin: '12px 0', padding: '16px', borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{t.curso} — {t.tema}</div>
                <div style={{ opacity: 0.8, fontSize: 14 }}>{t.num_preguntas} preguntas · {t.tiempo_seg_por_preg}s</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Link href={`/trivias/${t.id}/play`} style={{ background: '#2563eb', color: 'white', padding: '8px 12px', borderRadius: 8, textDecoration: 'none' }}>Jugar</Link>
                <Link href={`/ranking/${t.id}`} style={{ background: '#374151', color: 'white', padding: '8px 12px', borderRadius: 8, textDecoration: 'none' }}>Ranking</Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
