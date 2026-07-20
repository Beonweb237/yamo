import type { AuthUser, UserRole } from '../contexts/AuthContext';

// Source unique des comptes de démonstration affichés sur les pages de
// connexion. Les numéros correspondent aux SEED_PROFILES d'AuthContext
// (registre mock) et aux emails de MOCK_EMAIL_PASSWORDS (Login.tsx) —
// garder les trois synchronisés si un compte est ajouté.
export interface DemoAccount {
  phone: string;
  role: UserRole;
  emoji: string;
  label: string;
  desc: string;
  approved: boolean;
  email: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { phone: '+237690000001', role: 'admin', emoji: '👑', label: 'Admin', desc: 'Approuvé — Dashboard admin', approved: true, email: 'admin@yamo.cm' },
  { phone: '+237690000002', role: 'client', emoji: '👤', label: 'Client (Marie D.)', desc: 'Approuvé — Peut commander', approved: true, email: 'client@yamo.cm' },
  { phone: '+237690000003', role: 'restaurant', emoji: '🏪', label: 'Restaurateur (Chez Mama)', desc: 'Approuvé — Dashboard resto', approved: true, email: 'restaurant@yamo.cm' },
  { phone: '+237690000004', role: 'restaurant', emoji: '🏪', label: 'Restaurateur', desc: 'En attente de validation', approved: false, email: 'resto-pending@yamo.cm' },
  { phone: '+237690000005', role: 'livreur', emoji: '🛵', label: 'Livreur (Paul K.)', desc: 'Approuvé — Dashboard livreur', approved: true, email: 'livreur@yamo.cm' },
  { phone: '+237690000006', role: 'livreur', emoji: '🛵', label: 'Livreur (Brice O.)', desc: 'En attente de validation', approved: false, email: 'livreur-pending@yamo.cm' },
];

export function demoAccountsForRole(role: UserRole): DemoAccount[] {
  return DEMO_ACCOUNTS.filter((account) => account.role === role);
}

// Profils pré-seedés du registre mock (utilisés par AuthContext au premier
// démarrage et upsertés par le seed démo). Import type-only côté AuthContext
// pour éviter tout cycle runtime.
export const SEED_PROFILES: AuthUser[] = [
  { id: 'seed-admin', phone: '+237690000001', role: 'admin', isApproved: true, isSuspended: false },
  { id: 'seed-client', phone: '+237690000002', role: 'client', isApproved: true, isSuspended: false },
  { id: 'seed-resto-ok', phone: '+237690000003', role: 'restaurant', isApproved: true, isSuspended: false },
  { id: 'seed-resto-pend', phone: '+237690000004', role: 'restaurant', isApproved: false, isSuspended: false },
  { id: 'seed-livreur-ok', phone: '+237690000005', role: 'livreur', isApproved: true, isSuspended: false, name: 'Paul Kamga' },
  { id: 'seed-livreur-pend', phone: '+237690000006', role: 'livreur', isApproved: false, isSuspended: false, name: 'Brice Onana' },
];
