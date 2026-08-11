import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import RapportPersonnes from "../components/RapportPersonnes";
import { useAuth } from "../context/contexteAuth";
import { ROLES } from "../constants/roles";
import { DEVISES } from "../constants/devises";
import {
  listerUtilisateurs,
  creerCompteUtilisateur,
  modifierRoleUtilisateur,
  retirerAccesUtilisateur,
  listerDemandesCorrection,
  traiterDemandeCorrection,
  calculerVueEnsemble,
} from "../services/caisseService";
import VueEnsembleCard from "../components/VueEnsembleCard";
import SectionRepliable from "../components/SectionRepliable";
import { formatDate, LABEL_STATUT_DEMANDE, classeBadgeStatutDemande } from "../utils/format";
import "../styles/ui.css";

const ROLES_GERES_PAR_ADMIN = [
  { id: ROLES.CAISSIER, label: "Caissier" },
  { id: ROLES.PRESIDENT, label: "Président de la fête" },
  { id: ROLES.CP, label: "Chef de promotion (CP)" },
  { id: ROLES.MEMBRE, label: "Membre du comité" },
];

const LABEL_ROLE = Object.fromEntries(ROLES_GERES_PAR_ADMIN.map((r) => [r.id, r.label]));
LABEL_ROLE[ROLES.ADMIN] = "Administrateur";
LABEL_ROLE[ROLES.SUPER_ADMIN] = "Super administrateur";

