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
  { phone: '690000001', role: 'admin', emoji: '👑', label: 'Admin', desc: 'Approuvé — Dashboard admin', approved: true, email: 'demo.admin@gmail.com' },
  { phone: '690000002', role: 'client', emoji: '👤', label: 'Client (Marie D.)', desc: 'Approuvé — Peut commander', approved: true, email: 'ngo.marie@gmail.com' },
  { phone: '690000003', role: 'restaurant', emoji: '🏪', label: 'Restaurateur (Chez Mama)', desc: 'Approuvé — Dashboard resto', approved: true, email: 'essomba.paul@yahoo.fr' },
  { phone: '690000004', role: 'restaurant', emoji: '🏪', label: 'Restaurateur', desc: 'En attente de validation', approved: false, email: 'manga.christelle@gmail.com' },
  { phone: '690000005', role: 'livreur', emoji: '🛵', label: 'Livreur (Paul K.)', desc: 'Approuvé — Dashboard livreur', approved: true, email: 'kamga.paul@gmail.com' },
  { phone: '690000006', role: 'livreur', emoji: '🛵', label: 'Livreur (Brice O.)', desc: 'En attente de validation', approved: false, email: 'onana.brice@yahoo.fr' },
];

export function demoAccountsForRole(role: UserRole): DemoAccount[] {
  return DEMO_ACCOUNTS.filter((account) => account.role === role);
}

// Profils pré-seedés du registre mock (utilisés par AuthContext au premier
// démarrage et upsertés par le seed démo). Import type-only côté AuthContext
// pour éviter tout cycle runtime.
export const SEED_PROFILES: AuthUser[] = [
  { id: 'seed-admin', phone: '690000001', email: 'demo.admin@gmail.com', role: 'admin', isApproved: true, isSuspended: false, name: 'Demo Admin' },
  { id: 'seed-client', phone: '690000002', email: 'ngo.marie@gmail.com', role: 'client', isApproved: true, isSuspended: false, name: 'Marie Ngo' },
  { id: 'seed-resto-ok', phone: '690000003', email: 'essomba.paul@yahoo.fr', role: 'restaurant', isApproved: true, isSuspended: false, name: 'Paul Essomba' },
  { id: 'seed-resto-pend', phone: '690000004', email: 'manga.christelle@gmail.com', role: 'restaurant', isApproved: false, isSuspended: false, name: 'Christelle Manga' },
  { id: 'seed-livreur-ok', phone: '690000005', email: 'kamga.paul@gmail.com', role: 'livreur', isApproved: true, isSuspended: false, name: 'Paul Kamga' },
  { id: 'seed-livreur-pend', phone: '690000006', email: 'onana.brice@yahoo.fr', role: 'livreur', isApproved: false, isSuspended: false, name: 'Brice Onana' },
];
