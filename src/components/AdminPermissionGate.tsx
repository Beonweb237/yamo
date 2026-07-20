import { ShieldAlert } from 'lucide-react';
import { type ReactNode } from 'react';
import { hasAdminPermission } from '../lib/adminRbac';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from "react-i18next";

export default function AdminPermissionGate({ permission, children }: { permission: string; children: ReactNode }) {
    const { t } = useTranslation();
  const { user } = useAuth();

  if (hasAdminPermission(user, permission)) return <>{children}</>;

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-xl bg-white border border-border-custom rounded-xl shadow-sm p-6">
        <div className="w-11 h-11 rounded-lg bg-error/10 text-error flex items-center justify-center mb-4">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <h1 className="font-poppins font-bold text-text-primary text-xl mb-2">{t("Acces non autorise")}</h1>
        <p className="text-text-secondary text-sm font-inter">
          {t("Votre profil d'administration ne dispose pas de la permission requise pour cette page.")}
        </p>
      </div>
    </div>
  );
}
