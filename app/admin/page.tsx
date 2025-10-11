'use client';
import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { addDoc, collection, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthProvider';

type PreguntaRow = {
  curso: string; tema: string; enunciado: string;
  opcion_a?: string; opcion_b?: string; opcion_c?: string; opcion_d?: string;
  correcta: 'A'|'B'|'C'|'D'; explicacion?: string; dificultad?: string;
};

type TriviaRow = {
  curso: string; tema: string; num_preguntas: string | number; tiempo_seg_por_preg: string | number;
};

export default function AdminPage() {
  const { user, loading, signInGuest } = useAuth();
  const [pasted, setPasted] = useState('');
  const [pastedTrivias, setPastedTrivias] = useState('');
  const [status, setStatus] = useState<string>('');
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    (async () => {
      // si no hay usuario y ya terminó de cargar, entra como invitado
      if (!loading && !user) {
        try { await signInGuest(); }
        catch (e: any) { setErr(`Auth error: ${e?.message || e}`); }
      }
    })();
  }, [user, loading, signInGuest]);

  async function parseAndUploadQuestions(text: string) {
    setErr(''); setStatus('Subiendo preguntas...');
    try {
      if (!user) throw new Error('No hay sesión. Inicia como invitado o login.');
      const { data } = Papa.parse(text.trim(), { header: true, skipEmptyLines: true });
      let ok = 0;
      for (const row of data as any[]) {
        const r = row as PreguntaRow;
        const payload = {
          curso: r.curso?.trim(), tema: r.tema?.trim(), enunciado: r.enunciado?.trim(),
          opciones: { A: r.opcion_a || '', B: r.opcion_b || '', C: r.opcion_c || '', D: r.opcion_d || '' },
          correcta: (r.correcta || 'A').toUpperCase(),
          explicacion: r.explicacion || '',
          dificultad: r.dificultad || 'Fácil',
          created_at: serverTimestamp(),
          created_by: user.uid,
        };
        await addDoc(collection(db, 'preguntas'), payload);
        ok++;
      }
      setStatus(`✔️ Subidas ${ok} preguntas.`);
    } catch (e: any) {
      setErr(`Error al subir preguntas: ${e?.message || e}`);
    }
  }

  async function parseAndUploadTrivias(text: string) {
    setErr(''); setStatus('Subiendo trivias...');
    try {
      if (!user) throw new Error('No hay sesión. Inicia como invitado o login.');
      const { data } = Papa.parse(text.trim(), { header: true, skipEmptyLines: true });
      let ok = 0;
      for (const row of data as any[]) {
        const r = row as TriviaRow;
        const payload = {
          curso: String(r.curso || '').trim(),
          tema: String(r.tema || '').trim(),
          num_preguntas: Number(r.num_preguntas || 5),
          tiempo_seg_por_preg: Number(r.tiempo_seg_por_preg || 25),
          created_at: serverTimestamp(),
          created_by: user.uid,
        };
        const id = `${payload.curso.toLowerCase().replace(/\s+/g,'-')}-${payload.tema.toLowerCase().replace(/\s+/g,'-')}`;
        await setDoc(doc(db, 'trivias', id), payload);
        ok++;
      }
      setStatus(`✔️ Subidas/actualizadas ${ok} trivias.`);
    } catch (e: any) {
      setErr(`Error al subir trivias: ${e?.message || e}`);
    }
  }

  if (loading) return <main><h2>Admin</h2><p>Conectando…</p></main>;
  if (!user) return (
    <main>
      <h2>Admin</h2>
      <p>No hay sesión. Pulsa para entrar como invitado.</p>
      <button onClick={()=>signInGuest()} style={{ background:'#2563eb', color:'#fff', padding:'8px 12px', borderRadius:8 }}>
        Entrar como invitado
      </button>
      {err && <p style={{ color:'salmon' }}>{err}</p>}
    </main>
  );

  return (
    <main>
      <h2>Admin — Cargar contenidos</h2>

      <section style={{ background:'#161b26', padding:16, borderRadius:12, marginBottom:16 }}>
        <h3>Preguntas (CSV)</h3>
        <p><small>Cabecera: curso,tema,enunciado,opcion_a,opcion_b,opcion_c,opcion_d,correcta,explicacion,dificultad</small></p>
        <textarea value={pasted} onChange={e=>setPasted(e.target.value)} placeholder="Pega aquí tu CSV..." rows={8} style={{ width:'100%', fontFamily:'monospace' }} />
        <div style={{ marginTop: 8, display:'flex', gap:8 }}>
          <button onClick={()=>parseAndUploadQuestions(pasted)} style={{ background:'#2563eb', color:'white', padding:'8px 12px', borderRadius:8 }}>Subir preguntas</button>
          <CSVFileUploader onParsed={parseAndUploadQuestions} />
        </div>
      </section>

      <section style={{ background:'#161b26', padding:16, borderRadius:12 }}>
        <h3>Trivias (CSV)</h3>
        <p><small>Cabecera: curso,tema,num_preguntas,tiempo_seg_por_preg</small></p>
        <textarea value={pastedTrivias} onChange={e=>setPastedTrivias(e.target.value)} placeholder="Pega aquí tu CSV de trivias..." rows={6} style={{ width:'100%', fontFamily:'monospace' }} />
        <div style={{ marginTop: 8, display:'flex', gap:8 }}>
          <button onClick={()=>parseAndUploadTrivias(pastedTrivias)} style={{ background:'#2563eb', color:'white', padding:'8px 12px', borderRadius:8 }}>Subir trivias</button>
          <CSVFileUploader onParsed={parseAndUploadTrivias} />
        </div>
      </section>

      {status && <p style={{ marginTop: 12, color: '#a7f3d0' }}>{status}</p>}
      {err && <p style={{ marginTop: 8, color: 'salmon' }}>{err}</p>}
    </main>
  );
}

function CSVFileUploader({ onParsed }: { onParsed: (text: string)=>Promise<void> }) {
  const [fileName, setFileName] = useState<string>('');
  function handleFile(e: any) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = async () => {
      const text = reader.result?.toString() || '';
      await onParsed(text);
    };
    reader.readAsText(f);
  }
  return (
    <label style={{ background:'#374151', color:'white', padding:'8px 12px', borderRadius:8, cursor:'pointer' }}>
      Subir archivo CSV {fileName ? `(${fileName})` : ''}
      <input type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display:'none' }} />
    </label>
  );
}
