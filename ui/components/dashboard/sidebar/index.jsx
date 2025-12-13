'use client';

import {
  MdDashboard,
  MdSupervisedUserCircle,
  MdShoppingBag,
  MdAttachMoney,
  MdLogout,
  MdCreditCard,
} from 'react-icons/md';
import Image from 'next/image';
import { useState } from 'react';
import MenuLink from './menuLink';
import styles from './sidebar.module.css';
import { signOut } from '@/lib/auth-client';

const menuItems = [
  {
    title: 'Pages',
    list: [
      {
        title: 'Dashboard',
        path: '/dashboard',
        icon: <MdDashboard />,
      },
      {
        title: 'Platforms',
        path: '/dashboard/platforms',
        icon: <MdCreditCard />,
      },
      {
        title: 'Templates',
        path: '/dashboard/templates',
        icon: <MdShoppingBag />,
      },
      {
        title: 'Applications',
        path: '/dashboard/applications',
        icon: <MdShoppingBag />,
      },
      {
        title: 'Orders',
        path: '/dashboard/orders',
        icon: <MdAttachMoney />,
      },
      {
        title: 'Blog',
        path: '/dashboard/blog',
        icon: <MdShoppingBag />,
      },
      {
        title: 'Users',
        path: '/dashboard/users',
        icon: <MdSupervisedUserCircle />,
      },
    ],
  },
];

function Sidebar() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  /**
   * 🔥 SOLUTION: Hard redirect après signOut
   * Inspiré de bs-client-better-auth/components/layouts/Header.jsx
   */
  const handleSignOut = async () => {
    try {
      setIsLoggingOut(true);

      // 1. Appeler signOut de Better Auth
      await signOut({
        callbackUrl: '/login',
        redirect: false, // ✅ On gère la redirection nous-mêmes
      });

      // 2. Hard redirect pour bypass le cache Next.js
      // (même solution que pour le login)
      window.location.href = '/login';
    } catch (error) {
      console.error('[Sidebar] Erreur lors de la déconnexion:', error);

      // En cas d'erreur, forcer quand même la redirection
      window.location.href = '/login';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.user}>
        <Image
          className={styles.userImage}
          src="/noavatar.png"
          alt=""
          width="50"
          height="50"
        />
        <div className={styles.userDetail}>
          <span className={styles.username}>Fathi Ahmed</span>
          <span className={styles.userTitle}>Benew founder</span>
        </div>
      </div>
      <ul className={styles.list}>
        {menuItems.map((cat) => (
          <li key={cat.title}>
            <span className={styles.cat}>{cat.title}</span>
            {cat.list.map((item) => (
              <MenuLink item={item} key={item.title} />
            ))}
          </li>
        ))}
      </ul>
      <form>
        <button
          className={styles.logout}
          type="button"
          onClick={handleSignOut}
          disabled={isLoggingOut}
        >
          <MdLogout />
          {isLoggingOut ? 'Déconnexion...' : 'Logout'}
        </button>
      </form>
    </div>
  );
}

export default Sidebar;
