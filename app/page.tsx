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
      <section style={{ background: 'linear-gradient(135deg, #0ea5e9, #22d3ee)', color: '#031223', borderRadius: 18, padding: '32px 28px', marginBottom: 32 }}>
        <h1 style={{ margin: '0 0 12px', fontSize: 36, lineHeight: 1.1 }}>Trivia Beauchef</h1>
        <p style={{ margin: '0 0 20px', fontSize: 18 }}>Pon a prueba tus conocimientos de ingeniería, compite con tus compañeros y mejora cada día.</p>
        <button
          onClick={() => {
            const first = trivias[0];
            if (first) window.location.href = `/trivias/${first.id}/play`;
          }}
          style={{
            fontSize: 18,
            padding: '14px 28px',
            borderRadius: 999,
            border: 'none',
            background: '#031223',
            color: '#e0f2fe',
            cursor: 'pointer',
          }}
        >
          Comenzar trivia
        </button>
      </section>

      <section aria-label="Introducción" style={{ marginBottom: 24 }}>
        <p style={{ margin: '0 0 8px', fontSize: 16 }}>
          Bienvenido{user ? `, ${user.isAnonymous ? 'Invitado' : user.email}` : ''}. Desde tu móvil o computador podrás responder sesiones personalizadas, seguir tu progreso y retar a tus amigos.
        </p>
        <p style={{ margin: 0, fontSize: 16, color: '#93c5fd' }}>
          Contestarás 10 preguntas por sesión, con límite sugerido según la trivia elegida. ¡Comienza cuando estés listo!
        </p>
      </section>

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

      <section id="como-funciona" style={{ marginTop: 40, background: '#0f172a', padding: 24, borderRadius: 16 }}>
        <h2 style={{ marginTop: 0 }}>Cómo funciona</h2>
        <ol style={{ paddingLeft: 20, lineHeight: 1.7 }}>
          <li>Elige una trivia recomendada para tu curso.</li>
          <li>Recibe preguntas adaptadas y revisa tu puntaje final.</li>
          <li>Comparte tu resultado y sube en el ranking global.</li>
        </ol>
        <p style={{ margin: '12px 0 0' }}>Creado por estudiantes de Beauchef para entrenar competencias clave de los primeros años de ingeniería.</p>
      </section>

      <section style={{ marginTop: 24, padding: 24, borderRadius: 16, border: '1px solid #1f2937', background: '#0b1220' }}>
        <h3 style={{ marginTop: 0 }}>Acerca de Trivia Beauchef</h3>
        <p style={{ marginBottom: 8 }}>Este proyecto busca que los mechones repasen conceptos esenciales de cálculo y álgebra en un ambiente competitivo y entretenido.</p>
        <p style={{ marginBottom: 0 }}>¿Sugerencias? Escríbenos a <a href="mailto:contacto@triviabeauchef.cl" style={{ color: '#38bdf8' }}>contacto@triviabeauchef.cl</a>.</p>
      </section>
    </main>
  );
}