// Hors du composant : l'effet de montage peut l'appeler sans dépendance, et le
// même chargement sert au rafraîchissement après une action.
async function chargerDonneesAdmin() {
  const [liste, vueEnsemble] = await Promise.all([listerUtilisateurs(), calculerVueEnsemble()]);
  // Le super admin n'apparaît jamais dans cette liste — son existence
  // reste invisible pour les autres rôles.
  return { utilisateurs: liste.filter((u) => u.role !== ROLES.SUPER_ADMIN), vueEnsemble };
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [ongletMobile, setOngletMobile] = useState("vue");
  const [donnees, setDonnees] = useState(null);

  const chargement = donnees === null;
  const utilisateurs = donnees?.utilisateurs || [];
  const vueEnsemble = donnees?.vueEnsemble;

  useEffect(() => {
    let actif = true;
    chargerDonneesAdmin().then((d) => {
      if (actif) setDonnees(d);
    });
    return () => {
      actif = false;
    };
  }, []);

  async function rafraichir() {
    setDonnees(await chargerDonneesAdmin());
  }

  return (
    <Layout
      title="Espace administrateur"
      subtitle="Crée et gère les comptes caissiers et les autres profils de l'application."
    >
      <div className="mobile-tabs" role="tablist" aria-label="Navigation mobile administrateur">
        <button type="button" className={`mobile-tab${ongletMobile === "vue" ? " active" : ""}`} onClick={() => setOngletMobile("vue")}>Vue d'ensemble</button>
        <button type="button" className={`mobile-tab${ongletMobile === "creation" ? " active" : ""}`} onClick={() => setOngletMobile("creation")}>Créer</button>
        <button type="button" className={`mobile-tab${ongletMobile === "corrections" ? " active" : ""}`} onClick={() => setOngletMobile("corrections")}>Corrections</button>
        <button type="button" className={`mobile-tab${ongletMobile === "rapports" ? " active" : ""}`} onClick={() => setOngletMobile("rapports")}>Rapports</button>
        <button type="button" className={`mobile-tab${ongletMobile === "utilisateurs" ? " active" : ""}`} onClick={() => setOngletMobile("utilisateurs")}>Utilisateurs</button>
      </div>

      <div className="mobile-tab-panels">
        <div className={`mobile-tab-panel${ongletMobile === "vue" ? " active" : ""}`}>
          <section id="vue-ensemble" className="dashboard-section-anchor">
            <VueEnsembleCard
              titre="Vue d'ensemble globale"
              sousTitre="Montants globaux de tous les caissiers, ventilés par frais, sorties et solde restant."
              totaux={vueEnsemble}
            />
          </section>
        </div>

        <div className={`mobile-tab-panel${ongletMobile === "creation" ? " active" : ""}`}>
          <section id="creation-utilisateur" className="dashboard-section-anchor">
            <FormCreerUtilisateur admin={user} onSuccess={rafraichir} />
          </section>
        </div>

        <div className={`mobile-tab-panel${ongletMobile === "corrections" ? " active" : ""}`}>
          <section id="demandes-correction" className="dashboard-section-anchor">
            <DemandesCorrection admin={user} />
          </section>
        </div>

        <div className={`mobile-tab-panel${ongletMobile === "rapports" ? " active" : ""}`}>
          <section id="rapport-personnes" className="dashboard-section-anchor">
            <RapportPersonnes utilisateur={user} />
          </section>
        </div>

        <div className={`mobile-tab-panel${ongletMobile === "utilisateurs" ? " active" : ""}`}>
          <div id="utilisateurs" className="card dashboard-section-anchor">
        <h2>Utilisateurs existants</h2>
        <SectionRepliable
          titre="Comptes de l'application"
          sousTitre="Retirer l'accès supprime le rôle de la personne dans l'application ; son compte de connexion reste actif dans Firebase mais ne donnera plus accès à aucun espace."
          nombre={utilisateurs.length}
        >
          {chargement ? (
            <p className="empty-state">Chargement...</p>
          ) : utilisateurs.length === 0 ? (
            <p className="empty-state">Aucun utilisateur enregistré pour le moment.</p>
          ) : (
            <div className="ledger-table-wrap">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>E-mail</th>
                    <th>Rôle</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {utilisateurs.map((u) => (
                    <LigneUtilisateur key={u.id} utilisateur={u} admin={user} onChange={rafraichir} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionRepliable>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// ---------------------------------------------------------------------------

function FormCreerUtilisateur({ admin, onSuccess }) {
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(ROLES_GERES_PAR_ADMIN[0].id);
  const [statut, setStatut] = useState({ type: null, message: "" });
  const [envoi, setEnvoi] = useState(false);

  const sansMotDePasse = role === ROLES.CAISSIER;

  async function handleSubmit(e) {
    e.preventDefault();
    setStatut({ type: null, message: "" });

    if (!sansMotDePasse && password.length < 6) {
      setStatut({ type: "error", message: "Le mot de passe doit contenir au moins 6 caractères." });
      return;
    }

    setEnvoi(true);
    try {
      const resultat = await creerCompteUtilisateur({ nom, email, password, role, admin, sansMotDePasse });
      setNom("");
      setEmail("");
      setPassword("");
      setStatut({
        type: sansMotDePasse && !resultat.emailActivationEnvoye ? "error" : "success",
        message: sansMotDePasse
          ? resultat.emailActivationEnvoye
            ? `Compte caissier créé pour ${email} — e-mails envoyés (activation + lien Firebase).`
            : `Compte caissier créé pour ${email}, MAIS l'e-mail de bienvenue a échoué à l'envoi (vérifie la console du navigateur). Le lien Firebase a quand même pu partir séparément.`
          : `Compte créé pour ${email} (${LABEL_ROLE[role]}).`,
      });
      onSuccess();
    } catch (err) {
      setStatut({ type: "error", message: traduireErreur(err) });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="card">
      <h2>Créer un utilisateur</h2>
      <p className="card-hint">
        {sansMotDePasse
          ? "Pour un caissier, tu ne définis pas son mot de passe : il recevra un e-mail pour le créer lui-même (évite toute accusation de manipulation de son compte)."
          : "Le compte est créé immédiatement et peut se connecter avec cet e-mail et ce mot de passe."}
      </p>

      <form className="form" onSubmit={handleSubmit}>
        <div className="form-row">
          <label className="field">
            <span>Nom complet</span>
            <input value={nom} onChange={(e) => setNom(e.target.value)} required />
          </label>
          <label className="field">
            <span>Rôle</span>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES_GERES_PAR_ADMIN.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label className="field">
            <span>E-mail</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          {!sansMotDePasse && (
            <label className="field">
              <span>
                Mot de passe <span className="field-hint">(6 caractères minimum)</span>
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </label>
          )}
        </div>

        {statut.type && (
          <p className={`alert ${statut.type === "error" ? "alert-error" : "alert-success"}`}>
            {statut.message}
          </p>
        )}

        <button type="submit" className="btn btn-primary" disabled={envoi}>
          {envoi ? "Création..." : "Créer ce compte"}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------

function LigneUtilisateur({ utilisateur, admin, onChange }) {
  const [modificationEnCours, setModificationEnCours] = useState(false);
  const [confirmationRetrait, setConfirmationRetrait] = useState(false);

  async function handleChangerRole(e) {
    const nouveauRole = e.target.value;
    setModificationEnCours(true);
    try {
      await modifierRoleUtilisateur({ utilisateurId: utilisateur.id, nouveauRole, admin });
      onChange();
    } finally {
      setModificationEnCours(false);
    }
  }

  async function handleRetirerAcces() {
    setModificationEnCours(true);
    try {
      await retirerAccesUtilisateur({
        utilisateurId: utilisateur.id,
        emailUtilisateur: utilisateur.email,
        roleUtilisateur: utilisateur.role,
        estSuperAdmin: false, // ce tableau de bord est réservé à l'admin
        admin,
      });
      onChange();
    } finally {
      setModificationEnCours(false);
      setConfirmationRetrait(false);
    }
  }

  const estProtege = utilisateur.role === ROLES.ADMIN || utilisateur.role === ROLES.SUPER_ADMIN;
  const estCaissierProtege = utilisateur.role === ROLES.CAISSIER;

  return (
    <tr>
      <td>{utilisateur.nom || "—"}</td>
      <td>{utilisateur.email}</td>
      <td>
        {estProtege || estCaissierProtege ? (
          <span className="badge badge-solde">{LABEL_ROLE[utilisateur.role]}</span>
        ) : (
          <select value={utilisateur.role} onChange={handleChangerRole} disabled={modificationEnCours}>
            {ROLES_GERES_PAR_ADMIN.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        )}
      </td>
      <td>
        {estCaissierProtege ? (
          <span className="field-hint">Ce compte ne peut pas être retiré depuis cet espace.</span>
        ) : (
          !estProtege &&
          (confirmationRetrait ? (
            <span style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-danger-outline"
                onClick={handleRetirerAcces}
                disabled={modificationEnCours}
              >
                Confirmer
              </button>
              <button className="link-button" onClick={() => setConfirmationRetrait(false)}>
                Annuler
              </button>
            </span>
          ) : (
            <button className="link-button link-button-danger" onClick={() => setConfirmationRetrait(true)}>
              Retirer l'accès
            </button>
          ))
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------

function DemandesCorrection({ admin }) {
  const [demandes, setDemandes] = useState(null);
  const [enCours, setEnCours] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [valeursCorrection, setValeursCorrection] = useState({});

  const chargement = demandes === null;
  const enAttente = (demandes || []).filter((d) => d.statut === "en_attente");
  const historique = (demandes || []).filter((d) => d.statut !== "en_attente");

  useEffect(() => {
    let actif = true;
    listerDemandesCorrection().then((liste) => {
      if (actif) setDemandes(liste);
    });
    return () => {
      actif = false;
    };
  }, []);

  async function rafraichir() {
    setDemandes(await listerDemandesCorrection());
  }

  function setCorrectionValue(demandeId, champ, valeur) {
    setValeursCorrection((prev) => ({
      ...prev,
      [demandeId]: {
        ...prev[demandeId],
        [champ]: valeur,
      },
    }));
  }

  async function handleDecision(demande, decision) {
    setErreur(null);
    setEnCours(demande.id);
    try {
      const valeurs = valeursCorrection[demande.id] || {};
      if (decision === "accordee") {
        if (!valeurs.nouveauMontant || Number(valeurs.nouveauMontant) <= 0) {
          throw new Error("Indique un nouveau montant valide avant d'appliquer la correction.");
        }
      }
      await traiterDemandeCorrection({
        demandeId: demande.id,
        decision,
        admin,
        nouveauMontant: decision === "accordee" ? valeurs.nouveauMontant : null,
        // Le select affiche la première devise tant que l'admin n'y touche pas :
        // on applique la même valeur par défaut ici, sinon la correction serait
        // refusée alors que l'écran montre bien une devise sélectionnée.
        nouvelleDevise: decision === "accordee" ? valeurs.nouvelleDevise || DEVISES[0].id : null,
        motifAdmin: valeurs.motifAdmin || demande.motif || "",
      });
      await rafraichir();
    } catch (err) {
      setErreur(err.message || "Erreur lors du traitement de la demande.");
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div className="card">
      <h2>Demandes de correction</h2>
      <p className="card-hint">
        Une opération ne peut être modifiée qu'à la demande du caissier qui l'a enregistrée. Le
        caissier décrit l'erreur ; c'est toi qui saisis le montant correct. Le nouveau montant
        remplace définitivement l'ancien dans tous les totaux, et le caissier est notifié dans son
        espace.
      </p>
      {erreur && <p className="alert alert-error">{erreur}</p>}

      {/* Ouverte d'office quand il y a du travail en attente : c'est une
          action à faire, pas une archive à consulter. */}
      <SectionRepliable
        titre="À traiter"
        nombre={enAttente.length}
        defautOuvert={enAttente.length > 0}
      >
        {chargement ? (
        <p className="empty-state">Chargement...</p>
      ) : enAttente.length === 0 ? (
        <p className="empty-state">Aucune demande en attente.</p>
      ) : (
        <ul className="timeline-list">
          {enAttente.map((d) => (
            <li key={d.id}>
              <div className="timeline-content" style={{ flex: 1 }}>
                <p>
                  <strong>{d.caissierEmail}</strong> — {d.resume}
                </p>
                {d.montantActuel && (
                  <p className="timeline-details">Montant actuellement enregistré : {d.montantActuel}</p>
                )}
                {d.motif && <p className="timeline-details">Erreur signalée : {d.motif}</p>}
                <p className="timeline-date">{formatDate(d.createdAt)}</p>
              </div>
              <div className="timeline-actions" style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <label className="field" style={{ marginBottom: 0, minWidth: 120 }}>
                    <span>Nouveau montant</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={valeursCorrection[d.id]?.nouveauMontant || ""}
                      onChange={(e) => setCorrectionValue(d.id, "nouveauMontant", e.target.value)}
                      placeholder="Montant"
                    />
                  </label>
                  <label className="field" style={{ marginBottom: 0, minWidth: 120 }}>
                    <span>Devise</span>
                    <select
                      value={valeursCorrection[d.id]?.nouvelleDevise || DEVISES[0].id}
                      onChange={(e) => setCorrectionValue(d.id, "nouvelleDevise", e.target.value)}
                    >
                      {DEVISES.map((devise) => (
                        <option key={devise.id} value={devise.id}>
                          {devise.id}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span>Motif admin (optionnel)</span>
                  <input
                    type="text"
                    value={valeursCorrection[d.id]?.motifAdmin || ""}
                    onChange={(e) => setCorrectionValue(d.id, "motifAdmin", e.target.value)}
                    placeholder="Ex. montant ajusté après vérification"
                  />
                </label>
                <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    className="btn btn-primary"
                    style={{ padding: "6px 12px", fontSize: 12 }}
                    disabled={enCours === d.id}
                    onClick={() => handleDecision(d, "accordee")}
                  >
                    Appliquer la correction
                  </button>
                  <button
                    className="btn btn-danger-outline"
                    style={{ padding: "6px 12px", fontSize: 12 }}
                    disabled={enCours === d.id}
                    onClick={() => handleDecision(d, "refusee")}
                  >
                    Refuser
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      </SectionRepliable>

      <SectionRepliable titre="Historique des corrections" nombre={historique.length}>
        {chargement ? null : historique.length === 0 ? (
        <p className="empty-state">Aucune correction traitée pour le moment.</p>
      ) : (
        <div className="ledger-table-wrap">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Caissier</th>
                <th>Opération</th>
                <th>Erreur signalée</th>
                <th>Statut</th>
                <th>Correction appliquée</th>
              </tr>
            </thead>
            <tbody>
              {historique.map((d) => (
                <tr key={d.id}>
                  <td>{formatDate(d.traiteDate || d.createdAt)}</td>
                  <td>{d.caissierEmail}</td>
                  <td>{d.resume}</td>
                  <td>{d.motif || "—"}</td>
                  <td>
                    <span className={`badge ${classeBadgeStatutDemande(d.statut)}`}>
                      {LABEL_STATUT_DEMANDE[d.statut] || d.statut}
                    </span>
                  </td>
                  <td>
                    {d.correctionResume || "—"}
                    {d.motifAdmin && <div className="field-hint">Note : {d.motifAdmin}</div>}
                    {d.traiteParEmail && <div className="field-hint">Par {d.traiteParEmail}</div>}
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

function traduireErreur(err) {
  const code = err?.code || "";
  if (code.includes("email-already-in-use")) return "Cet e-mail est déjà utilisé par un autre compte.";
  if (code.includes("invalid-email")) return "Adresse e-mail invalide.";
  if (code.includes("weak-password")) return "Mot de passe trop faible (6 caractères minimum).";
  return err.message || "Une erreur est survenue.";
}
