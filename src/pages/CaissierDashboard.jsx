import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { useAuth } from "../context/contexteAuth";
import { TYPES_FRAIS, IDS_FRAIS_INVITE, TOTAL_FRAIS_INVITE } from "../constants/typesFrais";
import { DEVISES } from "../constants/devises";
import {
  listerPersonnes,
  creerPersonne,
  getSoldesParType,
  getTotalPayeInvite,
  enregistrerPaiement,
  enregistrerSortie,
  listerMesPaiementsRecents,
  listerMesSortiesRecentes,
  listerMembresComite,
  listerPersonnesServiesPar,
  demanderCorrection,
  listerMesDemandesCorrection,
  envoyerRecapitulatifPaiement,
  calculerVueEnsemble,
  montantEffectifUSD,
} from "../services/caisseService";
import VueEnsembleCard from "../components/VueEnsembleCard";
import SectionRepliable from "../components/SectionRepliable";
import CelluleInvitation from "../components/CelluleInvitation";
import { FILTRES_INVITATION } from "../constants/invitation";
import { exporterPDF, exporterExcel } from "../services/exportService";
import {
  preparerExportEncaissementsCaissier,
  agregerEncaissementsParPersonne,
  CATEGORIE_COMITE,
  CATEGORIE_INVITE,
} from "../services/rapportsExport";
import {
  formatDateCourte,
  libelleDevise,
  LABEL_STATUT_DEMANDE,
  classeBadgeStatutDemande,
} from "../utils/format";
import "./CaissierDashboard.css";

// Un échec de lecture ne doit pas laisser un "Chargement..." éternel à l'écran :
// le caissier doit comprendre ce qui bloque et pouvoir le signaler.
function messageErreurChargement(err) {
  if (err?.code === "permission-denied") {
    return "Accès refusé par la base de données. Vérifie auprès de l'administrateur que ton compte a bien le rôle caissier et que les règles de sécurité sont à jour.";
  }
  if (err?.code === "unavailable") {
    return "Connexion à la base impossible. Vérifie ta connexion internet puis recharge la page.";
  }
  return `Impossible de charger tes données (${err?.code || err?.message || "erreur inconnue"}).`;
}

// Chargement défini hors du composant : l'effet de montage peut l'appeler sans
// que React n'ait à le lister dans ses dépendances, et le même code sert au
// rafraîchissement déclenché après une saisie.
async function chargerDonneesCaissier(caissierId) {
  const [personnes, membresComite, paiements, sorties, demandes, vueEnsemble, personnesServies] =
    await Promise.all([
      listerPersonnes(),
      listerMembresComite(),
      listerMesPaiementsRecents(caissierId, 200),
      listerMesSortiesRecentes(caissierId, 200),
      listerMesDemandesCorrection(caissierId),
      calculerVueEnsemble({ caissierId }),
      listerPersonnesServiesPar(caissierId),
    ]);

  const demandesParEntite = {};
  demandes.forEach((d) => {
    demandesParEntite[d.entiteId] = d;
  });

  return {
    personnes,
    membresComite,
    paiements,
    sorties,
    demandes,
    demandesParEntite,
    vueEnsemble,
    personnesServies,
  };
}

