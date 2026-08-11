import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import RapportPersonnes from "../components/RapportPersonnes";
import { useAuth } from "../context/contexteAuth";
import { ROLES } from "../constants/roles";
import {
  calculerVueEnsemble,
  listerAuditLogRecent,
  listerConnexionsRecentes,
  creerCompteUtilisateur,
  envoyerMessageGroupe,
  listerPersonnesEnOrdre,
  listerUtilisateurs,
  obtenirParametresEvenement,
  definirParametresEvenement,
  listerDemandesCorrection,
} from "../services/caisseService";
import VueEnsembleCard from "../components/VueEnsembleCard";
import SectionRepliable from "../components/SectionRepliable";
import { formatDate, LABEL_STATUT_DEMANDE, classeBadgeStatutDemande } from "../utils/format";
import "../styles/ui.css";

const LABEL_ACTION = {
  ajout: "Ajout",
  modification: "Modification",
  suppression: "Suppression",
};

async function chargerSupervision() {
  const [totaux, audit, connexions] = await Promise.all([
    calculerVueEnsemble(),
    listerAuditLogRecent(30),
    listerConnexionsRecentes(30),
  ]);
  return { totaux, audit, connexions };
}

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const [donnees, setDonnees] = useState(null);

  const chargement = donnees === null;
  const totaux = donnees?.totaux;
  const audit = donnees?.audit || [];
  const connexions = donnees?.connexions || [];

  useEffect(() => {
    let actif = true;
    chargerSupervision().then((d) => {
      if (actif) setDonnees(d);
    });
    return () => {
      actif = false;
    };
  }, []);

  return (
    <Layout
      title="Espace super administrateur"
      subtitle="Supervision financière globale, journal d'audit et historique des connexions."
    >
      <section id="vue-ensemble" className="dashboard-section-anchor">
        <VueEnsembleCard
          titre="Vue d'ensemble globale"
          sousTitre="Montants globaux de tous les caissiers, ventilés par frais, sorties et solde restant."
          totaux={totaux}
        />
      </section>

      <section id="creation-admin" className="dashboard-section-anchor">
        <FormCreerAdmin superAdmin={user} />
      </section>

      <section id="parametres-evenement" className="dashboard-section-anchor">
        <ParametresEvenement superAdmin={user} />
      </section>

      <section id="message-groupe" className="dashboard-section-anchor">
        <MessageGroupe superAdmin={user} />
      </section>

      <section id="utilisateurs" className="dashboard-section-anchor">
        <ListeUtilisateurs />
      </section>

      <section id="rapport-personnes" className="dashboard-section-anchor">
        <RapportPersonnes superAdmin={user} utilisateur={user} />
      </section>

      <section id="demandes-correction" className="dashboard-section-anchor">
        <DemandesCorrectionSuperAdmin />
      </section>

      <div id="par-caissier" className="card dashboard-section-anchor">
        <h2>Montant encaissé par caissier</h2>
        <SectionRepliable
          titre="Répartition par caissier"
          sousTitre="Permet de comparer rapidement l'activité de chaque caissier."
          nombre={totaux?.parCaissier.length ?? 0}
        >
          {!totaux || totaux.parCaissier.length === 0 ? (
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

      <div className="grid-2">
        <div id="journal-audit" className="card dashboard-section-anchor">
          <h2>Journal d'audit</h2>
          <SectionRepliable
            titre="30 dernières actions"
            sousTitre="Toutes les actions effectuées dans le système, par qui et quand."
            nombre={audit.length}
          >
          {chargement ? (
            <p className="empty-state">Chargement...</p>
          ) : audit.length === 0 ? (
            <p className="empty-state">Aucune action enregistrée.</p>
          ) : (
            <ul className="timeline-list">
              {audit.map((a) => (
                <li key={a.id}>
                  <span className={`badge badge-${a.typeAction === "suppression" ? "partiel" : "solde"}`}>
                    {LABEL_ACTION[a.typeAction] || a.typeAction}
                  </span>
                  <div className="timeline-content">
                    <p>
                      <strong>{a.utilisateurEmail}</strong> — {a.cible}
                    </p>
                    {a.details && <p className="timeline-details">{a.details}</p>}
                    <p className="timeline-date">{formatDate(a.date)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          </SectionRepliable>
        </div>

        <div id="historique-connexions" className="card dashboard-section-anchor">
          <h2>Historique des connexions</h2>
          <SectionRepliable
            titre="30 dernières connexions"
            sousTitre="Qui s'est connecté au système, et quand."
            nombre={connexions.length}
          >
          {chargement ? (
            <p className="empty-state">Chargement...</p>
          ) : connexions.length === 0 ? (
            <p className="empty-state">Aucune connexion enregistrée.</p>
          ) : (
            <ul className="timeline-list">
              {connexions.map((c) => (
                <li key={c.id}>
                  <div className="timeline-content">
                    <p>
                      <strong>{c.utilisateurEmail}</strong>
                    </p>
                    <p className="timeline-date">{formatDate(c.date)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          </SectionRepliable>
        </div>
      </div>
    </Layout>
  );
}

// ---------------------------------------------------------------------------

function FormCreerAdmin({ superAdmin }) {
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [statut, setStatut] = useState({ type: null, message: "" });
  const [envoi, setEnvoi] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatut({ type: null, message: "" });
    setEnvoi(true);
    try {
      const resultat = await creerCompteUtilisateur({
        nom,
        email,
        role: ROLES.ADMIN,
        admin: superAdmin,
        sansMotDePasse: true,
      });
      setNom("");
      setEmail("");
      setStatut({
        type: resultat.emailActivationEnvoye ? "success" : "error",
        message: resultat.emailActivationEnvoye
          ? `Compte admin créé pour ${email} — e-mails envoyés (activation + lien Firebase).`
          : `Compte admin créé pour ${email}, MAIS l'e-mail de bienvenue a échoué à l'envoi (vérifie la console du navigateur). Le lien Firebase a quand même pu partir séparément.`,
      });
    } catch (err) {
      setStatut({ type: "error", message: err.message || "Une erreur est survenue." });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="card">
      <h2>Créer un administrateur</h2>
      <p className="card-hint">
        Tu ne définis pas son mot de passe : il recevra un e-mail pour le créer lui-même, avant de
        pouvoir se connecter et commencer à gérer les comptes caissiers et autres profils.
      </p>
      <form className="form" onSubmit={handleSubmit}>
        <div className="form-row">
          <label className="field">
            <span>Nom complet</span>
            <input value={nom} onChange={(e) => setNom(e.target.value)} required />
          </label>
          <label className="field">
            <span>E-mail</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
        </div>

        {statut.type && (
          <p className={`alert ${statut.type === "error" ? "alert-error" : "alert-success"}`}>
            {statut.message}
          </p>
        )}

        <button type="submit" className="btn btn-primary" disabled={envoi}>
          {envoi ? "Création..." : "Créer ce compte admin"}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------

function DemandesCorrectionSuperAdmin() {
  const [demandes, setDemandes] = useState(null);

  useEffect(() => {
    let actif = true;
    listerDemandesCorrection().then((liste) => {
      if (actif) setDemandes(liste);
    });
    return () => {
      actif = false;
    };
  }, []);

  return (
    <div className="card">
      <h2>Historique des demandes de correction</h2>
      <p className="card-hint">
        Vue de supervision : demandes envoyées par les caissiers, décisions prises et corrections
        réellement appliquées. Aucune opération ne peut être modifiée en dehors de ce circuit.
      </p>
      <SectionRepliable titre="Toutes les demandes" nombre={demandes?.length ?? 0}>
      {demandes === null ? (
        <p className="empty-state">Chargement...</p>
      ) : demandes.length === 0 ? (
        <p className="empty-state">Aucune demande de correction à afficher.</p>
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
              {demandes.map((d) => (
                <tr key={d.id}>
                  <td>{formatDate(d.traiteDate || d.createdAt)}</td>
                  <td>{d.caissierEmail}</td>
                  <td>
                    {d.resume}
                    {d.montantActuel && (
                      <div className="field-hint">Montant signalé : {d.montantActuel}</div>
                    )}
                  </td>
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

function MessageGroupe({ superAdmin }) {
  const [message, setMessage] = useState("");
  const [nbDestinataires, setNbDestinataires] = useState(null);
  const [progression, setProgression] = useState(null); // { envoyes, total }
  const [statut, setStatut] = useState({ type: null, message: "" });
  const [envoi, setEnvoi] = useState(false);
  const [confirmation, setConfirmation] = useState(false);

  async function handlePreparerEnvoi() {
    const destinataires = await listerPersonnesEnOrdre();
    setNbDestinataires(destinataires.length);
    setConfirmation(true);
  }

  async function handleEnvoyer() {
    setConfirmation(false);
    setEnvoi(true);
    setStatut({ type: null, message: "" });
    setProgression({ envoyes: 0, total: nbDestinataires || 0 });
    try {
      const resultat = await envoyerMessageGroupe({
        message,
        superAdmin,
        onProgression: (envoyes, total) => setProgression({ envoyes, total }),
      });
      setStatut({
        type: resultat.echecs.length > 0 ? "error" : "success",
        message:
          resultat.echecs.length > 0
            ? `Envoyé à ${resultat.total - resultat.echecs.length}/${resultat.total} — échec pour : ${resultat.echecs.join(", ")}`
            : `Message envoyé avec succès à ${resultat.total} personne(s).`,
      });
    } catch (err) {
      setStatut({ type: "error", message: err.message || "Une erreur est survenue." });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="card">
      <h2>Message groupé</h2>
      <p className="card-hint">
        Écris un message (ex. rappel la veille de la fête) et envoie-le automatiquement par e-mail
        à toutes les personnes déjà en règle avec leurs frais. Garde cet onglet ouvert pendant
        l'envoi — il se fait un par un depuis ton navigateur, sans serveur en arrière-plan.
      </p>

      <div className="form">
        <label className="field">
          <span>Message</span>
          <textarea
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ex. : La fête MAYUNDO Party a lieu demain à 18h. N'oubliez pas votre billet !"
            style={{
              padding: "9px 11px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              fontSize: 14,
              fontFamily: "var(--font-body)",
              resize: "vertical",
            }}
          />
        </label>

        {progression && (
          <p className="field-hint">
            Envoi en cours... {progression.envoyes} / {progression.total}
          </p>
        )}

        {statut.type && (
          <p className={`alert ${statut.type === "error" ? "alert-error" : "alert-success"}`}>
            {statut.message}
          </p>
        )}

        {!confirmation ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={envoi || !message.trim()}
            onClick={handlePreparerEnvoi}
            style={{ alignSelf: "flex-start" }}
          >
            Préparer l'envoi
          </button>
        ) : (
          <div className="new-payer-hint">
            <p className="field-hint" style={{ marginBottom: 8 }}>
              Ce message sera envoyé à <strong>{nbDestinataires}</strong> personne(s) en règle.
              Confirmer ?
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-primary" onClick={handleEnvoyer} disabled={envoi}>
                {envoi ? "Envoi..." : "Confirmer l'envoi"}
              </button>
              <button type="button" className="link-button" onClick={() => setConfirmation(false)}>
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const LABEL_ROLE_LISTE = {
  super_admin: "Super administrateur",
  admin: "Administrateur",
  caissier: "Caissier",
  president: "Président de la fête",
  cp: "Chef de promotion",
  membre: "Membre du comité",
};

function ListeUtilisateurs() {
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [filtreRole, setFiltreRole] = useState("tous");
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    listerUtilisateurs().then((liste) => {
      setUtilisateurs(liste);
      setChargement(false);
    });
  }, []);

  const filtres = utilisateurs.filter((u) => filtreRole === "tous" || u.role === filtreRole);

  return (
    <div className="card">
      <h2>Liste des utilisateurs</h2>
      <p className="card-hint">
        Tous les comptes du système : admins, caissiers, membres du comité, président, Chef de promotion.
      </p>

      <label className="field" style={{ maxWidth: 260, marginBottom: 16 }}>
        <span>Filtrer par rôle</span>
        <select value={filtreRole} onChange={(e) => setFiltreRole(e.target.value)}>
          <option value="tous">Tous les rôles</option>
          {Object.entries(LABEL_ROLE_LISTE).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <SectionRepliable titre="Comptes" nombre={filtres.length}>
      {chargement ? (
        <p className="empty-state">Chargement...</p>
      ) : filtres.length === 0 ? (
        <p className="empty-state">Aucun utilisateur pour ce filtre.</p>
      ) : (
        <div className="ledger-table-wrap">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>E-mail</th>
                <th>Rôle</th>
              </tr>
            </thead>
            <tbody>
              {filtres.map((u) => (
                <tr key={u.id}>
                  <td>{u.nom || "—"}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className="badge badge-solde">{LABEL_ROLE_LISTE[u.role] || u.role}</span>
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

function ParametresEvenement({ superAdmin }) {
  const [nomActivite, setNomActivite] = useState("");
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("");
  const [statut, setStatut] = useState({ type: null, message: "" });
  const [envoi, setEnvoi] = useState(false);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    obtenirParametresEvenement().then((p) => {
      setNomActivite(p.nomActivite);
      setDate(p.date);
      setHeure(p.heure);
      setChargement(false);
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setEnvoi(true);
    setStatut({ type: null, message: "" });
    try {
      await definirParametresEvenement({ nomActivite, date, heure, superAdmin });
      setStatut({ type: "success", message: "Paramètres enregistrés — utilisés dès le prochain e-mail envoyé." });
    } catch (err) {
      setStatut({ type: "error", message: err.message || "Une erreur est survenue." });
    } finally {
      setEnvoi(false);
    }
  }

  if (chargement) {
    return (
      <div className="card">
        <h2>Paramètres de l'événement</h2>
        <p className="empty-state">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Paramètres de l'événement</h2>
      <p className="card-hint">
        Ces informations sont insérées automatiquement dans les e-mails de confirmation de
        paiement (nom de l'activité, date, heure).
      </p>
      <form className="form" onSubmit={handleSubmit}>
        <div className="form-row">
          <label className="field">
            <span>Nom de l'activité</span>
            <input value={nomActivite} onChange={(e) => setNomActivite(e.target.value)} required />
          </label>
          <label className="field">
            <span>Date</span>
            <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="ex. 15 août 2026" />
          </label>
          <label className="field">
            <span>Heure</span>
            <input value={heure} onChange={(e) => setHeure(e.target.value)} placeholder="ex. 18h00" />
          </label>
        </div>
        {statut.type && (
          <p className={`alert ${statut.type === "error" ? "alert-error" : "alert-success"}`}>
            {statut.message}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={envoi} style={{ alignSelf: "flex-start" }}>
          {envoi ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
