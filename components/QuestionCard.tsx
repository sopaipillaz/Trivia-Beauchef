'use client';
import React, { useEffect, useState } from 'react';
import MathText from './MathText';

type Props = {
  question: any | null;
  onAnswer: (opt: 'A'|'B'|'C'|'D') => void;
  timeLimitSec: number;
};

export default function QuestionCard({ question, onAnswer, timeLimitSec }: Props) {
  const [remaining, setRemaining] = useState<number>(timeLimitSec || 20);
  const [selected, setSelected] = useState<'A'|'B'|'C'|'D'|null>(null);

  // Si no hay pregunta, no renderizamos nada
  if (!question) return null;

  // Reinicia timer cada vez que cambia la pregunta
  useEffect(() => {
    setRemaining(timeLimitSec || 20);
    setSelected(null);
  }, [question?.id, timeLimitSec]);

  useEffect(() => {
    if (selected) return;
    const timer = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [question?.id, timeLimitSec, selected]);

  function choose(opt: 'A'|'B'|'C'|'D') {
    if (selected) return; // ya respondido
    setSelected(opt);
    onAnswer(opt);
  }

  const opciones = question?.opciones || { A:'', B:'', C:'', D:'' };

  return (
    <section style={{ background:'#111827', padding:16, borderRadius:12 }}>
      <h3 style={{ marginTop:0 }}>
        <MathText text={question.enunciado || ''} />
      </h3>

      <ul style={{ listStyle:'none', padding:0, display:'grid', gap:8 }}>
        {(['A','B','C','D'] as const).map((k) => (
          <li key={k}>
            <button
              onClick={() => choose(k)}
              disabled={!!selected}
              style={{
                width:'100%', textAlign:'left', padding:'10px 12px',
                borderRadius:10, border:'1px solid #374151',
                background: selected===k ? '#2563eb' : '#1f2937',
                color: 'white', cursor: selected ? 'default' : 'pointer'
              }}
            >
              <b>{k}.</b> <MathText text={opciones[k] || ''} />
            </button>
          </li>
        ))}
      </ul>

      <div style={{ marginTop:8, opacity:0.8 }}>⏱️ {remaining}s</div>
      {selected && question.explicacion && (
        <p style={{ marginTop:12, color:'#a7f3d0' }}>
          <MathText text={question.explicacion} />
        </p>
      )}
    </section>
  );
}
