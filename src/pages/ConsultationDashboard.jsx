import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { useAuth } from "../context/contexteAuth";
import { ROLES } from "../constants/roles";
import {
  calculerVueEnsemble,
  listerPaiementsRecents,
  listerSortiesRecentes,
  listerPersonnesAvecPaiements,
} from "../services/caisseService";
import VueEnsembleCard from "../components/VueEnsembleCard";
import SectionRepliable from "../components/SectionRepliable";
import CelluleInvitation from "../components/CelluleInvitation";
import { TYPES_FRAIS } from "../constants/typesFrais";
import { FILTRES_INVITATION, STATUTS_INVITATION } from "../constants/invitation";
import "../styles/ui.css";

// Le président et le CP remettent les billets sur le terrain : ils ont donc
// besoin de la liste des invitations, avec le bouton pour marquer la remise.
// Un simple membre du comité, lui, reste en lecture seule.
function SectionInvitations({ utilisateur, peutDonner }) {
  const [personnes, setPersonnes] = useState(null);
  const [recherche, setRecherche] = useState("");
  const [filtreInvitation, setFiltreInvitation] = useState(STATUTS_INVITATION.A_DONNER);
  const [filtreFrais, setFiltreFrais] = useState("tous");

  useEffect(() => {
    let actif = true;
    listerPersonnesAvecPaiements().then((liste) => {
      if (actif) setPersonnes(liste);
    });
    return () => {
      actif = false;
    };
  }, []);

  async function rafraichir() {
    setPersonnes(await listerPersonnesAvecPaiements());
  }

  const filtrees = useMemo(() => {
    const nom = recherche.trim().toLowerCase();
    return (personnes || []).filter((p) => {
      if (nom && !p.nom.toLowerCase().includes(nom)) return false;
      if (filtreInvitation !== "tous" && p.statutInvitation !== filtreInvitation) return false;
      if (filtreFrais !== "tous") {
        const frais = p.detailFrais.find((f) => f.id === filtreFrais);
        if (!frais || frais.paye <= 0) return false;
      }
      return true;
    });
  }, [personnes, recherche, filtreInvitation, filtreFrais]);

  const aDonner = (personnes || []).filter(
    (p) => p.statutInvitation === STATUTS_INVITATION.A_DONNER
  ).length;
  const distribuees = (personnes || []).filter(
    (p) => p.statutInvitation === STATUTS_INVITATION.DISTRIBUEE
  ).length;

  return (
    <div id="invitations" className="card dashboard-section-anchor">
      <h2>Invitations</h2>
      <p className="card-hint">
        Qui a déjà reçu son billet d'entrée, et à qui il reste à le remettre. Une invitation ne
        devient disponible qu'une fois l'entrée soldée (10 $ de fête, ou 30 $ pour un membre du
        comité).
      </p>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <span className="stat-label">Invitations à donner</span>
          <span className="stat-value mono">{aDonner}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Déjà distribuées</span>
          <span className="stat-value mono in">{distribuees}</span>
        </div>
      </div>

      <div className="form-row" style={{ marginBottom: 12 }}>
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
          <span>Invitation</span>
          <select value={filtreInvitation} onChange={(e) => setFiltreInvitation(e.target.value)}>
            {FILTRES_INVITATION.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
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
      </div>

      <SectionRepliable titre="Liste des invitations" nombre={filtrees.length} defautOuvert>
        {personnes === null ? (
          <p className="empty-state">Chargement...</p>
        ) : filtrees.length === 0 ? (
          <p className="empty-state">Aucune personne pour ces filtres.</p>
        ) : (
          <div className="ledger-table-wrap">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Personne</th>
                  <th>Catégorie</th>
                  <th>Amené par</th>
                  <th>Statut paiement</th>
                  <th>Invitation</th>
                </tr>
              </thead>
              <tbody>
                {filtrees.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nom}</td>
                    <td>
                      <span
                        className={`badge ${
                          p.categorie === "Membre du comité" ? "badge-partiel" : "badge-solde"
                        }`}
                      >
                        {p.categorie}
                      </span>
                    </td>
                    <td>{p.amenePar || "—"}</td>
                    <td>
                      <span
                        className={`badge ${
                          p.statutGlobal === "Soldé" ? "badge-solde" : "badge-partiel"
                        }`}
                      >
                        {p.statutGlobal}
                      </span>
                    </td>
                    <td>
                      <CelluleInvitation
                        personne={p}
                        utilisateur={utilisateur}
                        peutDonner={peutDonner}
                        onChange={rafraichir}
                      />
                    </td>
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

// ---------------------------------------------------------------------------

export default function ConsultationDashboard() {
  const { user, role } = useAuth();

  // Un membre du comité ne voit QUE le statut des autres membres du comité
  // (pas les étudiants/invités, pas les totaux financiers globaux) — c'est
  // réservé à l'admin et au super admin.
  if (role === ROLES.MEMBRE) {
    return <StatutMembresComite />;
  }

  return <VueGlobaleCaisse utilisateur={user} />;
}

// ---------------------------------------------------------------------------

function StatutMembresComite() {
  const [membres, setMembres] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [afficherSeulementEnOrdre, setAfficherSeulementEnOrdre] = useState(false);

  useEffect(() => {
    listerPersonnesAvecPaiements().then((toutes) => {
      setMembres(toutes.filter((p) => p.categorie === "Membre du comité"));
      setChargement(false);
    });
  }, []);

  function estEnOrdre(m) {
    return m.detailFrais.find((f) => f.id === "comite")?.statut === "Soldé";
  }

  const nombreEnOrdre = membres.filter(estEnOrdre).length;
  const membresAffiches = afficherSeulementEnOrdre ? membres.filter(estEnOrdre) : membres;

  return (
    <Layout
      title="Statut des membres du comité"
      subtitle="Vue en lecture seule : qui est en règle avec son frais de comité (30 $)."
    >
      <section id="statut-comite" className="dashboard-section-anchor">
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <span className="stat-label">Membres en ordre (30 $)</span>
            <span className="stat-value mono in">{nombreEnOrdre} / {membres.length}</span>
          </div>
        </div>
      </section>

      <div id="liste-comite" className="card dashboard-section-anchor">
        <button
          type="button"
          className="link-button"
          style={{ marginBottom: 12 }}
          onClick={() => setAfficherSeulementEnOrdre((v) => !v)}
        >
          {afficherSeulementEnOrdre ? "Voir tout le monde" : "Voir seulement ceux en ordre avec le 30 $"}
        </button>

        <SectionRepliable titre="Liste des membres" nombre={membresAffiches.length}>
        {chargement ? (
          <p className="empty-state">Chargement...</p>
        ) : membresAffiches.length === 0 ? (
          <p className="empty-state">Aucun membre du comité n'a encore payé.</p>
        ) : (
          <div className="ledger-table-wrap">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Statut</th>
                  <th style={{ textAlign: "right" }}>Montant payé</th>
                </tr>
              </thead>
              <tbody>
                {membresAffiches.map((m) => {
                  const comite = m.detailFrais.find((f) => f.id === "comite");
                  return (
                    <tr key={m.id}>
                      <td>{m.nom}</td>
                      <td>
                        <span className={`badge ${comite?.statut === "Soldé" ? "badge-solde" : "badge-partiel"}`}>
                          {comite?.statut || "Aucun"}
                        </span>
                      </td>
                      <td className="ledger-amount in">
                        {(comite?.paye || 0).toFixed(2)} / {comite?.du || 30} $
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </SectionRepliable>
      </div>
    </Layout>
  );
}

// ---------------------------------------------------------------------------

function VueGlobaleCaisse({ utilisateur }) {
  const [totaux, setTotaux] = useState(null);
  const [historique, setHistorique] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    async function charger() {
      const [t, paiements, sorties] = await Promise.all([
        calculerVueEnsemble(),
        listerPaiementsRecents(15),
        listerSortiesRecentes(15),
      ]);
      setTotaux(t);
      const lignes = [
        ...paiements.map((p) => ({ ...p, nature: "entree" })),
        ...sorties.map((s) => ({ ...s, nature: "sortie" })),
      ].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setHistorique(lignes.slice(0, 15));
      setChargement(false);
    }
    charger();
  }, []);

  return (
    <Layout
      title="Situation de la caisse"
      subtitle="Vue en lecture seule de l'activité financière de la fête."
    >
      <section id="vue-ensemble" className="dashboard-section-anchor">
        <VueEnsembleCard
          titre="Vue d'ensemble globale"
          sousTitre="Montants globaux de tous les caissiers, ventilés par frais, sorties et solde restant."
          totaux={totaux}
        />
      </section>

      <SectionInvitations utilisateur={utilisateur} peutDonner />

      <div id="mouvements-recents" className="card dashboard-section-anchor">
        <h2>Mouvements récents</h2>
        <SectionRepliable
          titre="15 dernières opérations"
          sousTitre="Entrées et sorties de caisse confondues."
          nombre={historique.length}
        >
        {chargement ? (
          <p className="empty-state">Chargement...</p>
        ) : historique.length === 0 ? (
          <p className="empty-state">Aucune opération enregistrée pour le moment.</p>
        ) : (
          <div className="ledger-table-wrap">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Détail</th>
                  <th style={{ textAlign: "right" }}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {historique.map((ligne) => (
                  <tr key={ligne.id}>
                    <td>
                      {ligne.nature === "entree" ? (
                        <span className="badge badge-solde">Paiement</span>
                      ) : (
                        <span className="badge badge-partiel">Sortie</span>
                      )}
                    </td>
                    <td>
                      {ligne.nature === "entree"
                        ? `${ligne.personneNom} — ${ligne.typeFraisLabel}`
                        : ligne.motif}
                    </td>
                    <td className={`ledger-amount ${ligne.nature === "entree" ? "in" : "out"}`}>
                      {ligne.nature === "entree" ? "+" : "−"} {ligne.montant}{" "}
                      {ligne.devise === "CDF" ? "FC" : "$"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </SectionRepliable>
      </div>
    </Layout>
  );
}
