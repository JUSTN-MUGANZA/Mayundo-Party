import { useEffect, useMemo, useState } from "react";
import {
  listerPersonnesAvecPaiements,
  calculerTotauxParCategorie,
  supprimerPersonneEtHistorique,
} from "../services/caisseService";
import { exporterExcel, exporterPDF } from "../services/exportService";
import {
  preparerExportPersonnes,
  CATEGORIE_COMITE,
  CATEGORIE_INVITE,
} from "../services/rapportsExport";
import SectionRepliable from "./SectionRepliable";
import CelluleInvitation from "./CelluleInvitation";
import { TYPES_FRAIS } from "../constants/typesFrais";
import { FILTRES_INVITATION } from "../constants/invitation";

async function chargerRapport() {
  const [personnes, totauxCategorie] = await Promise.all([
    listerPersonnesAvecPaiements(),
    calculerTotauxParCategorie(),
  ]);
  return { personnes, totauxCategorie };
}

// Passe superAdmin = { uid, email } depuis l'espace super admin pour activer
// le bouton de suppression complète d'une personne — non affiché ailleurs.
export default function RapportPersonnes({ superAdmin, utilisateur }) {
  const [donnees, setDonnees] = useState(null);
  const [filtreCategorie, setFiltreCategorie] = useState("toutes");
  const [filtreFrais, setFiltreFrais] = useState("tous");
  const [filtreInvitation, setFiltreInvitation] = useState("tous");
  const [recherche, setRecherche] = useState("");
  const [confirmationSuppression, setConfirmationSuppression] = useState(null);

  const chargement = donnees === null;
  const personnes = useMemo(() => donnees?.personnes || [], [donnees]);
  const totauxCategorie = donnees?.totauxCategorie;

  useEffect(() => {
    let actif = true;
    chargerRapport().then((d) => {
      if (actif) setDonnees(d);
    });
    return () => {
      actif = false;
    };
  }, []);

  async function rafraichir() {
    setDonnees(await chargerRapport());
  }

  // Filtres cumulables : catégorie, frais concerné, état de l'invitation, nom.
  const personnesFiltrees = useMemo(() => {
    const nom = recherche.trim().toLowerCase();
    return personnes.filter((p) => {
      if (filtreCategorie !== "toutes" && p.categorie !== filtreCategorie) return false;
      if (filtreInvitation !== "tous" && p.statutInvitation !== filtreInvitation) return false;
      if (filtreFrais !== "tous") {
        // "Trier par frais" = ne garder que les personnes qui ont réellement
        // versé quelque chose sur ce frais.
        const frais = p.detailFrais.find((f) => f.id === filtreFrais);
        if (!frais || frais.paye <= 0) return false;
      }
      if (nom && !p.nom.toLowerCase().includes(nom)) return false;
      return true;
    });
  }, [personnes, filtreCategorie, filtreFrais, filtreInvitation, recherche]);

  // Les exports par catégorie portent sur TOUTES les personnes de la catégorie,
  // indépendamment des filtres d'affichage ci-dessous.
  async function exporterCategorie(categorie, format) {
    const params = preparerExportPersonnes({ personnes, categorie });
    if (format === "excel") await exporterExcel(params);
    else await exporterPDF(params);
  }

  // Export de ce qui est réellement affiché, filtres compris.
  async function exporterAffichage(format) {
    const params = preparerExportPersonnes({
      personnes: personnesFiltrees,
      categorie: filtreCategorie,
    });
    if (format === "excel") await exporterExcel(params);
    else await exporterPDF(params);
  }

  async function handleSupprimer(personne) {
    await supprimerPersonneEtHistorique({
      personneId: personne.id,
      personneNom: personne.nom,
      superAdmin,
    });
    setConfirmationSuppression(null);
    rafraichir();
  }

  return (
    <div className="card">
      <h2>Personnes ayant payé</h2>
      <p className="card-hint">
        Vue d'ensemble de qui est en règle avec les frais, avec la répartition membres du comité /
        étudiants, exportable en Excel ou PDF.
      </p>

      {totauxCategorie && (
        <div className="stat-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <span className="stat-label">Argent des membres du comité</span>
            <span className="stat-value mono">{totauxCategorie.totalComite} $</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Argent des étudiants / invités</span>
            <span className="stat-value mono">{totauxCategorie.totalEtudiants} $</span>
          </div>
        </div>
      )}

      <div className="export-buttons-grid">
        <div className="export-buttons-group">
          <span className="field-hint">
            Étudiants / invités <em>(sans la colonne comité)</em>
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={() => exporterCategorie(CATEGORIE_INVITE, "excel")}>
              Excel
            </button>
            <button className="btn btn-primary" onClick={() => exporterCategorie(CATEGORIE_INVITE, "pdf")}>
              PDF
            </button>
          </div>
        </div>
        <div className="export-buttons-group">
          <span className="field-hint">
            Membres du comité <em>(sans fête / t-shirt / défense)</em>
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={() => exporterCategorie(CATEGORIE_COMITE, "excel")}>
              Excel
            </button>
            <button className="btn btn-primary" onClick={() => exporterCategorie(CATEGORIE_COMITE, "pdf")}>
              PDF
            </button>
          </div>
        </div>
        <div className="export-buttons-group">
          <span className="field-hint">
            Export général <em>(toutes colonnes, en paysage)</em>
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={() => exporterCategorie("toutes", "excel")}>
              Excel
            </button>
            <button className="btn btn-primary" onClick={() => exporterCategorie("toutes", "pdf")}>
              PDF
            </button>
          </div>
        </div>
      </div>

      <div className="form-row" style={{ marginBottom: 8 }}>
        <label className="field">
          <span>Rechercher un nom</span>
          <input
            type="text"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom de la personne..."
          />
        </label>
        <label className="field">
          <span>Catégorie</span>
          <select value={filtreCategorie} onChange={(e) => setFiltreCategorie(e.target.value)}>
            <option value="toutes">Toutes les personnes</option>
            <option value={CATEGORIE_COMITE}>Membres du comité</option>
            <option value={CATEGORIE_INVITE}>Étudiants / invités</option>
          </select>
        </label>
        <label className="field">
          <span>Frais</span>
          <select value={filtreFrais} onChange={(e) => setFiltreFrais(e.target.value)}>
            <option value="tous">Tous les frais</option>
            {TYPES_FRAIS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Invitation</span>
          <select value={filtreInvitation} onChange={(e) => setFiltreInvitation(e.target.value)}>
            {FILTRES_INVITATION.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button className="btn btn-primary btn-compact" onClick={() => exporterAffichage("excel")}>
          Exporter l'affichage filtré (Excel)
        </button>
        <button className="btn btn-primary btn-compact" onClick={() => exporterAffichage("pdf")}>
          Exporter l'affichage filtré (PDF)
        </button>
      </div>

      <SectionRepliable
        titre="Détail des personnes"
        sousTitre="Le tableau complet reste replié : avec plusieurs centaines de payeurs, il n'a d'intérêt qu'au moment de le consulter. Les exports ci-dessus fonctionnent sans l'ouvrir."
        nombre={personnesFiltrees.length}
      >
      {chargement ? (
        <p className="empty-state">Chargement...</p>
      ) : personnesFiltrees.length === 0 ? (
        <p className="empty-state">Aucune personne à afficher pour ce filtre.</p>
      ) : (
        <div className="ledger-table-wrap">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Catégorie</th>
                <th>Amené par</th>
                <th>Détail des frais</th>
                <th>Statut</th>
                <th>Invitation</th>
                <th style={{ textAlign: "right" }}>Total payé</th>
                {superAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {personnesFiltrees.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.nom}
                    <br />
                    <span className="field-hint">{p.email || "—"}</span>
                  </td>
                  <td>
                    <span className={`badge ${p.categorie === "Membre du comité" ? "badge-partiel" : "badge-solde"}`}>
                      {p.categorie}
                    </span>
                  </td>
                  <td>{p.amenePar || "—"}</td>
                  <td>
                    {p.detailFrais
                      .filter((f) => f.paye > 0)
                      .map((f) => `${f.label} : ${f.paye.toFixed(2)}/${f.du} $ (${f.statut})`)
                      .join(" · ") || "Aucun paiement"}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        p.statutGlobal === "Soldé"
                          ? "badge-solde"
                          : p.statutGlobal === "Partiel"
                          ? "badge-partiel"
                          : "badge-annule"
                      }`}
                    >
                      {p.statutGlobal}
                    </span>
                  </td>
                  <td>
                    <CelluleInvitation
                      personne={p}
                      utilisateur={utilisateur || superAdmin}
                      peutDonner={Boolean(utilisateur || superAdmin)}
                      onChange={rafraichir}
                    />
                  </td>
                  <td className="ledger-amount in">{p.totalGeneral.toFixed(2)} $</td>
                  {superAdmin && (
                    <td>
                      {confirmationSuppression === p.id ? (
                        <span style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-danger-outline" onClick={() => handleSupprimer(p)}>
                            Confirmer
                          </button>
                          <button className="link-button" onClick={() => setConfirmationSuppression(null)}>
                            ×
                          </button>
                        </span>
                      ) : (
                        <button
                          className="link-button link-button-danger"
                          onClick={() => setConfirmationSuppression(p.id)}
                        >
                          Supprimer
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </SectionRepliable>
    </div>
  );
}

