export const metadata = {
  title: 'Trivia Beauchef',
  description: 'Trivias académicas gamificadas',
};

export default function TriviasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Nested layouts must NOT include <html> or <body>.
  return <>{children}</>;
}
