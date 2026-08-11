import { useEffect, useMemo, useState } from "react";
import {
  listerPersonnesAvecPaiements,
  calculerTotauxParCategorie,
  supprimerPersonneEtHistorique,
} from "../services/caisseService";
import { exporterExcel, exporterPDF } from "../services/exportService";
import SectionRepliable from "./SectionRepliable";

async function chargerRapport() {
  const [personnes, totauxCategorie] = await Promise.all([
    listerPersonnesAvecPaiements(),
    calculerTotauxParCategorie(),
  ]);
  return { personnes, totauxCategorie };
}

// Passe superAdmin = { uid, email } depuis l'espace super admin pour activer
// le bouton de suppression complète d'une personne — non affiché ailleurs.
export default function RapportPersonnes({ superAdmin }) {
  const [donnees, setDonnees] = useState(null);
  const [filtreCategorie, setFiltreCategorie] = useState("toutes");
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

  const personnesFiltrees = useMemo(() => {
    if (filtreCategorie === "toutes") return personnes;
    return personnes.filter((p) => p.categorie === filtreCategorie);
  }, [personnes, filtreCategorie]);

  const colonnesExport = [
    { cle: "nom", titre: "Nom" },
    { cle: "email", titre: "E-mail" },
    { cle: "categorie", titre: "Catégorie" },
    { cle: "amenePar", titre: "Amené par (membre)" },
    { cle: "fete", titre: "Fête" },
    { cle: "tshirt", titre: "T-shirt" },
    { cle: "defense", titre: "Défense" },
    { cle: "comite", titre: "Frais de comité" },
    { cle: "statut", titre: "Statut" },
    { cle: "totalGeneral", titre: "Total payé ($)" },
  ];

  // Montants repérés par l'identifiant du frais et non par son libellé :
  // renommer un libellé ne doit pas vider une colonne de l'export.
  function ligneExport(p) {
    const parType = Object.fromEntries(
      p.detailFrais.map((f) => [f.id, `${f.paye.toFixed(2)} $ (${f.statut})`])
    );
    return {
      nom: p.nom,
      email: p.email || "—",
      categorie: p.categorie,
      amenePar: p.amenePar || "—",
      fete: parType.fete,
      tshirt: parType.tshirt,
      defense: parType.defense,
      comite: parType.comite,
      statut: p.statutGlobal,
      totalGeneral: Number(p.totalGeneral.toFixed(2)),
    };
  }

  async function exporterCategorie(categorie, format) {
    const lignes = (categorie === "toutes" ? personnes : personnes.filter((p) => p.categorie === categorie)).map(
      ligneExport
    );
    const params = {
      nomFichier: categorie === "Membre du comité" ? "membres-du-comite" : categorie === "toutes" ? "personnes-ayant-paye" : "etudiants-invites",
      colonnes: colonnesExport,
      lignes,
    };
    if (format === "excel") await exporterExcel(params);
    else await exporterPDF({ ...params, titre: `${params.nomFichier.replace(/-/g, " ")} — MAYUNDO Party` });
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
          <span className="field-hint">Étudiants / invités</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={() => exporterCategorie("Étudiant / invité", "excel")}>
              Excel
            </button>
            <button className="btn btn-primary" onClick={() => exporterCategorie("Étudiant / invité", "pdf")}>
              PDF
            </button>
          </div>
        </div>
        <div className="export-buttons-group">
          <span className="field-hint">Membres du comité</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={() => exporterCategorie("Membre du comité", "excel")}>
              Excel
            </button>
            <button className="btn btn-primary" onClick={() => exporterCategorie("Membre du comité", "pdf")}>
              PDF
            </button>
          </div>
        </div>
      </div>

      <div className="form-row" style={{ marginBottom: 16 }}>
        <label className="field">
          <span>Filtrer l'affichage ci-dessous par catégorie</span>
          <select value={filtreCategorie} onChange={(e) => setFiltreCategorie(e.target.value)}>
            <option value="toutes">Toutes les personnes</option>
            <option value="Membre du comité">Membres du comité</option>
            <option value="Étudiant / invité">Étudiants / invités</option>
          </select>
        </label>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <button className="btn btn-primary" onClick={() => exporterCategorie(filtreCategorie, "excel")}>
            Exporter l'affichage (Excel)
          </button>
          <button className="btn btn-primary" onClick={() => exporterCategorie(filtreCategorie, "pdf")}>
            Exporter l'affichage (PDF)
          </button>
        </div>
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

