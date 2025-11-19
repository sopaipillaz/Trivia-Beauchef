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

  // si ya terminó, NO renderizar QuestionCard
  if (i >= questions.length) {
    return (
      <main style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
        <h2>{trivia.curso} — {trivia.tema}</h2>
        <section style={{ marginTop: 16 }}>
          <h3>¡Listo!</h3>
          <p>Puntaje final: {Number.isFinite(score) ? score : 0}</p>
        </section>
      </main>
    );
  }

  const q = questions[i];

  return (
    <main style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <h2>{trivia.curso} — {trivia.tema}</h2>
      <p>Pregunta {i + 1} de {questions.length} · Puntaje: {score}</p>

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
