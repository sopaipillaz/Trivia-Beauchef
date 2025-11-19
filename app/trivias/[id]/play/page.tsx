'use client';
import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { useAuth } from '@/lib/AuthProvider';
import QuestionCard from '@/components/QuestionCard';
import MathText from '@/components/MathText';
import { scoreQuestion } from '@/utils/scoring';

type Trivia = {
  curso: string;
  tema: string;
  num_preguntas: number;
  tiempo_seg_por_preg: number;
};

type AdvanceState = { nextIndex: number; scoreAfter: number };

export default function PlayPage({ params }: { params: { id: string } }) {
  const slug = decodeURIComponent(params.id); // ej: cálculo-i-derivadas-básicas
  const { user, loading: authLoading, signInGuest } = useAuth();

  const [trivia, setTrivia] = useState<Trivia | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');
  const [pendingAdvance, setPendingAdvance] = useState<AdvanceState | null>(null);
  const [pauseInfo, setPauseInfo] = useState<{ explanation: string; correct: string } | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [ready, setReady] = useState(false);

  // 1) Asegura sesión (invitado)
  useEffect(() => {
    (async () => {
      try {
        if (!authLoading && !user) {
          await signInGuest();
          console.log('[play] signed in as guest');
        }
      } catch (e: any) {
        console.error('[play] auth error', e);
        setErr(`Auth error: ${e?.message || e}`);
      }
    })();
  }, [authLoading, user, signInGuest]);

  // 2) Carga trivia + preguntas
  useEffect(() => {
    (async () => {
      try {
        if (authLoading) return;
        if (!user) return;

        setLoading(true);
        setErr('');

        const triviaRef = doc(db, 'trivias', slug);
        const snap = await getDoc(triviaRef);

        if (!snap.exists()) {
          setErr('No se encontró esta trivia. Crea una en /admin.');
          setLoading(false);
          return;
        }

        const t = snap.data() as Trivia;
        setTrivia(t);

        const qRef = query(
          collection(db, 'preguntas'),
          where('curso', '==', t.curso),
          where('tema', '==', t.tema),
          limit(Number(t.num_preguntas || 10))
        );

        const qsnap = await getDocs(qRef);
        const arr: any[] = [];
        qsnap.forEach((d) => arr.push({ id: d.id, ...d.data() }));

        setQuestions(arr);
        setLoading(false);
      } catch (e: any) {
        console.error('[play] load error', e);
        setErr(`Error cargando datos: ${e?.message || e}`);
        setLoading(false);
      }
    })();
  }, [authLoading, user, slug]);

  // 3) Manejo de respuesta y avance
  async function handleAnswer(letter: 'A' | 'B' | 'C' | 'D') {
    try {
      const q = questions[i];
      const correct = (q.correcta || 'A').toUpperCase();

      const raw = scoreQuestion({ correct, chosen: letter, timeLeft: 0 });
      const gained = Number(raw);
      const safeGained = Number.isFinite(gained) ? gained : 0;

      const nextIndex = i + 1;

      await addDoc(collection(db, 'respuestas'), {
        trivia_id: slug,
        pregunta_id: q.id,
        correcta: correct,
        elegida: letter,
        created_at: serverTimestamp(),
        usuario_id: user?.uid || null,
      });

      const nextScoreVal = score + safeGained;
      setScore(nextScoreVal);

      const advanceState: AdvanceState = { nextIndex, scoreAfter: nextScoreVal };
      setPendingAdvance(advanceState);

      if (correct !== letter) {
        const explanation = (q.explicacion || '').trim() || `Respuesta correcta: ${correct}`;
        setPauseInfo({ explanation, correct });
        return;
      }

      await advanceToNext(advanceState);
    } catch (e) {
      console.error('[play] save error', e);
    }
  }

  async function advanceToNext(advance?: AdvanceState) {
    const data = advance || pendingAdvance;
    if (!data) return;
    setAdvancing(true);
    setPendingAdvance(null);
    setPauseInfo(null);
    setI(data.nextIndex);
    try {
      if (data.nextIndex >= questions.length) {
        await addDoc(collection(db, 'partidas'), {
          trivia_id: slug,
          puntaje: data.scoreAfter,
          total: questions.length,
          created_at: serverTimestamp(),
          usuario_id: user?.uid || null,
        });
      }
    } catch (e) {
      console.error('[play] partida save error', e);
    } finally {
      setAdvancing(false);
    }
  }

  // ===================== UI =====================

  if (authLoading || loading) {
    return <main style={{ padding: 24 }}><h2>Cargando…</h2></main>;
  }

  if (err) {
    return (
      <main style={{ padding: 24 }}>
        <h2>Jugar</h2>
        <p style={{ color: 'salmon' }}>{err}</p>
        <p>Consejos:</p>
        <ul>
          <li>En <b>/admin</b> crea la trivia y sube preguntas.</li>
          <li>Asegúrate de que <b>curso</b> y <b>tema</b> coincidan exactamente.</li>
        </ul>
      </main>
    );
  }

  if (!trivia) {
    return <main style={{ padding: 24 }}><p>No se pudo cargar la trivia.</p></main>;
  }

  if (questions.length === 0) {
    return (
      <main style={{ padding: 24 }}>
        <h2>{trivia.curso} — {trivia.tema}</h2>
        <p>No hay preguntas para esta trivia. Sube preguntas en <b>/admin</b>.</p>
      </main>
    );
  }

  const totalQuestions = questions.length;

  if (!ready) {
    return (
      <main style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
        <h2>{trivia.curso} — {trivia.tema}</h2>
        <section style={{ marginTop: 16, background: '#0f172a', padding: 20, borderRadius: 14 }}>
          <h3 style={{ marginTop: 0 }}>Antes de comenzar</h3>
          <p>Contestarás {totalQuestions || trivia.num_preguntas} preguntas. Tiempo límite sugerido: {trivia.tiempo_seg_por_preg}s por pregunta.</p>
          <ul>
            <li>Botones grandes y accesibles para jugar desde tu móvil.</li>
            <li>Recibirás feedback inmediato y pautas cuando te equivoques.</li>
            <li>Puedes pausar entre preguntas si necesitas respirar.</li>
          </ul>
          <button
            onClick={() => setReady(true)}
            style={{ marginTop: 12, padding: '12px 20px', borderRadius: 999, border: 'none', background: '#22d3ee', color: '#031223', fontWeight: 700, cursor: 'pointer' }}
          >
            ¡Comienza cuando estés listo!
          </button>
        </section>
      </main>
    );
  }

  // si ya terminó, NO renderizar QuestionCard
  if (i >= totalQuestions) {
    const ratio = totalQuestions ? score / totalQuestions : 0;
    const percentilla = Math.min(99, Math.max(12, Math.round(ratio * 80 + 10)));
    const shareText = encodeURIComponent(`Acabo de jugar ${trivia.curso} — ${trivia.tema} en Trivia Beauchef y obtuve ${score} puntos. ¿Me superas?`);
    const shareUrl = encodeURIComponent(`https://triviabeauchef.cl/trivias/${slug}/play`);
    return (
      <main style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
        <h2>{trivia.curso} — {trivia.tema}</h2>
        <section style={{ marginTop: 16 }}>
          <h3>Resultado</h3>
          <p style={{ fontSize: 24, fontWeight: 700 }}>Puntaje final: {Number.isFinite(score) ? score : 0}</p>
          <p style={{ fontSize: 18, color: '#93c5fd' }}>Mejor que aproximadamente el {percentilla}% de estudiantes.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: 'Trivia Beauchef', text: `Mi resultado: ${score} pts`, url: `/trivias/${slug}/play` }).catch(()=>{});
                } else {
                  window.open(`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`, '_blank');
                }
              }}
              style={{ background: '#0ea5e9', color: '#031223', border: 'none', borderRadius: 999, padding: '12px 20px', fontWeight: 700 }}
            >
              Compartir en redes
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{ background: '#34d399', color: '#031223', border: 'none', borderRadius: 999, padding: '12px 20px', fontWeight: 700 }}
            >
              Reintentar quiz
            </button>
          </div>
        </section>
      </main>
    );
  }

  const q = questions[i];

  return (
    <main style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <h2>{trivia.curso} — {trivia.tema}</h2>
      <p>Pregunta {i + 1} de {totalQuestions} · Puntaje: {score}</p>

      <QuestionCard
        question={q}
        onAnswer={handleAnswer}
        timeLimitSec={trivia.tiempo_seg_por_preg}
      />

      {pauseInfo && (
        <section style={{ marginTop: 16, background: '#1f2937', padding: 16, borderRadius: 12 }}>
          <h4 style={{ marginTop: 0 }}>Revisa la pauta</h4>
          <p style={{ color: '#a7f3d0' }}>
            <MathText text={pauseInfo.explanation} />
          </p>
          <p style={{ opacity: 0.8 }}>Presiona continuar cuando quieras pasar a la siguiente pregunta.</p>
          <button
            onClick={() => advanceToNext()}
            disabled={advancing}
            style={{
              marginTop: 8,
              background: '#2563eb',
              color: '#fff',
              padding: '10px 16px',
              borderRadius: 8,
              cursor: advancing ? 'not-allowed' : 'pointer'
            }}
          >
            {advancing ? 'Guardando...' : 'Siguiente pregunta'}
          </button>
        </section>
      )}
    </main>
  );
}
