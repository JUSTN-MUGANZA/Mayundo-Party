import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { useAuth } from "../context/contexteAuth";
import { ROLES } from "../constants/roles";
import {
  agregerVueEnsemble,
  calculerVueEnsemble,
  listerPaiementsRecents,
  listerSortiesRecentes,
  listerTousLesPaiements,
  listerToutesLesSorties,
  listerPersonnesAvecPaiements,
  montantEffectifUSD,
} from "../services/caisseService";
import VueEnsembleCard from "../components/VueEnsembleCard";
import SectionRepliable from "../components/SectionRepliable";
import CelluleInvitation from "../components/CelluleInvitation";
import RapportPersonnes from "../components/RapportPersonnes";
import { TYPES_FRAIS } from "../constants/typesFrais";
import { FILTRES_INVITATION, STATUTS_INVITATION } from "../constants/invitation";
import { formatDateCourte, libelleDevise } from "../utils/format";
import "../styles/ui.css";

// Le président et le CP remettent les billets sur le terrain : ils ont donc
// besoin de la liste des invitations, avec le bouton pour marquer la remise.
// Un simple membre du comité, lui, reste en lecture seule.
//
// La liste peut être passée par le parent (prop "personnes", éventuellement
// encore à null pendant le chargement) : la page du membre du comité affiche
// trois sections bâties sur cette même liste, et chaque appel à
// listerPersonnesAvecPaiements relit l'INTÉGRALITÉ des collections "personnes"
// et "paiements". Sans la prop, la section se charge toute seule comme avant.
function SectionInvitations({ utilisateur, peutDonner, personnes, onRafraichir }) {
  const chargementAutonome = personnes === undefined;
  const [personnesLocales, setPersonnesLocales] = useState(null);
  const liste = chargementAutonome ? personnesLocales : personnes;

  const [recherche, setRecherche] = useState("");
  const [filtreInvitation, setFiltreInvitation] = useState(STATUTS_INVITATION.A_DONNER);
  const [filtreFrais, setFiltreFrais] = useState("tous");

  useEffect(() => {
    if (!chargementAutonome) return undefined;
    let actif = true;
    listerPersonnesAvecPaiements().then((l) => {
      if (actif) setPersonnesLocales(l);
    });
    return () => {
      actif = false;
    };
  }, [chargementAutonome]);

  async function rafraichir() {
    if (chargementAutonome) setPersonnesLocales(await listerPersonnesAvecPaiements());
    else await onRafraichir?.();
  }

  const filtrees = useMemo(() => {
    const nom = recherche.trim().toLowerCase();
    return (liste || []).filter((p) => {
      if (nom && !p.nom.toLowerCase().includes(nom)) return false;
      if (filtreInvitation !== "tous" && p.statutInvitation !== filtreInvitation) return false;
      if (filtreFrais !== "tous") {
        const frais = p.detailFrais.find((f) => f.id === filtreFrais);
        if (!frais || frais.paye <= 0) return false;
      }
      return true;
    });
  }, [liste, recherche, filtreInvitation, filtreFrais]);

  const aDonner = (liste || []).filter(
    (p) => p.statutInvitation === STATUTS_INVITATION.A_DONNER
  ).length;
  const distribuees = (liste || []).filter(
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
        {!liste ? (
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

  // Le membre du comité voit la même situation financière que le président et
  // le CP, mais sans aucun moyen d'agir (voir VueMembreComite).
  if (role === ROLES.MEMBRE) {
    return <VueMembreComite utilisateur={user} />;
  }

  return <VueGlobaleCaisse utilisateur={user} />;
}

// ---------------------------------------------------------------------------

// Bloc "statut du comité" : c'était historiquement le seul écran d'un membre
// du comité. Il reste inchangé, mais n'est plus qu'une section parmi d'autres
// de sa vue d'ensemble — c'est donc VueMembreComite qui fournit le Layout.
function StatutMembresComite({ personnes }) {
  const [afficherSeulementEnOrdre, setAfficherSeulementEnOrdre] = useState(false);

  const chargement = personnes === null;
  const membres = useMemo(
    () => (personnes || []).filter((p) => p.categorie === "Membre du comité"),
    [personnes]
  );

  function estEnOrdre(m) {
    return m.detailFrais.find((f) => f.id === "comite")?.statut === "Soldé";
  }

  const nombreEnOrdre = membres.filter(estEnOrdre).length;
  const membresAffiches = afficherSeulementEnOrdre ? membres.filter(estEnOrdre) : membres;

  return (
    <div id="statut-comite" className="card dashboard-section-anchor">
      <h2>Statut des membres du comité</h2>
      <p className="card-hint">Qui est en règle avec son frais de comité (30 $).</p>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <span className="stat-label">Membres en ordre (30 $)</span>
          <span className="stat-value mono in">{nombreEnOrdre} / {membres.length}</span>
        </div>
      </div>

      <div id="liste-comite" className="dashboard-section-anchor">
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
    </div>
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

// ---------------------------------------------------------------------------
// Espace du membre du comité.
//
// Il voit exactement la même chose qu'un admin sur le plan financier — totaux
// par frais, sorties, solde en caisse, détail de chaque opération — mais
// STRICTEMENT rien d'autre que voir : pas de bouton d'action, pas d'export,
// pas de remise d'invitation. Ce n'est pas qu'une question d'affichage : les
// règles Firestore refusent déjà toute écriture à ce rôle (estLectureSeule ne
// donne que des droits de lecture, et remetLesInvitations exclut 'membre').
// L'interface ne fait donc que refléter une limite déjà opposable côté
// serveur — ne pas ajouter de bouton ici en pensant que ça suffirait.

// Les trois sections nominatives de cette page (rapport, invitations, statut du
// comité) reposent sur la même liste de personnes, et les totaux se déduisent
// des paiements et des sorties déjà affichés en détail. Tout est donc chargé
// UNE fois ici : sans serveur, chaque appel relit une collection entière et
// consomme le quota Firestore du projet.
async function chargerDonneesMembre() {
  const [paiements, sorties, personnes] = await Promise.all([
    listerTousLesPaiements(),
    listerToutesLesSorties(),
    listerPersonnesAvecPaiements(),
  ]);
  return { paiements, sorties, personnes };
}

function VueMembreComite({ utilisateur }) {
  const [donnees, setDonnees] = useState(null);

  useEffect(() => {
    let actif = true;
    chargerDonneesMembre().then((d) => {
      if (actif) setDonnees(d);
    });
    return () => {
      actif = false;
    };
  }, []);

  async function rafraichir() {
    setDonnees(await chargerDonneesMembre());
  }

  const totaux = useMemo(
    () => (donnees ? agregerVueEnsemble(donnees.paiements, donnees.sorties) : null),
    [donnees]
  );

  // Même découpage que le rapport de l'admin : l'argent du comité d'un côté,
  // celui des étudiants/invités de l'autre (fête + t-shirt + défense).
  const totauxCategorie = totaux
    ? { totalComite: totaux.totalComite, totalEtudiants: totaux.totalInvite }
    : undefined;

  const personnes = donnees?.personnes ?? null;

  return (
    <Layout
      title="Situation de la caisse"
      subtitle="Vue en lecture seule : tous les paiements, toutes les sorties et le solde restant. Aucune modification n'est possible depuis cet espace."
    >
      <section id="vue-ensemble" className="dashboard-section-anchor">
        <VueEnsembleCard
          titre="Vue d'ensemble globale"
          sousTitre="Montants globaux de tous les caissiers, ventilés par frais, sorties et solde restant."
          totaux={totaux}
        />
      </section>

      <RepartitionParCaissier totaux={totaux} />

      <TableauTousPaiements paiements={donnees?.paiements ?? null} />

      <TableauToutesSorties sorties={donnees?.sorties ?? null} />

      <section id="rapport-personnes" className="dashboard-section-anchor">
        <RapportPersonnes
          utilisateur={utilisateur}
          lectureSeule
          personnes={personnes}
          totauxCategorie={totauxCategorie}
          onRafraichir={rafraichir}
        />
      </section>

      <SectionInvitations
        utilisateur={utilisateur}
        peutDonner={false}
        personnes={personnes}
        onRafraichir={rafraichir}
      />

      <StatutMembresComite personnes={personnes} />
    </Layout>
  );
}

// ---------------------------------------------------------------------------

function RepartitionParCaissier({ totaux }) {
  return (
    <div id="par-caissier" className="card dashboard-section-anchor">
      <h2>Montant encaissé par caissier</h2>
      <SectionRepliable
        titre="Répartition par caissier"
        sousTitre="Ce que chaque caissier a encaissé au total, tous frais confondus."
        nombre={totaux?.parCaissier.length ?? 0}
      >
        {!totaux ? (
          <p className="empty-state">Chargement...</p>
        ) : totaux.parCaissier.length === 0 ? (
          <p className="empty-state">Aucun paiement enregistré pour le moment.</p>
        ) : (
          <div className="ledger-table-wrap">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Caissier</th>
                  <th style={{ textAlign: "right" }}>Montant encaissé</th>
                </tr>
              </thead>
              <tbody>
                {totaux.parCaissier.map((c) => (
                  <tr key={c.email}>
                    <td>{c.email}</td>
                    <td className="ledger-amount in" style={{ textAlign: "right" }}>
                      {c.total.toFixed(2)} $
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

// Deux colonnes de montant volontairement distinctes : "Montant" est la somme
// telle qu'elle a été encaissée (en $ ou en FC), "Équivalent" la valeur retenue
// dans les totaux et le solde, toujours en dollars. Sans les deux, un paiement
// en francs semble ne pas correspondre au total affiché plus haut.
function TableauTousPaiements({ paiements }) {
  const totalUSD = (paiements || []).reduce((t, p) => t + montantEffectifUSD(p), 0);

  return (
    <div id="paiements" className="card dashboard-section-anchor">
      <h2>Tous les paiements</h2>
      <p className="card-hint">
        Une ligne = une tranche encaissée. Un même frais peut donc revenir plusieurs fois pour la
        même personne : c'est la somme des tranches qui fait le montant payé.
      </p>
      <SectionRepliable
        titre="Détail des encaissements"
        sousTitre="Toutes les opérations de tous les caissiers, de la plus récente à la plus ancienne."
        nombre={paiements?.length ?? 0}
      >
        {!paiements ? (
          <p className="empty-state">Chargement...</p>
        ) : paiements.length === 0 ? (
          <p className="empty-state">Aucun paiement enregistré pour le moment.</p>
        ) : (
          <div className="ledger-table-wrap">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Personne</th>
                  <th>Frais</th>
                  <th style={{ textAlign: "right" }}>Montant</th>
                  <th style={{ textAlign: "right" }}>Équivalent</th>
                  <th>Caissier</th>
                </tr>
              </thead>
              <tbody>
                {paiements.map((p) => (
                  <tr key={p.id} style={p.annule ? { opacity: 0.6 } : undefined}>
                    <td>{formatDateCourte(p.createdAt)}</td>
                    <td>{p.personneNom}</td>
                    <td>
                      {p.typeFraisLabel}
                      {p.corrige && <div className="field-hint">Montant corrigé</div>}
                      {p.annule && <div className="field-hint">Opération annulée</div>}
                    </td>
                    <td className="ledger-amount in" style={{ textAlign: "right" }}>
                      {p.montant} {libelleDevise(p.devise)}
                    </td>
                    <td className="ledger-amount in" style={{ textAlign: "right" }}>
                      {montantEffectifUSD(p).toFixed(2)} $
                    </td>
                    <td>{p.caissierEmail}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>
                    <strong>Total encaissé</strong>
                  </td>
                  <td className="ledger-amount in" style={{ textAlign: "right" }}>
                    <strong>{totalUSD.toFixed(2)} $</strong>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionRepliable>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TableauToutesSorties({ sorties }) {
  const totalUSD = (sorties || []).reduce((t, s) => t + montantEffectifUSD(s), 0);

  return (
    <div id="sorties" className="card dashboard-section-anchor">
      <h2>Toutes les sorties de caisse</h2>
      <p className="card-hint">
        Chaque dépense enregistrée par un caissier, avec son motif. Une sortie n'est jamais
        supprimée : si elle est fausse, elle est corrigée et l'ancien montant reste tracé.
      </p>
      <SectionRepliable
        titre="Détail des sorties"
        sousTitre="Toutes les dépenses, de la plus récente à la plus ancienne."
        nombre={sorties?.length ?? 0}
      >
        {!sorties ? (
          <p className="empty-state">Chargement...</p>
        ) : sorties.length === 0 ? (
          <p className="empty-state">Aucune sortie de caisse enregistrée pour le moment.</p>
        ) : (
          <div className="ledger-table-wrap">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Motif</th>
                  <th style={{ textAlign: "right" }}>Montant</th>
                  <th style={{ textAlign: "right" }}>Équivalent</th>
                  <th>Caissier</th>
                </tr>
              </thead>
              <tbody>
                {sorties.map((s) => (
                  <tr key={s.id} style={s.annule ? { opacity: 0.6 } : undefined}>
                    <td>{formatDateCourte(s.createdAt)}</td>
                    <td>
                      {s.motif}
                      {s.corrige && <div className="field-hint">Montant corrigé</div>}
                      {s.annule && <div className="field-hint">Opération annulée</div>}
                    </td>
                    <td className="ledger-amount out" style={{ textAlign: "right" }}>
                      {s.montant} {libelleDevise(s.devise)}
                    </td>
                    <td className="ledger-amount out" style={{ textAlign: "right" }}>
                      {montantEffectifUSD(s).toFixed(2)} $
                    </td>
                    <td>{s.caissierEmail}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>
                    <strong>Total des sorties</strong>
                  </td>
                  <td className="ledger-amount out" style={{ textAlign: "right" }}>
                    <strong>{totalUSD.toFixed(2)} $</strong>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionRepliable>
    </div>
  );
}
