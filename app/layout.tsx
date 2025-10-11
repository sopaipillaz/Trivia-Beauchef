import { AuthProvider } from '../lib/AuthProvider';
export const metadata = { title: 'Trivia Beauchef', description: 'Trivias académicas gamificadas' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: 20, background: '#0b0d12', color: '#eaeef2' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h1 style={{ margin: 0 }}>🎮 Trivia Beauchef</h1>
            <nav style={{ display: 'flex', gap: 12 }}>
              <a href="/" style={{ color: 'white' }}>Inicio</a>
              <a href="/login" style={{ color: 'white' }}>Login</a>
              <a href="/signup" style={{ color: 'white' }}>Signup</a>
              <a href="/admin" style={{ color: 'white' }}>Admin</a>
            </nav>
          </header>
          <AuthProvider>{children}</AuthProvider>
        </div>
      </body>
    </html>
  );
}

