// app/dashboard/layout.jsx - FIXED VERSION
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import styles from '@/ui/styling/dashboard/dashboard.module.css';
import Navbar from '@/ui/components/dashboard/navbar';
import Sidebar from '@/ui/components/dashboard/sidebar';

/**
 * DASHBOARD LAYOUT - Server Component avec protection auth
 *
 * IMPORTANT: Ce layout vérifie la session AVANT de rendre le dashboard
 * Si pas de session → redirect vers /login
 */
export default async function DashboardLayout({ children }) {
  // ✅ Vérification session côté serveur (CRITIQUE)
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // ✅ Rediriger vers login si pas authentifié
  if (!session?.user) {
    redirect('/login');
  }

  // ✅ Rendre le dashboard seulement si authentifié
  return (
    <div className={styles.container}>
      <div className={styles.menu}>
        <Sidebar />
      </div>
      <div className={styles.content}>
        <Navbar />
        {children}
      </div>
    </div>
  );
}

// ✅ Metadata pour SEO
export const metadata = {
  title: 'Dashboard | Benew Admin',
  robots: 'noindex, nofollow', // Pas d'indexation
};
