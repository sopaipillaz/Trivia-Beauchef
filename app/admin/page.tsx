'use client';
import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import {
  addDoc,
  collection,
  serverTimestamp,
  setDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  deleteDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
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

type EditFormState = {
  enunciado: string;
  opcionA: string;
  opcionB: string;
  opcionC: string;
  opcionD: string;
  correcta: 'A'|'B'|'C'|'D';
  explicacion: string;
  dificultad: string;
};

export default function AdminPage() {
  const { user, loading, signInGuest } = useAuth();
  const [pasted, setPasted] = useState('');
  const [pastedTrivias, setPastedTrivias] = useState('');
  const [status, setStatus] = useState<string>('');
  const [err, setErr] = useState<string>('');
  const [filterCurso, setFilterCurso] = useState('');
  const [filterTema, setFilterTema] = useState('');
  const [filteredQuestions, setFilteredQuestions] = useState<any[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [courseOptions, setCourseOptions] = useState<Record<string, string[]>>({});
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
  const [editingQuestion, setEditingQuestion] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    enunciado: '',
    opcionA: '',
    opcionB: '',
    opcionC: '',
    opcionD: '',
    correcta: 'A',
    explicacion: '',
    dificultad: '',
  });
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [renameCurso, setRenameCurso] = useState('');
  const [renameTema, setRenameTema] = useState('');

  useEffect(() => {
    (async () => {
      // si no hay usuario y ya terminó de cargar, entra como invitado
      if (!loading && !user) {
        try { await signInGuest(); }
        catch (e: any) { setErr(`Auth error: ${e?.message || e}`); }
      }
    })();
  }, [user, loading, signInGuest]);

  useEffect(() => {
    if (!loading && user) {
      refreshCourseOptions();
    }
  }, [loading, user]);

  useEffect(() => {
    setRenameCurso(filterCurso);
    setRenameTema(filterTema);
  }, [filterCurso, filterTema]);

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
      await refreshCourseOptions();
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
      await refreshCourseOptions();
    } catch (e: any) {
      setErr(`Error al subir trivias: ${e?.message || e}`);
    }
  }

  async function refreshCourseOptions() {
    try {
      if (!user) return;
      const snap = await getDocs(collection(db, 'trivias'));
      const map: Record<string, Set<string>> = {};
      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const curso = String(data.curso || '').trim();
        const tema = String(data.tema || '').trim();
        if (!curso || !tema) return;
        if (!map[curso]) map[curso] = new Set<string>();
        map[curso].add(tema);
      });
      const normalized: Record<string, string[]> = {};
      Object.entries(map).forEach(([curso, temas]) => {
        normalized[curso] = Array.from(temas).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
      });
      setCourseOptions(normalized);
    } catch (e: any) {
      console.warn('No se pudieron cargar cursos', e);
    }
  }

  function slugify(text: string) {
    return String(text || '').toLowerCase().trim().replace(/\s+/g, '-');
  }

  function triviaId(curso: string, tema: string) {
    return `${slugify(curso)}-${slugify(tema)}`;
  }

  async function loadQuestionsByFilter(customCurso?: string, customTema?: string) {
    try {
      setErr('');
      setStatus('');
      setLoadingQuestions(true);
      if (!user) throw new Error('No hay sesión. Inicia como invitado o login.');
      const curso = (customCurso ?? filterCurso).trim();
      const tema = (customTema ?? filterTema).trim();
      if (!curso || !tema) {
        throw new Error('Debes indicar curso y tema para filtrar.');
      }
      const qRef = query(
        collection(db, 'preguntas'),
        where('curso', '==', curso),
        where('tema', '==', tema)
      );
      const snap = await getDocs(qRef);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setFilteredQuestions(docs);
      setSelectedQuestionId('');
      setEditingQuestion(null);
      setStatus(`Encontradas ${docs.length} preguntas para ${curso} / ${tema}.`);
    } catch (e: any) {
      setErr(`Error al cargar preguntas: ${e?.message || e}`);
    } finally {
      setLoadingQuestions(false);
    }
  }

  async function handleDeleteQuestion(questionId: string) {
    try {
      if (!user) throw new Error('No hay sesión. Inicia como invitado o login.');
      const confirmed = typeof window !== 'undefined'
        ? window.confirm('Eliminar esta pregunta? Esta acción no se puede deshacer.')
        : true;
      if (!confirmed) return;
      await deleteDoc(doc(db, 'preguntas', questionId));
      setFilteredQuestions((prev) => prev.filter((q) => q.id !== questionId));
      setSelectedQuestionId((prev) => prev === questionId ? '' : prev);
      setEditingQuestion((prev) => (prev && prev.id === questionId) ? null : prev);
      setStatus('Pregunta eliminada.');
    } catch (e: any) {
      setErr(`No se pudo eliminar: ${e?.message || e}`);
    }
  }

  function startEditingQuestion(questionId: string) {
    if (!questionId) {
      setSelectedQuestionId('');
      setEditingQuestion(null);
      return;
    }
    const q = filteredQuestions.find((item) => item.id === questionId);
    if (!q) return;
    setSelectedQuestionId(questionId);
    setEditingQuestion(q);
    setEditForm({
      enunciado: q.enunciado || '',
      opcionA: q.opciones?.A || '',
      opcionB: q.opciones?.B || '',
      opcionC: q.opciones?.C || '',
      opcionD: q.opciones?.D || '',
      correcta: (q.correcta || 'A').toUpperCase(),
      explicacion: q.explicacion || '',
      dificultad: q.dificultad || '',
    });
  }

  function handleEditFormChange<K extends keyof EditFormState>(field: K, value: EditFormState[K]) {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSaveEditedQuestion() {
    if (!editingQuestion) return;
    try {
      setSavingQuestion(true);
      const payload = {
        enunciado: editForm.enunciado.trim(),
        opciones: {
          A: editForm.opcionA,
          B: editForm.opcionB,
          C: editForm.opcionC,
          D: editForm.opcionD,
        },
        correcta: editForm.correcta as 'A'|'B'|'C'|'D',
        explicacion: editForm.explicacion,
        dificultad: editForm.dificultad,
      };
      await updateDoc(doc(db, 'preguntas', editingQuestion.id), payload);
      setFilteredQuestions((prev) =>
        prev.map((q) => q.id === editingQuestion.id ? { ...q, ...payload } : q)
      );
      setEditingQuestion((prev) => prev ? { ...prev, ...payload } : null);
      setStatus('Pregunta actualizada.');
    } catch (e: any) {
      setErr(`No se pudo actualizar la pregunta: ${e?.message || e}`);
    } finally {
      setSavingQuestion(false);
    }
  }

  async function handleDeleteTopic() {
    try {
      if (!user) throw new Error('No hay sesión. Inicia como invitado o login.');
      const curso = filterCurso.trim();
      const tema = filterTema.trim();
      if (!curso || !tema) throw new Error('Selecciona curso y tema antes de borrar.');
      const confirmed = typeof window !== 'undefined'
        ? window.confirm(`¿Eliminar todas las preguntas de ${curso} / ${tema}?`)
        : true;
      if (!confirmed) return;
      setLoadingQuestions(true);
      const qRef = query(
        collection(db, 'preguntas'),
        where('curso', '==', curso),
        where('tema', '==', tema)
      );
      const snap = await getDocs(qRef);
      if (snap.empty) {
        setStatus('No se encontraron preguntas para eliminar.');
        return;
      }
      const batch = writeBatch(db);
      snap.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();
      await deleteTopicTrivia(curso, tema);
      setFilteredQuestions([]);
      setSelectedQuestionId('');
      setEditingQuestion(null);
      setStatus(`Eliminadas ${snap.size} preguntas y la carpeta ${curso} / ${tema}.`);
      await refreshCourseOptions();
    } catch (e: any) {
      setErr(`Error al borrar carpeta: ${e?.message || e}`);
    } finally {
      setLoadingQuestions(false);
    }
  }

  async function handleRenameTopic() {
    try {
      if (!user) throw new Error('No hay sesión. Inicia como invitado o login.');
      const curso = filterCurso.trim();
      const tema = filterTema.trim();
      if (!curso || !tema) throw new Error('Selecciona curso y tema para renombrar.');
      const newCurso = renameCurso.trim();
      const newTema = renameTema.trim();
      if (!newCurso || !newTema) throw new Error('Debes indicar el nuevo nombre.');
      if (newCurso === curso && newTema === tema) {
        setErr('El nuevo nombre debe ser distinto.');
        return;
      }
      setLoadingQuestions(true);
      const qRef = query(
        collection(db, 'preguntas'),
        where('curso', '==', curso),
        where('tema', '==', tema)
      );
      const snap = await getDocs(qRef);
      if (snap.empty) {
        throw new Error('No hay preguntas para este tema.');
      }
      const batch = writeBatch(db);
      snap.forEach((docSnap) => batch.update(docSnap.ref, { curso: newCurso, tema: newTema }));
      await batch.commit();
      await renameTopicTrivia(curso, tema, newCurso, newTema);
      setFilterCurso(newCurso);
      setFilterTema(newTema);
      await loadQuestionsByFilter(newCurso, newTema);
      setStatus(`Lista renombrada a ${newCurso} / ${newTema}.`);
      await refreshCourseOptions();
    } catch (e: any) {
      setErr(`No se pudo renombrar: ${e?.message || e}`);
    } finally {
      setLoadingQuestions(false);
    }
  }

  async function deleteTopicTrivia(curso: string, tema: string) {
    try {
      const id = triviaId(curso, tema);
      await deleteDoc(doc(db, 'trivias', id));
    } catch (e) {
      console.warn('No se pudo eliminar trivia asociada', e);
    }
  }

  async function renameTopicTrivia(oldCurso: string, oldTema: string, newCurso: string, newTema: string) {
    try {
      const oldId = triviaId(oldCurso, oldTema);
      const newId = triviaId(newCurso, newTema);
      const ref = doc(db, 'trivias', oldId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data() as any;
      const payload = { ...data, curso: newCurso, tema: newTema };
      if (oldId === newId) {
        await setDoc(ref, payload, { merge: true });
      } else {
        await setDoc(doc(db, 'trivias', newId), payload);
        await deleteDoc(ref);
      }
    } catch (e) {
      console.warn('No se pudo renombrar trivia asociada', e);
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

  const cursosDisponibles = Object.keys(courseOptions).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  const temasDisponibles = filterCurso && courseOptions[filterCurso]
    ? courseOptions[filterCurso]
    : [];
  const cursoSelectValue = cursosDisponibles.includes(filterCurso) ? filterCurso : '';
  const temaSelectValue = temasDisponibles.includes(filterTema) ? filterTema : '';

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

      <section style={{ background:'#161b26', padding:16, borderRadius:12, marginTop:16 }}>
        <h3>Gestionar preguntas existentes</h3>
        <p><small>Selecciona la carpeta (curso/tema) y luego podrás listar, editar, renombrar o eliminar.</small></p>

        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <div style={{ flex:'1 1 220px' }}>
            <label style={{ display:'block', marginBottom:4 }}>Curso disponible</label>
            <select
              value={cursoSelectValue}
              onChange={(e)=>{ setFilterCurso(e.target.value); setFilterTema(''); }}
              style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid #374151', background:'#0f172a', color:'#fff' }}
            >
              <option value="">Escoge curso</option>
              {cursosDisponibles.map((curso)=>(
                <option key={curso} value={curso}>{curso}</option>
              ))}
            </select>
          </div>
          <div style={{ flex:'1 1 260px' }}>
            <label style={{ display:'block', marginBottom:4 }}>Tema disponible</label>
            <select
              value={temaSelectValue}
              onChange={(e)=>setFilterTema(e.target.value)}
              disabled={!filterCurso}
              style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid #374151', background:'#0f172a', color:'#fff' }}
            >
              <option value="">{filterCurso ? 'Selecciona tema' : 'Selecciona curso primero'}</option>
              {temasDisponibles.map((tema)=>(
                <option key={tema} value={tema}>{tema}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
          <input
            value={filterCurso}
            onChange={(e)=>setFilterCurso(e.target.value)}
            placeholder="Curso personalizado"
            style={{ flex:1, minWidth:200, padding:'8px 10px', borderRadius:8, border:'1px solid #374151', background:'#0f172a', color:'#fff' }}
          />
          <input
            value={filterTema}
            onChange={(e)=>setFilterTema(e.target.value)}
            placeholder="Tema personalizado"
            style={{ flex:1, minWidth:200, padding:'8px 10px', borderRadius:8, border:'1px solid #374151', background:'#0f172a', color:'#fff' }}
          />
        </div>

        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
          <button
            onClick={()=>loadQuestionsByFilter()}
            disabled={loadingQuestions}
            style={{ background:'#2563eb', color:'#fff', padding:'8px 12px', borderRadius:8 }}
          >
            {loadingQuestions ? 'Cargando...' : 'Buscar preguntas'}
          </button>
          <button
            onClick={handleDeleteTopic}
            disabled={loadingQuestions}
            style={{ background:'#b91c1c', color:'#fff', padding:'8px 12px', borderRadius:8 }}
          >
            Eliminar carpeta completa
          </button>
        </div>

        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
          <input
            value={renameCurso}
            onChange={(e)=>setRenameCurso(e.target.value)}
            placeholder="Nuevo curso"
            style={{ flex:1, minWidth:180, padding:'8px 10px', borderRadius:8, border:'1px solid #374151', background:'#0f172a', color:'#fff' }}
          />
          <input
            value={renameTema}
            onChange={(e)=>setRenameTema(e.target.value)}
            placeholder="Nuevo tema"
            style={{ flex:1, minWidth:220, padding:'8px 10px', borderRadius:8, border:'1px solid #374151', background:'#0f172a', color:'#fff' }}
          />
          <button
            onClick={handleRenameTopic}
            disabled={loadingQuestions}
            style={{ background:'#10b981', color:'#0f172a', padding:'8px 12px', borderRadius:8 }}
          >
            Renombrar carpeta
          </button>
        </div>

        <div style={{ marginTop:12 }}>
          <label style={{ display:'block', marginBottom:4 }}>Selecciona una pregunta para editar:</label>
          <select
            value={selectedQuestionId}
            onChange={(e)=>startEditingQuestion(e.target.value)}
            style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid #374151', background:'#0f172a', color:'#fff' }}
          >
            <option value="">-- Elige una pregunta --</option>
            {filteredQuestions.map((q)=>(
              <option key={q.id} value={q.id}>
                {q.enunciado?.slice(0, 80) || '(sin enunciado)'}
              </option>
            ))}
          </select>
        </div>

        {editingQuestion && (
          <div style={{ marginTop:12, background:'#0b1120', padding:16, borderRadius:10 }}>
            <h4 style={{ marginTop:0 }}>Editar pregunta seleccionada</h4>
            <textarea
              value={editForm.enunciado}
              onChange={(e)=>handleEditFormChange('enunciado', e.target.value)}
              rows={4}
              style={{ width:'100%', borderRadius:8, border:'1px solid #374151', background:'#111827', color:'#fff', padding:8 }}
            />
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12, marginTop:12 }}>
              {(['A','B','C','D'] as const).map((letter) => {
                const opcionKey = (`opcion${letter}`) as 'opcionA'|'opcionB'|'opcionC'|'opcionD';
                return (
                  <div key={letter}>
                    <label>Opción {letter}</label>
                    <input
                      value={editForm[opcionKey]}
                      onChange={(e)=>handleEditFormChange(opcionKey, e.target.value)}
                      style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid #374151', background:'#111827', color:'#fff' }}
                    />
                  </div>
                );
              })}
            </div>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginTop:12 }}>
              <label>
                Correcta:
                <select
                  value={editForm.correcta}
                  onChange={(e)=>handleEditFormChange('correcta', e.target.value as EditFormState['correcta'])}
                  style={{ marginLeft:8, padding:'6px 10px', borderRadius:8, border:'1px solid #374151', background:'#111827', color:'#fff' }}
                >
                  {['A','B','C','D'].map((opt)=> <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </label>
              <input
                value={editForm.dificultad}
                onChange={(e)=>handleEditFormChange('dificultad', e.target.value)}
                placeholder="Dificultad"
                style={{ flex:1, minWidth:160, padding:'8px 10px', borderRadius:8, border:'1px solid #374151', background:'#111827', color:'#fff' }}
              />
            </div>
            <textarea
              value={editForm.explicacion}
              onChange={(e)=>handleEditFormChange('explicacion', e.target.value)}
              rows={3}
              placeholder="Explicación / pauta"
              style={{ width:'100%', borderRadius:8, border:'1px solid #374151', background:'#111827', color:'#fff', padding:8, marginTop:12 }}
            />
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
              <button
                type="button"
                onClick={handleSaveEditedQuestion}
                disabled={savingQuestion}
                style={{ background:'#2563eb', color:'#fff', padding:'8px 12px', borderRadius:8 }}
              >
                {savingQuestion ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button
                type="button"
                onClick={()=>startEditingQuestion('')}
                style={{ background:'#374151', color:'#fff', padding:'8px 12px', borderRadius:8 }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop:12, maxHeight:320, overflowY:'auto' }}>
          {filteredQuestions.length === 0 && !loadingQuestions && (
            <p style={{ opacity:0.8 }}>No hay preguntas cargadas para este filtro.</p>
          )}
          <ul style={{ listStyle:'none', padding:0, margin:0, display:'grid', gap:8 }}>
            {filteredQuestions.map((q)=> (
              <li key={q.id} style={{ background:'#111827', padding:12, borderRadius:10 }}>
                <div style={{ fontWeight:600, marginBottom:4 }}>{q.enunciado}</div>
                <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  <small style={{ opacity:0.7 }}>Correcta: {q.correcta}</small>
                  <div style={{ display:'flex', gap:8 }}>
                    <button
                      onClick={()=>startEditingQuestion(q.id)}
                      style={{ background:'#14b8a6', color:'#0f172a', borderRadius:8, padding:'6px 10px' }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={()=>handleDeleteQuestion(q.id)}
                      style={{ background:'#dc2626', color:'#fff', borderRadius:8, padding:'6px 10px' }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
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
