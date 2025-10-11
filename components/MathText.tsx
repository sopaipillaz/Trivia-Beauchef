'use client';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import React from 'react';

// Renderiza $$...$$ (bloque) y $...$ (inline) con KaTeX puro.
export default function MathText({ text }: { text: string }) {
  if (!text) return null;

  // Divide primero por bloques $$...$$
  const blockParts = text.split(/(\$\$[\s\S]*?\$\$)/g);

  return (
    <span>
      {blockParts.map((part, i) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const expr = part.slice(2, -2);
          const html = katex.renderToString(expr, { throwOnError: false, displayMode: true });
          return <span key={`b-${i}`} dangerouslySetInnerHTML={{ __html: html }} />;
        }
        // Dentro de texto normal, renderiza inline $...$
        const inlineParts = part.split(/(\$[^$]+\$)/g);
        return inlineParts.map((seg, j) => {
          if (seg.startsWith('$') && seg.endsWith('$')) {
            const expr = seg.slice(1, -1);
            const html = katex.renderToString(expr, { throwOnError: false, displayMode: false });
            return <span key={`i-${i}-${j}`} dangerouslySetInnerHTML={{ __html: html }} />;
          }
          return <span key={`t-${i}-${j}`}>{seg}</span>;
        });
      })}
    </span>
  );
}
