'use client';
import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function RankingPage({ params }: { params: { id: string }}) {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const q = query(
        collection(db, 'partidas'),
        where('trivia_id', '==', params.id),
        orderBy('puntaje', 'desc')
      );
      const snap = await getDocs(q);
      setRows(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    load();
  }, [params.id]);

  return (
    <main>
      <h2>Ranking</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr><th style={{ textAlign: 'left' }}>#</th><th>Puntaje</th><th>Fecha</th></tr>
        </thead>
        <tbody>
          {rows.map((r: any, idx: number) => {
            const ts = (r.created_at?.toDate ? r.created_at.toDate() : (r.created_at ? new Date(r.created_at) : null));
            const dateStr = ts ? ts.toLocaleString() : '-';
            return (
              <tr key={r.id} style={{ borderTop: '1px solid #2a2f3a' }}>
                <td>{idx + 1}</td>
                <td>{r.puntaje}</td>
                <td>{dateStr}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}

