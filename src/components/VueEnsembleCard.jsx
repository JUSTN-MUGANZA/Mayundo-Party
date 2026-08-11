import {
  IconFete,
  IconTshirt,
  IconDefense,
  IconComite,
  IconExit,
  IconWallet,
  IconArrowUp,
  IconArrowDown,
  IconChevronRight,
} from "./Icons";
import "../styles/ui.css";

const CATEGORY_ICONS = {
  fete: { icon: <IconFete size={22} />, tone: "ci-green" },
  tshirt: { icon: <IconTshirt size={22} />, tone: "ci-green" },
  defense: { icon: <IconDefense size={22} />, tone: "ci-green" },
  comite: { icon: <IconComite size={22} />, tone: "ci-green" },
  sorties: { icon: <IconExit size={22} />, tone: "ci-red" },
  solde: { icon: <IconWallet size={22} />, tone: "ci-gold" },
};

function LigneCategorie({ id, label, sublabel, value, tone = "ca-green", extraClass = "" }) {
  const cat = CATEGORY_ICONS[id] || CATEGORY_ICONS.fete;
  return (
    <div className={`category-card ${extraClass}`}>
      <div className={`category-icon ${cat.tone}`}>
        {cat.icon}
      </div>
      <div className="category-info">
        <div className="category-label">{label}</div>
        <div className="category-sublabel">{sublabel}</div>
      </div>
      <div className="category-right">
        <span className={`category-amount ${tone}`}>{value}</span>
        <IconChevronRight size={16} style={{ color: "var(--color-ink-soft)" }} />
      </div>
    </div>
  );
}

export default function VueEnsembleCard({ titre, sousTitre, totaux }) {
  if (!totaux) {
    return (
      <div className="card">
        <h2>{titre}</h2>
        {sousTitre && <p className="card-hint">{sousTitre}</p>}
        <p className="empty-state">Chargement...</p>
      </div>
    );
  }

  const totalRecettes =
    (totaux.totalFete || 0) +
    (totaux.totalTshirt || 0) +
    (totaux.totalDefense || 0) +
    (totaux.totalComite || 0);

  const nbCategoriesRecettes = [
    totaux.totalFete,
    totaux.totalTshirt,
    totaux.totalDefense,
    totaux.totalComite,
  ].filter((v) => v > 0).length;

  return (
    <div>
      {/* Header card */}
      <div className="banner-card" style={{ marginBottom: 16 }}>
        <div className="banner-info">
          <h2>{titre || "Résumé de la caisse"}</h2>
          <p>{sousTitre || "Aperçu rapide de toutes les entrées et sorties."}</p>
        </div>
        <div className="banner-action" style={{ cursor: "default" }}>
          <IconArrowUp size={20} />
          <span style={{ fontSize: 10 }}>Résumé</span>
        </div>
      </div>

      {/* Category list */}
      <div className="category-list">
        <LigneCategorie
          id="fete"
          label="Fête"
          sublabel="Recettes"
          value={`${totaux.totalFete.toFixed(2)} $`}
          tone="ca-green"
        />
        <LigneCategorie
          id="tshirt"
          label="T-shirt"
          sublabel="Recettes"
          value={`${totaux.totalTshirt.toFixed(2)} $`}
          tone="ca-green"
        />
        <LigneCategorie
          id="defense"
          label="Défense"
          sublabel="Recettes"
          value={`${totaux.totalDefense.toFixed(2)} $`}
          tone="ca-green"
        />
        <LigneCategorie
          id="comite"
          label="Membre de comité"
          sublabel="Recettes"
          value={`${totaux.totalComite.toFixed(2)} $`}
          tone="ca-green"
        />
        <LigneCategorie
          id="sorties"
          label="Sorties"
          sublabel="Dépenses"
          value={`${totaux.totalSorties.toFixed(2)} $`}
          tone="ca-red"
          extraClass="category-out"
        />
        <LigneCategorie
          id="solde"
          label="Solde restant"
          sublabel="Disponible"
          value={`${totaux.solde.toFixed(2)} $`}
          tone="ca-green"
          extraClass="category-solde"
        />
      </div>

      {/* Summary bar */}
      <div className="summary-bar">
        <div className="summary-item">
          <div className="summary-icon si-green">
            <IconArrowUp size={20} />
          </div>
          <div className="summary-data">
            <span className="summary-label">Total recettes</span>
            <span className="summary-value sv-green">{totalRecettes.toFixed(2)} $</span>
            <span className="summary-sub">{nbCategoriesRecettes} catégorie{nbCategoriesRecettes > 1 ? "s" : ""}</span>
          </div>
        </div>
        <div className="summary-item">
          <div className="summary-icon si-red">
            <IconArrowDown size={20} />
          </div>
          <div className="summary-data">
            <span className="summary-label">Total dépenses</span>
            <span className="summary-value sv-red">{totaux.totalSorties.toFixed(2)} $</span>
            <span className="summary-sub">1 catégorie</span>
          </div>
        </div>
      </div>
    </div>
  );
}