export default function CaissierDashboard() {
  const { user } = useAuth();

  const [ongletMobile, setOngletMobile] = useState("vue");
  const [donnees, setDonnees] = useState(null);
  const [erreurChargement, setErreurChargement] = useState(null);
  const [recherche, setRecherche] = useState("");
  const [filtreFrais, setFiltreFrais] = useState("tous");
  const [filtreInvitation, setFiltreInvitation] = useState("tous");

  const chargement = donnees === null && !erreurChargement;

  useEffect(() => {
    let actif = true;
    chargerDonneesCaissier(user.uid)
      .then((d) => {
        if (actif) setDonnees(d);
      })
      .catch((err) => {
        console.error("Chargement de l'espace caissier :", err);
        if (actif) setErreurChargement(err);
      });
    return () => {
      actif = false;
    };
  }, [user.uid]);

  async function rafraichirDonnees() {
    try {
      setDonnees(await chargerDonneesCaissier(user.uid));
      setErreurChargement(null);
    } catch (err) {
      console.error("Rafraîchissement de l'espace caissier :", err);
      setErreurChargement(err);
    }
  }

  const filtre = recherche.trim().toLowerCase();

  const personnesServiesFiltrees = useMemo(() => {
    return (donnees?.personnesServies || []).filter((p) => {
      if (filtre && !p.nom.toLowerCase().includes(filtre)) return false;
      if (filtreInvitation !== "tous" && p.statutInvitation !== filtreInvitation) return false;
      if (filtreFrais !== "tous") {
        const frais = p.detailFrais.find((f) => f.id === filtreFrais);
        if (!frais || frais.paye <= 0) return false;
      }
      return true;
    });
  }, [donnees, filtre, filtreFrais, filtreInvitation]);

  const paiementsFiltres = useMemo(() => {
    return (donnees?.paiements || []).filter((p) => {
      if (filtre && !(p.personneNom || "").toLowerCase().includes(filtre)) return false;
      if (filtreFrais !== "tous" && p.typeFraisId !== filtreFrais) return false;
      return true;
    });
  }, [donnees, filtre, filtreFrais]);

  const sortiesFiltrees = useMemo(() => {
    const liste = donnees?.sorties || [];
    if (!filtre) return liste;
    return liste.filter((s) => (s.motif || "").toLowerCase().includes(filtre));
  }, [donnees, filtre]);

  // Notification : demandes que l'admin a fini de traiter (corrigées ou refusées).
  const demandesTraitees = useMemo(
    () => (donnees?.demandes || []).filter((d) => d.statut === "traitee" || d.statut === "refusee"),
    [donnees]
  );

  return (
    <Layout
      title="Espace caissier"
      subtitle="Enregistre les paiements et les sorties de caisse."
    >
      <div className="mobile-tabs" role="tablist" aria-label="Navigation mobile caissier">
        <button type="button" className={`mobile-tab${ongletMobile === "vue" ? " active" : ""}`} onClick={() => setOngletMobile("vue")}>Vue d'ensemble</button>
        <button type="button" className={`mobile-tab${ongletMobile === "paiement" ? " active" : ""}`} onClick={() => setOngletMobile("paiement")}>Paiement</button>
        <button type="button" className={`mobile-tab${ongletMobile === "sortie" ? " active" : ""}`} onClick={() => setOngletMobile("sortie")}>Sortie</button>
        <button type="button" className={`mobile-tab${ongletMobile === "historique" ? " active" : ""}`} onClick={() => setOngletMobile("historique")}>Historique</button>
      </div>

      <div className="mobile-tab-panels">
        <div className={`mobile-tab-panel${ongletMobile === "vue" ? " active" : ""}`}>
          <section id="vue-ensemble" className="dashboard-section-anchor">
            <VueEnsembleCard
              titre="Vue d'ensemble personnelle"
              sousTitre="Seulement tes encaissements, tes sorties et ton solde restant."
              totaux={donnees?.vueEnsemble}
            />
          </section>
        </div>

        <div className={`mobile-tab-panel${ongletMobile === "paiement" ? " active" : ""}`}>
          <section id="paiements" className="dashboard-section-anchor">
            <FormPaiement
              personnes={donnees?.personnes || []}
              membresComite={donnees?.membresComite || []}
              caissier={user}
              onSuccess={rafraichirDonnees}
              onNouvellePersonne={rafraichirDonnees}
            />
          </section>
        </div>

        <div className={`mobile-tab-panel${ongletMobile === "sortie" ? " active" : ""}`}>
          <section id="sorties" className="dashboard-section-anchor">
            <FormSortie caissier={user} onSuccess={rafraichirDonnees} />
          </section>
        </div>

        <div className={`mobile-tab-panel${ongletMobile === "historique" ? " active" : ""}`}>
          <div id="historique" className="card dashboard-section-anchor">
            <h2>Historique</h2>
            <p className="card-hint">
              La situation des personnes que tu as encaissées, puis le détail de chacune de tes
              opérations.
            </p>

            <div className="form-row" style={{ marginBottom: 12 }}>
              <label className="field">
                <span>Rechercher</span>
                <input
                  type="text"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Nom d'une personne, motif d'une sortie..."
                />
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
                <select
                  value={filtreInvitation}
                  onChange={(e) => setFiltreInvitation(e.target.value)}
                >
                  {FILTRES_INVITATION.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {!chargement && !erreurChargement && (
              <ExportsCaissier
                paiements={donnees.paiements}
                personnesServies={donnees.personnesServies}
                caissier={user}
              />
            )}

            {erreurChargement ? (
              <p className="alert alert-error">{messageErreurChargement(erreurChargement)}</p>
            ) : chargement ? (
              <p className="empty-state">Chargement...</p>
            ) : (
              <>
                <TablePersonnesServies
                  personnes={personnesServiesFiltrees}
                  caissier={user}
                  onChange={rafraichirDonnees}
                />
                <TableMesPaiements
                  paiements={paiementsFiltres}
                  demandesParEntite={donnees.demandesParEntite}
                  caissier={user}
                  onChange={rafraichirDonnees}
                />
                <TableMesSorties
                  sorties={sortiesFiltrees}
                  demandesParEntite={donnees.demandesParEntite}
                  caissier={user}
                  onChange={rafraichirDonnees}
                />
                <TableMesDemandes demandes={donnees.demandes} demandesTraitees={demandesTraitees} />
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

// ---------------------------------------------------------------------------

// Situation complète des personnes encaissées par ce caissier. Chaque colonne
// de frais affiche le CUMUL de toutes les tranches versées, pas la première.
// Boutons d'export du caissier : uniquement SES encaissements, séparés en
// invités et membres du comité. Le total du document correspond exactement à
// sa vue d'ensemble personnelle.
function ExportsCaissier({ paiements, personnesServies, caissier }) {
  const agregees = useMemo(
    () => agregerEncaissementsParPersonne(paiements, personnesServies),
    [paiements, personnesServies]
  );

  async function exporter(categorie, format) {
    const params = preparerExportEncaissementsCaissier({
      personnes: agregees,
      categorie,
      caissierEmail: caissier.email,
    });
    if (format === "excel") await exporterExcel(params);
    else await exporterPDF(params);
  }

  const nbInvites = agregees.filter((p) => p.categorie === CATEGORIE_INVITE).length;
  const nbComite = agregees.filter((p) => p.categorie === CATEGORIE_COMITE).length;

  return (
    <div className="export-buttons-grid" style={{ marginBottom: 16 }}>
      <div className="export-buttons-group">
        <span className="field-hint">Mes encaissements — invités ({nbInvites})</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-primary btn-compact"
            onClick={() => exporter(CATEGORIE_INVITE, "pdf")}
          >
            PDF
          </button>
          <button
            className="btn btn-primary btn-compact"
            onClick={() => exporter(CATEGORIE_INVITE, "excel")}
          >
            Excel
          </button>
        </div>
      </div>
      <div className="export-buttons-group">
        <span className="field-hint">Mes encaissements — comité ({nbComite})</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-primary btn-compact"
            onClick={() => exporter(CATEGORIE_COMITE, "pdf")}
          >
            PDF
          </button>
          <button
            className="btn btn-primary btn-compact"
            onClick={() => exporter(CATEGORIE_COMITE, "excel")}
          >
            Excel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TablePersonnesServies({ personnes, caissier, onChange }) {
  return (
    <SectionRepliable
      titre="Personnes ayant déjà payé"
      sousTitre="Montants cumulés : toutes les tranches d'un même frais sont additionnées (4 $ + 5 $ + 1 $ pour la fête = 10 $, donc soldé)."
      nombre={personnes.length}
    >
      {personnes.length === 0 ? (
        <p className="empty-state">Aucune personne à afficher.</p>
      ) : (
        <div className="ledger-table-wrap">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Personne</th>
                <th>Catégorie</th>
                {TYPES_FRAIS.map((t) => (
                  <th key={t.id}>{t.id === "comite" ? "Comité" : t.label}</th>
                ))}
                <th>Statut</th>
                <th>Invitation</th>
                <th style={{ textAlign: "right" }}>Total payé</th>
                <th>Amené par</th>
              </tr>
            </thead>
            <tbody>
              {personnes.map((personne) => (
                <tr key={personne.id}>
                  <td>
                    {personne.nom}
                    {personne.email && (
                      <div className="field-hint" style={{ marginTop: 4 }}>{personne.email}</div>
                    )}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        personne.categorie === "Membre du comité" ? "badge-partiel" : "badge-solde"
                      }`}
                    >
                      {personne.categorie}
                    </span>
                  </td>
                  {personne.detailFrais.map((f) => (
                    <td key={f.id} className="ledger-amount in">
                      {f.paye.toFixed(2)} / {f.du} $
                    </td>
                  ))}
                  <td>
                    <span
                      className={`badge ${
                        personne.statutGlobal === "Soldé"
                          ? "badge-solde"
                          : personne.statutGlobal === "Partiel"
                          ? "badge-partiel"
                          : "badge-annule"
                      }`}
                    >
                      {personne.statutGlobal}
                    </span>
                  </td>
                  <td>
                    <CelluleInvitation
                      personne={personne}
                      utilisateur={caissier}
                      onChange={onChange}
                    />
                  </td>
                  <td className="ledger-amount in" style={{ textAlign: "right" }}>
                    {personne.totalGeneral.toFixed(2)} $
                  </td>
                  <td>{personne.amenePar || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionRepliable>
  );
}

// ---------------------------------------------------------------------------

// Une ligne = une opération réellement enregistrée (une tranche). C'est ce
// niveau de détail qui permet de signaler précisément la bonne erreur.
function TableMesPaiements({ paiements, demandesParEntite, caissier, onChange }) {
  return (
    <SectionRepliable
      titre="Mes encaissements"
      sousTitre="Chaque ligne est une tranche encaissée. En cas d'erreur, signale-la : l'admin saisira lui-même le montant correct."
      nombre={paiements.length}
    >
      {paiements.length === 0 ? (
        <p className="empty-state">Aucun encaissement.</p>
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
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paiements.map((p) => (
                <tr key={p.id} style={p.annule ? { opacity: 0.6 } : undefined}>
                  <td>{formatDateCourte(p.createdAt)}</td>
                  <td>
                    {p.personneNom}
                    {p.amenePar && <div className="field-hint">Amené par : {p.amenePar}</div>}
                  </td>
                  <td>
                    {p.typeFraisLabel}
                    {p.corrige && <span className="badge badge-annule">Corrigé</span>}
                    {p.annule && <span className="badge badge-annule">Annulé</span>}
                  </td>
                  <td className="ledger-amount in" style={{ textAlign: "right" }}>
                    {p.montant} {libelleDevise(p.devise)}
                    {p.corrige && (
                      <div className="field-hint">
                        avant : {p.ancienMontant} {libelleDevise(p.ancienneDevise)}
                      </div>
                    )}
                  </td>
                  <td className="ledger-amount in" style={{ textAlign: "right" }}>
                    {montantEffectifUSD(p).toFixed(2)} $
                  </td>
                  <td>
                    <ActionSignalement
                      type="paiement"
                      entiteId={p.id}
                      resume={`Paiement de ${p.personneNom} (${p.typeFraisLabel})`}
                      montantActuel={`${p.montant} ${libelleDevise(p.devise)}`}
                      operation={p}
                      demande={demandesParEntite[p.id]}
                      caissier={caissier}
                      onChange={onChange}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionRepliable>
  );
}

// ---------------------------------------------------------------------------

function TableMesSorties({ sorties, demandesParEntite, caissier, onChange }) {
  return (
    <SectionRepliable
      titre="Mes sorties de caisse"
      sousTitre="Les dépenses que tu as enregistrées."
      nombre={sorties.length}
    >
      {sorties.length === 0 ? (
        <p className="empty-state">Aucune sortie.</p>
      ) : (
        <div className="ledger-table-wrap">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Motif</th>
                <th style={{ textAlign: "right" }}>Montant</th>
                <th style={{ textAlign: "right" }}>Équivalent</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sorties.map((s) => (
                <tr key={s.id} style={s.annule ? { opacity: 0.6 } : undefined}>
                  <td>{formatDateCourte(s.createdAt)}</td>
                  <td>
                    {s.motif}
                    {s.corrige && <span className="badge badge-annule">Corrigé</span>}
                    {s.annule && <span className="badge badge-annule">Annulé</span>}
                  </td>
                  <td className="ledger-amount out" style={{ textAlign: "right" }}>
                    {s.montant} {libelleDevise(s.devise)}
                    {s.corrige && (
                      <div className="field-hint">
                        avant : {s.ancienMontant} {libelleDevise(s.ancienneDevise)}
                      </div>
                    )}
                  </td>
                  <td className="ledger-amount out" style={{ textAlign: "right" }}>
                    {montantEffectifUSD(s).toFixed(2)} $
                  </td>
                  <td>
                    <ActionSignalement
                      type="sortie"
                      entiteId={s.id}
                      resume={`Sortie : ${s.motif}`}
                      montantActuel={`${s.montant} ${libelleDevise(s.devise)}`}
                      operation={s}
                      demande={demandesParEntite[s.id]}
                      caissier={caissier}
                      onChange={onChange}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionRepliable>
  );
}

// ---------------------------------------------------------------------------

// Historique des demandes du caissier — sa notification : il voit ici que
// l'admin a traité (ou refusé) ce qu'il avait signalé, et avec quel montant.
// La section s'ouvre d'elle-même quand l'admin vient de traiter quelque chose :
// c'est une réponse qui lui est adressée, il ne doit pas avoir à la chercher.
function TableMesDemandes({ demandes, demandesTraitees }) {
  return (
    <SectionRepliable
      titre="Mes demandes de correction"
      nombre={demandes.length}
      defautOuvert={demandesTraitees.length > 0}
    >
      {demandesTraitees.length > 0 && (
        <p className="alert alert-success">
          {demandesTraitees.length === 1
            ? "1 de tes demandes a été traitée par l'administrateur."
            : `${demandesTraitees.length} de tes demandes ont été traitées par l'administrateur.`}{" "}
          Le détail est dans le tableau ci-dessous.
        </p>
      )}
      {demandes.length === 0 ? (
        <p className="empty-state">Tu n'as signalé aucune erreur.</p>
      ) : (
        <div className="ledger-table-wrap">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Opération signalée</th>
                <th>Mon motif</th>
                <th>Statut</th>
                <th>Décision de l'admin</th>
              </tr>
            </thead>
            <tbody>
              {demandes.map((d) => (
                <tr key={d.id}>
                  <td>{formatDateCourte(d.createdAt)}</td>
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
                    {d.statut === "traitee" && d.correctionResume && (
                      <div>{d.correctionResume}</div>
                    )}
                    {d.motifAdmin && <div className="field-hint">Note : {d.motifAdmin}</div>}
                    {d.traiteParEmail && (
                      <div className="field-hint">Par {d.traiteParEmail}</div>
                    )}
                    {d.statut === "en_attente" && "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionRepliable>
  );
}

// ---------------------------------------------------------------------------

// Le caissier décrit l'erreur, sans saisir aucun montant : c'est l'admin qui
// entrera le montant correct depuis son espace.
function ActionSignalement({ type, entiteId, resume, montantActuel, operation, demande, caissier, onChange }) {
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  async function handleSignaler() {
    if (!motif.trim()) {
      setErreur("Explique l'erreur avant d'envoyer.");
      return;
    }
    setEnvoi(true);
    setErreur("");
    try {
      await demanderCorrection({ type, entiteId, resume, montantActuel, motif, caissier });
      setOuvert(false);
      setMotif("");
      await onChange();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  if (operation.annule) return <span className="field-hint">Opération annulée</span>;

  if (demande) {
    if (demande.statut === "traitee") {
      return (
        <span className="field-hint">
          Corrigée par l'admin{demande.correctionResume ? ` — ${demande.correctionResume}` : ""}
        </span>
      );
    }
    if (demande.statut === "refusee") {
      return (
        <span className="correction-box">
          <span className="field-hint">Refusée{demande.motifAdmin ? ` — ${demande.motifAdmin}` : ""}</span>
          {ouvert ? (
            <ChampMotif
              motif={motif}
              setMotif={setMotif}
              erreur={erreur}
              envoi={envoi}
              onEnvoyer={handleSignaler}
              onFermer={() => setOuvert(false)}
            />
          ) : (
            <button className="link-button link-button-danger" onClick={() => setOuvert(true)}>
              Signaler à nouveau
            </button>
          )}
        </span>
      );
    }
    return <span className="field-hint">{LABEL_STATUT_DEMANDE[demande.statut]}</span>;
  }

  if (ouvert) {
    return (
      <ChampMotif
        motif={motif}
        setMotif={setMotif}
        erreur={erreur}
        envoi={envoi}
        onEnvoyer={handleSignaler}
        onFermer={() => setOuvert(false)}
      />
    );
  }

  return (
    <button className="link-button link-button-danger" onClick={() => setOuvert(true)}>
      Signaler une erreur
    </button>
  );
}

function ChampMotif({ motif, setMotif, erreur, envoi, onEnvoyer, onFermer }) {
  return (
    <span className="correction-box">
      <input
        type="text"
        placeholder="Quelle est l'erreur ?"
        value={motif}
        onChange={(e) => setMotif(e.target.value)}
      />
      <button className="btn btn-danger-outline" onClick={onEnvoyer} disabled={envoi}>
        {envoi ? "..." : "Envoyer"}
      </button>
      <button className="link-button" onClick={onFermer}>
        ×
      </button>
      {erreur && <span className="field-hint">{erreur}</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------

let prochaineCleLigne = 1;
function creerLignePaiement() {
  return { cle: `ligne-${prochaineCleLigne++}`, typeFraisId: TYPES_FRAIS[0].id, devise: DEVISES[0].id, montant: "" };
}

function FormPaiement({ personnes, membresComite, caissier, onSuccess, onNouvellePersonne }) {
  const [recherche, setRecherche] = useState("");
  const [personneId, setPersonneId] = useState("");
  const [nouvelEmail, setNouvelEmail] = useState("");
  const [amenePar, setAmenePar] = useState("");
  const [listeAmeneParOuverte, setListeAmeneParOuverte] = useState(false);
  const [membrePayeurId, setMembrePayeurId] = useState("");
  const [soldes, setSoldes] = useState(null); // { personneId, restants: { typeFraisId -> restant ($) } }
  const [lignes, setLignes] = useState([creerLignePaiement()]);
  const [statut, setStatut] = useState({ type: null, message: "" });
  const [envoi, setEnvoi] = useState(false);

  const personne = useMemo(
    () => personnes.find((p) => p.id === personneId),
    [personnes, personneId]
  );

  const suggestions = useMemo(() => {
    if (!recherche.trim() || personneId) return [];
    const r = recherche.trim().toLowerCase();
    return personnes.filter((p) => p.nom.toLowerCase().includes(r)).slice(0, 6);
  }, [recherche, personnes, personneId]);

  const estNouveauPayeur =
    !personneId &&
    recherche.trim().length > 0 &&
    !personnes.some((p) => p.nom.toLowerCase() === recherche.trim().toLowerCase());

  // Un invité est concerné par "amené par" dès qu'au moins une ligne n'est
  // pas le frais de comité (que le membre paie lui-même).
  const afficherAmenePar = lignes.some((l) => l.typeFraisId !== "comite");

  // Recalcule les soldes restants (en $) pour chaque type de frais dès
  // qu'une personne est sélectionnée — une seule requête Firestore.
  // Le résultat est étiqueté avec l'id de la personne : tant que la nouvelle
  // valeur n'est pas arrivée, on n'affiche rien plutôt que le reste à payer
  // de la personne précédente.
  useEffect(() => {
    if (!personne) return undefined;
    let actif = true;
    getSoldesParType(personne.id).then((dejaPaye) => {
      if (!actif) return;
      setSoldes({
        personneId: personne.id,
        restants: Object.fromEntries(
          TYPES_FRAIS.map((t) => [t.id, t.montant - (dejaPaye[t.id] || 0)])
        ),
      });
    });
    return () => {
      actif = false;
    };
  }, [personne]);

  // Attention : tester soldes?.personneId === personne?.id ne suffit pas —
  // sans personne sélectionnée et sans solde chargé, les deux valent undefined
  // et la comparaison est vraie alors qu'il n'y a rien à lire.
  const soldesParType =
    personne && soldes?.personneId === personne.id ? soldes.restants : {};

  function selectionnerPersonne(p) {
    setPersonneId(p.id);
    setRecherche(p.nom);
  }

  function reinitialiserPersonne() {
    setPersonneId("");
    setRecherche("");
    setNouvelEmail("");
    setMembrePayeurId("");
  }

  // Sélection rapide d'un membre du comité comme payeur (utile pour le frais
  // de comité) : si une "personne" existe déjà avec son e-mail, on la
  // sélectionne ; sinon on pré-remplit nom + e-mail pour création automatique.
  function selectionnerMembreCommePersonne(membreId) {
    setMembrePayeurId(membreId);
    const membre = membresComite.find((m) => m.id === membreId);
    if (!membre) return;
    const personneExistante = personnes.find(
      (p) => p.email && membre.email && p.email.toLowerCase() === membre.email.toLowerCase()
    );
    if (personneExistante) {
      selectionnerPersonne(personneExistante);
    } else {
      setPersonneId("");
      setRecherche(membre.nom);
      setNouvelEmail(membre.email || "");
    }
    // Un membre du comité paie normalement son propre frais de comité : on
    // configure directement la première ligne sur ce type, ce qui fait aussi
    // disparaître le champ "amené par" (qui ne concerne que les invités).
    setLignes((prev) => prev.map((l, i) => (i === 0 ? { ...l, typeFraisId: "comite" } : l)));
    setAmenePar("");
    setListeAmeneParOuverte(false);
  }

  function selectionnerAmenePar(nom) {
    setAmenePar(nom);
    setListeAmeneParOuverte(false);
  }

  function ajouterLigne() {
    setLignes((prev) => [...prev, creerLignePaiement()]);
  }

  function retirerLigne(cle) {
    setLignes((prev) => (prev.length > 1 ? prev.filter((l) => l.cle !== cle) : prev));
  }

  function modifierLigne(cle, champ, valeur) {
    setLignes((prev) => prev.map((l) => (l.cle === cle ? { ...l, [champ]: valeur } : l)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatut({ type: null, message: "" });

    if (!recherche.trim()) {
      setStatut({ type: "error", message: "Indique le nom de la personne qui paie." });
      return;
    }
    if (lignes.some((l) => !l.montant || Number(l.montant) <= 0)) {
      setStatut({ type: "error", message: "Indique un montant valide pour chaque frais ajouté." });
      return;
    }

    setEnvoi(true);
    try {
      let personneActive = personne;
      if (!personneActive) {
        // Évite les doublons si le nom existe déjà mais n'a pas été cliqué
        // dans la liste de suggestions.
        const existante = personnes.find(
          (p) => p.nom.toLowerCase() === recherche.trim().toLowerCase()
        );
        if (existante) {
          personneActive = existante;
        } else {
          personneActive = await creerPersonne({ nom: recherche, email: nouvelEmail });
          await onNouvellePersonne();
        }
      }

      const concerneInvite = lignes.some((l) => IDS_FRAIS_INVITE.includes(l.typeFraisId));
      const totalInviteAvant = concerneInvite ? await getTotalPayeInvite(personneActive.id) : 0;

      const resultats = [];
      for (const ligne of lignes) {
        const typeFrais = TYPES_FRAIS.find((t) => t.id === ligne.typeFraisId);
        const resultat = await enregistrerPaiement({
          personne: personneActive,
          typeFraisId: ligne.typeFraisId,
          montant: Number(ligne.montant),
          devise: ligne.devise,
          caissier,
          amenePar: ligne.typeFraisId !== "comite" ? amenePar : "",
        });
        resultats.push({ label: typeFrais.label, typeFraisId: ligne.typeFraisId, ...resultat });
      }

      // Invité : e-mail UNIQUEMENT à 20 $ au total. Comité : e-mail quand 30 $ soldés.
      // Les deux branches sont indépendantes (au cas où un enregistrement mixte).
      let emailEnvoye = false;
      let emailAttendu = false;

      if (concerneInvite) {
        const totalInviteApres = await getTotalPayeInvite(personneActive.id);
        const vientDAtteindre20 =
          totalInviteApres >= TOTAL_FRAIS_INVITE - 0.01 &&
          totalInviteAvant < TOTAL_FRAIS_INVITE - 0.01;
        if (vientDAtteindre20) {
          emailAttendu = true;
          emailEnvoye = await envoyerRecapitulatifPaiement({
            personne: personneActive,
            elementsSoldes: TYPES_FRAIS.filter((t) => IDS_FRAIS_INVITE.includes(t.id)).map((t) => ({
              typeFraisId: t.id,
              typeFraisLabel: t.label,
              montant: t.montant,
            })),
          });
        }
      }

      const comiteSolde = resultats.find((r) => r.typeFraisId === "comite" && r.estSolde);
      if (comiteSolde) {
        emailAttendu = true;
        const ok = await envoyerRecapitulatifPaiement({
          personne: personneActive,
          elementsSoldes: [
            {
              typeFraisId: "comite",
              typeFraisLabel: comiteSolde.label,
              montant: comiteSolde.typeFraisMontant,
            },
          ],
        });
        emailEnvoye = emailEnvoye || ok;
      }

      setLignes([creerLignePaiement()]);
      setAmenePar("");
      setListeAmeneParOuverte(false);
      setStatut({
        type: emailAttendu && !emailEnvoye ? "error" : "success",
        message:
          resultats
            .map((r) => (r.estSolde ? `${r.label} : entièrement soldé.` : `${r.label} : reste ${r.restant.toFixed(2)} $.`))
            .join(" — ") +
          (emailAttendu
            ? emailEnvoye
              ? " 📧 E-mail de confirmation envoyé."
              : " ⚠️ L'e-mail a échoué (voir console)."
            : concerneInvite
              ? ` (total invité : en cours — e-mail à ${TOTAL_FRAIS_INVITE} $).`
              : ""),
      });
      onSuccess();
    } catch (err) {
      setStatut({ type: "error", message: err.message });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="card">
      <h2>Enregistrer un paiement</h2>
      <p className="card-hint">
        Tape le nom de la personne, puis ajoute un ou plusieurs frais à encaisser en une seule fois
        (ex. fête + t-shirt le même jour).
      </p>

      <form className="form" onSubmit={handleSubmit}>
        {membresComite.length > 0 && (
          <label className="field">
            <span>Paiement d'un membre du comité ? Sélectionne-le ici</span>
            <select
              value={membrePayeurId}
              onChange={(e) => selectionnerMembreCommePersonne(e.target.value)}
            >
              <option value="">— Choisir un membre (optionnel) —</option>
              {membresComite.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nom}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="field" style={{ position: "relative" }}>
          <span>Personne</span>
          <input
            type="text"
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value);
              setPersonneId("");
              setMembrePayeurId("");
            }}
            placeholder="Nom de la personne..."
            autoComplete="off"
          />
          {suggestions.length > 0 && (
            <ul className="suggestions-list">
              {suggestions.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => selectionnerPersonne(p)}>
                    {p.nom}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {personneId && (
          <p className="field-hint" style={{ marginTop: -8 }}>
            Payeur existant sélectionné.{" "}
            <button type="button" className="link-button" onClick={reinitialiserPersonne}>
              Changer
            </button>
          </p>
        )}

        {estNouveauPayeur && (
          <div className="new-payer-hint">
            <p className="field-hint" style={{ marginBottom: 8 }}>
              Aucun payeur nommé « {recherche.trim()} » — il sera créé automatiquement à l'enregistrement.
            </p>
            <label className="field">
              <span>
                E-mail du nouveau payeur <span className="field-hint">(pour la confirmation, optionnel)</span>
              </span>
              <input
                type="email"
                value={nouvelEmail}
                onChange={(e) => setNouvelEmail(e.target.value)}
                placeholder="exemple@mail.com"
              />
            </label>
          </div>
        )}

        {afficherAmenePar && (
          <div className="field amene-par-field">
            <span>Amené par (membre du comité)</span>
            <button
              type="button"
              className="amene-par-trigger"
              onClick={() => setListeAmeneParOuverte((o) => !o)}
            >
              {amenePar || "— Choisir un membre —"}
            </button>
            {listeAmeneParOuverte && (
              <ul className="amene-par-liste">
                <li>
                  <button type="button" onClick={() => selectionnerAmenePar("")}>
                    — Non précisé —
                  </button>
                </li>
                {membresComite.length === 0 ? (
                  <li className="amene-par-vide">Aucun membre du comité trouvé.</li>
                ) : (
                  membresComite.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        className={amenePar === m.nom ? "actif" : ""}
                        onClick={() => selectionnerAmenePar(m.nom)}
                      >
                        {m.nom}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
            {amenePar && (
              <p className="field-hint">
                Sélectionné : <strong>{amenePar}</strong>
              </p>
            )}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lignes.map((ligne) => {
            const restant = soldesParType[ligne.typeFraisId];
            return (
              <div key={ligne.cle} className="ligne-frais">
                <select
                  value={ligne.typeFraisId}
                  onChange={(e) => modifierLigne(ligne.cle, "typeFraisId", e.target.value)}
                >
                  {TYPES_FRAIS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} — {t.montant} $
                    </option>
                  ))}
                </select>
                <select
                  value={ligne.devise}
                  onChange={(e) => modifierLigne(ligne.cle, "devise", e.target.value)}
                >
                  {DEVISES.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.id}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Montant"
                  value={ligne.montant}
                  onChange={(e) => modifierLigne(ligne.cle, "montant", e.target.value)}
                  required
                />
                {personne && restant != null && (
                  <span className="field-hint">reste {restant.toFixed(2)} $</span>
                )}
                {lignes.length > 1 && (
                  <button type="button" className="link-button link-button-danger" onClick={() => retirerLigne(ligne.cle)}>
                    Retirer
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button type="button" className="link-button" onClick={ajouterLigne} style={{ alignSelf: "flex-start" }}>
          + Ajouter un autre frais
        </button>

        {statut.type && (
          <p className={`alert ${statut.type === "error" ? "alert-error" : "alert-success"}`}>
            {statut.message}
          </p>
        )}

        <button type="submit" className="btn btn-primary" disabled={envoi}>
          {envoi ? "Enregistrement..." : "Enregistrer le paiement"}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------

function FormSortie({ caissier, onSuccess }) {
  const [motif, setMotif] = useState("");
  const [devise, setDevise] = useState(DEVISES[0].id);
  const [montant, setMontant] = useState("");
  const [statut, setStatut] = useState({ type: null, message: "" });
  const [soldeDisponible, setSoldeDisponible] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    let actif = true;
    calculerVueEnsemble({ caissierId: caissier.uid }).then((vue) => {
      if (actif) setSoldeDisponible(vue.solde);
    });
    return () => {
      actif = false;
    };
  }, [caissier.uid]);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatut({ type: null, message: "" });
    setEnvoi(true);
    try {
      await enregistrerSortie({ motif, montant: Number(montant), devise, caissier });
      setMotif("");
      setMontant("");
      const vue = await calculerVueEnsemble({ caissierId: caissier.uid });
      setSoldeDisponible(vue.solde);
      setStatut({ type: "success", message: "Sortie de caisse enregistrée." });
      onSuccess();
    } catch (err) {
      setStatut({ type: "error", message: err.message });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="card">
      <h2>Enregistrer une sortie</h2>
      <p className="card-hint">Toute dépense de la caisse : achats, remboursements, imprévus...</p>
      {soldeDisponible != null && (
        <p className="field-hint" style={{ marginBottom: 12 }}>
          Solde disponible pour tes sorties : <strong>{soldeDisponible.toFixed(2)} $</strong>
        </p>
      )}

      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Motif</span>
          <input value={motif} onChange={(e) => setMotif(e.target.value)} required />
        </label>
        <div className="form-row">
          <label className="field">
            <span>Devise</span>
            <select value={devise} onChange={(e) => setDevise(e.target.value)}>
              {DEVISES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Montant</span>
            <input
              type="number"
              min="1"
              step="1"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              required
            />
          </label>
        </div>

        {statut.type && (
          <p className={`alert ${statut.type === "error" ? "alert-error" : "alert-success"}`}>
            {statut.message}
          </p>
        )}

        <button type="submit" className="btn btn-primary" disabled={envoi}>
          {envoi ? "Enregistrement..." : "Enregistrer la sortie"}
        </button>
      </form>
    </div>
  );
}
