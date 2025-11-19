'use client';
import Link from 'next/link';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/AuthProvider';

export default function Page() {
  const [trivias, setTrivias] = useState<any[]>([]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const { user } = useAuth();

  useEffect(()=>{
    async function load() {
      const q = query(collection(db, 'trivias'), orderBy('curso'));
      const snap = await getDocs(q);
      const list = snap.docs.map(d=> ({ id: d.id, ...d.data() }));
      setTrivias(list);
      setOpenGroups((prev) => {
        const next: Record<string, boolean> = {};
        list.forEach((t: any) => {
          const curso = t.curso || 'Sin curso';
          next[curso] = prev[curso] ?? true;
        });
        return next;
      });
    }
    load();
  },[]);

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    trivias.forEach((t) => {
      const curso = t.curso || 'Sin curso';
      if (!map[curso]) map[curso] = [];
      map[curso].push(t);
    });
    Object.keys(map).forEach((curso) => {
      map[curso] = [...map[curso]].sort((a, b) =>
        String(a.tema || '').localeCompare(String(b.tema || ''), 'es', { sensitivity: 'base' })
      );
    });
    return map;
  }, [trivias]);

  function toggleGroup(curso: string) {
    setOpenGroups((prev) => ({ ...prev, [curso]: !prev[curso] }));
  }

  return (
    <main>
      <p>Bienvenido{user ? `, ${user.isAnonymous ? 'Invitado' : user.email}` : ''}. Elige una trivia para jugar.</p>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>
        {Object.entries(grouped).map(([curso, list]) => (
          <li key={curso} style={{ background: '#0f172a', borderRadius: 12, padding: 12 }}>
            <button
              onClick={() => toggleGroup(curso)}
              style={{
                width: '100%',
                background: 'transparent',
                color: '#f9fafb',
                border: 'none',
                textAlign: 'left',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 18,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <span>{curso}</span>
              <span style={{ fontSize: 14, opacity: 0.8 }}>{openGroups[curso] ? '▼' : '►'}</span>
            </button>
            {openGroups[curso] && (
              <ul style={{ listStyle: 'none', padding: 0, marginTop: 12, display: 'grid', gap: 8 }}>
                {(list as any[]).map((t: any) => (
                  <li key={t.id} style={{ background: '#151923', padding: '16px', borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 600 }}>{t.tema}</div>
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
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
