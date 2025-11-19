import Script from 'next/script';
import { AuthProvider } from '../lib/AuthProvider';

export const metadata = {
  title: 'Trivia Beauchef',
  description: 'Entrenador inteligente para estudiantes de ingeniería',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: 'Inter, system-ui, sans-serif', margin: 0, background: '#050c1a', color: '#edf2f7' }}>
        <Script
          id="ga"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${process.env.NEXT_PUBLIC_GA_ID || 'G-XXXXXXX'}');
            `,
          }}
        />
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 24px' }}>
          <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span role="img" aria-label="Control de videojuego" style={{ fontSize: 28 }}>
                🎮
              </span>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#8dd3ff' }}>Trivia Beauchef</p>
            </div>
            <nav aria-label="Navegación principal" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <a href="/" style={{ color: '#edf2f7', textDecoration: 'none', fontWeight: 600 }}>Inicio</a>
              <a href="/ranking" style={{ color: '#edf2f7', textDecoration: 'none', fontWeight: 600 }}>Ranking</a>
              <a href="#como-funciona" style={{ color: '#edf2f7', textDecoration: 'none', fontWeight: 600 }}>Cómo funciona</a>
              <a href="/login" style={{ color: '#8dd3ff', textDecoration: 'none', fontWeight: 600 }}>Login</a>
              <a href="/signup" style={{ color: '#34d399', textDecoration: 'none', fontWeight: 600 }}>Regístrate</a>
            </nav>
          </header>
          <AuthProvider>{children}</AuthProvider>
        </div>
      </body>
    </html>
  );
}
