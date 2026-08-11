import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/contexteAuth";
import { IconMenu, IconClose, IconLogout, IconUser } from "./Icons";
import "./Layout.css";

const LABEL_ROLE = {
  super_admin: "Super administrateur",
  admin: "Administrateur",
  caissier: "Caissier",
  president: "Président de la fête",
  cp: "Chef de promotion",
  membre: "Membre du comité",
};

export default function Layout({
  title,
  subtitle,
  children,
  bottomTabs = null,
  activeTab = null,
  onTabChange = null,
  hideHeading = false,
}) {
  const { user, role } = useAuth();
  const location = useLocation();
  const [menuOuvert, setMenuOuvert] = useState(false);

  const liens = useMemo(() => {
    switch (role) {
      case "super_admin":
        return [
          { to: "/super-admin#vue-ensemble", label: "Vue d'ensemble" },
          { to: "/super-admin#creation-admin", label: "Créer un admin" },
          { to: "/super-admin#parametres-evenement", label: "Paramètres" },
          { to: "/super-admin#message-groupe", label: "Message groupé" },
          { to: "/super-admin#utilisateurs", label: "Utilisateurs" },
          { to: "/super-admin#rapport-personnes", label: "Rapports" },
          { to: "/super-admin#demandes-correction", label: "Corrections" },
          { to: "/super-admin#par-caissier", label: "Par caissier" },
          { to: "/super-admin#journal-audit", label: "Journal d'audit" },
          { to: "/super-admin#historique-connexions", label: "Connexions" },
        ];
      case "admin":
        return [
          { to: "/admin#vue-ensemble", label: "Vue d'ensemble" },
          { to: "/admin#creation-utilisateur", label: "Créer un utilisateur" },
          { to: "/admin#demandes-correction", label: "Corrections" },
          { to: "/admin#rapport-personnes", label: "Rapports" },
          { to: "/admin#utilisateurs", label: "Utilisateurs" },
        ];
      case "caissier":
        return [
          { to: "/caissier#vue-ensemble", label: "Vue d'ensemble" },
          { to: "/caissier#paiements", label: "Paiements" },
          { to: "/caissier#sorties", label: "Sorties" },
          { to: "/caissier#historique", label: "Historique" },
        ];
      case "president":
      case "cp":
        return [
          { to: "/consultation#vue-ensemble", label: "Vue d'ensemble" },
          { to: "/consultation#mouvements-recents", label: "Mouvements" },
        ];
      case "membre":
        return [
          { to: "/consultation#statut-comite", label: "Statut comité" },
          { to: "/consultation#liste-comite", label: "Liste des membres" },
        ];
      default:
        return [];
    }
  }, [role]);

  function fermerMenu() {
    setMenuOuvert(false);
  }

  const hasBottomNav = bottomTabs && bottomTabs.length > 0;

  return (
    <div className={`layout${hasBottomNav ? " layout-with-bottom-nav" : ""}`}>
      {/* ── Top Bar ── */}
      <header className="layout-topbar">
        <div className="layout-brand">
          <span className="layout-brand-mark">MP</span>
          <span className="layout-brand-name">MAYUNDO Party — Caisse</span>
        </div>
        <div className="layout-user">
          <button
            type="button"
            className="layout-menu-toggle"
            aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={menuOuvert}
            onClick={() => setMenuOuvert((v) => !v)}
          >
            {menuOuvert ? <IconClose size={20} /> : <IconMenu size={20} />}
          </button>
          <div className="layout-user-info">
            <span className="layout-user-role">{LABEL_ROLE[role] || role}</span>
            <span className="layout-user-email">{user?.email}</span>
          </div>
          <button className="layout-logout" onClick={() => signOut(auth)}>
            Déconnexion
          </button>
        </div>
      </header>

      {/* ── Mobile Menu Panel ── */}
      <div className={`layout-mobile-panel${menuOuvert ? " open" : ""}`}>
        <nav className="layout-mobile-nav" aria-label="Navigation principale">
          {liens.map((lien) => {
            const chemin = lien.to.split("#")[0];
            const actif = location.pathname === chemin;
            return (
              <Link
                key={lien.to}
                to={lien.to}
                className={`layout-mobile-link${actif ? " active" : ""}`}
                onClick={fermerMenu}
              >
                {lien.label}
              </Link>
            );
          })}
          <div className="layout-mobile-meta">
            <div className="layout-mobile-user-row">
              <IconUser size={16} />
              <span className="layout-user-role">{LABEL_ROLE[role] || role}</span>
            </div>
            <span className="layout-user-email">{user?.email}</span>
          </div>
          <button className="layout-mobile-logout" onClick={() => signOut(auth)}>
            <IconLogout size={18} />
            Déconnexion
          </button>
        </nav>
      </div>

      {/* ── Main Content ── */}
      <main className="layout-main">
        {!hideHeading && (
          <div className="layout-heading">
            <h1>{title}</h1>
            {subtitle && <p className="layout-subtitle">{subtitle}</p>}
          </div>
        )}
        {children}
      </main>

      {/* ── Bottom Navigation Bar ── */}
      {hasBottomNav && (
        <nav className="bottom-nav" aria-label="Navigation principale">
          {bottomTabs.map((tab) => {
            if (tab.isFab) {
              return (
                <button
                  key="fab"
                  className="bottom-nav-fab"
                  onClick={() => onTabChange && onTabChange(tab.targetTab || tab.id)}
                  aria-label={tab.label || "Action principale"}
                >
                  {tab.icon}
                </button>
              );
            }

            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`bottom-nav-item${isActive ? " active" : ""}`}
                onClick={() => onTabChange && onTabChange(tab.id)}
                aria-label={tab.label}
              >
                <span className="bottom-nav-icon">{tab.icon}</span>
                <span className="bottom-nav-label">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* ── Footer (hidden when bottom nav present on mobile) ── */}
      <footer className={`layout-footer${hasBottomNav ? " hide-on-mobile" : ""}`}>
        Réalisé par l'entreprise JENGA DIGITAL
      </footer>
    </div>
  );
}
