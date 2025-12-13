// app/dashboard/page.jsx - FIXED VERSION
// ❌ RETIRER 'use client' - Ce doit être un Server Component
import styles from '@/ui/styling/dashboard/dashboard.module.css';
import Card from '@/ui/components/dashboard/card';
import Chart from '@/ui/components/dashboard/chart';
import Rightbar from '@/ui/components/dashboard/rightbar';
import Transactions from '@/ui/components/dashboard/transactions';

/**
 * DASHBOARD PAGE - Server Component
 *
 * Note: La vérification auth est faite dans layout.jsx
 * Cette page peut rester simple et juste rendre le contenu
 */
export default function DashboardPage() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.main}>
        <div className={styles.cards}>
          <Card />
          <Card />
          <Card />
        </div>
        <Transactions />
        <Chart />
      </div>
      <div className={styles.side}>
        <Rightbar />
      </div>
    </div>
  );
}
