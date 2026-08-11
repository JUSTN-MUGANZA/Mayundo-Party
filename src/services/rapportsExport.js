// Préparation des exports Excel / PDF des listes de personnes.
// Chaque catégorie a son propre jeu de colonnes : inutile d'imprimer le frais
// de comité sur un export d'étudiants, ni les frais de fête sur un export de
// membres du comité — ce sont des colonnes vides qui écrasent les autres.
// Aucun export ne contient d'adresse e-mail.

import { LABEL_STATUT_INVITATION, STATUTS_INVITATION } from "../constants/invitation";
import { TYPES_FRAIS } from "../constants/typesFrais";
import { montantEffectifUSD } from "./caisseService";

export const CATEGORIE_COMITE = "Membre du comité";
export const CATEGORIE_INVITE = "Étudiant / invité";

const COL_NOM = { cle: "nom", titre: "Nom" };
const COL_AMENE_PAR = { cle: "amenePar", titre: "Amené par" };
const COL_STATUT = { cle: "statut", titre: "Statut", largeur: 18 };
const COL_INVITATION = { cle: "invitation", titre: "Invitation", largeur: 24 };
const COL_TOTAL = { cle: "total", titre: "Total ($)", aligne: "right", largeur: 20 };

const colMontant = (cle, titre) => ({ cle, titre, aligne: "right", largeur: 20 });

// Montants d'une personne, repérés par identifiant de frais.
function montantsParFrais(personne) {
  return Object.fromEntries(personne.detailFrais.map((f) => [f.id, f.paye]));
}

function formaterLigne(personne) {
  const m = montantsParFrais(personne);
  return {
    nom: personne.nom,
    categorie: personne.categorie,
    amenePar: personne.amenePar || "—",
    fete: m.fete.toFixed(2),
    tshirt: m.tshirt.toFixed(2),
    defense: m.defense.toFixed(2),
    comite: m.comite.toFixed(2),
    statut: personne.statutGlobal,
    invitation: LABEL_STATUT_INVITATION[personne.statutInvitation],
    total: personne.totalGeneral.toFixed(2),
  };
}

// Pied de tableau : nombre de personnes exportées et somme de chaque colonne
// de montants. C'est ce qui permet de recouper un export avec la caisse.
function construireLigneTotal(personnes) {
  const somme = (id) => personnes.reduce((s, p) => s + (montantsParFrais(p)[id] || 0), 0);
  return {
    nom: `TOTAL — ${personnes.length} personne(s)`,
    categorie: "",
    amenePar: "",
    fete: somme("fete").toFixed(2),
    tshirt: somme("tshirt").toFixed(2),
    defense: somme("defense").toFixed(2),
    comite: somme("comite").toFixed(2),
    statut: "",
    invitation: `${personnes.filter((p) => p.statutInvitation === STATUTS_INVITATION.DISTRIBUEE).length} distribuée(s)`,
    total: personnes.reduce((s, p) => s + p.totalGeneral, 0).toFixed(2),
  };
}

function totalGeneral(personnes) {
  return personnes.reduce((s, p) => s + p.totalGeneral, 0).toFixed(2);
}

// categorie : CATEGORIE_INVITE | CATEGORIE_COMITE | "toutes"
export function preparerExportPersonnes({ personnes, categorie }) {
  const liste =
    categorie === "toutes" ? personnes : personnes.filter((p) => p.categorie === categorie);

  if (categorie === CATEGORIE_COMITE) {
    return {
      nomFichier: "membres-du-comite",
      titre: "Membres du comité — MAYUNDO Party",
      sousTitre: `${liste.length} membre(s) — Total encaissé : ${totalGeneral(liste)} $`,
      orientation: "portrait",
      colonnes: [COL_NOM, colMontant("comite", "Frais comité ($)"), COL_STATUT, COL_INVITATION, COL_TOTAL],
      lignes: liste.map(formaterLigne),
      ligneTotal: construireLigneTotal(liste),
    };
  }

  if (categorie === CATEGORIE_INVITE) {
    return {
      nomFichier: "etudiants-invites",
      titre: "Étudiants / invités — MAYUNDO Party",
      sousTitre: `${liste.length} personne(s) — Total encaissé : ${totalGeneral(liste)} $`,
      orientation: "portrait",
      colonnes: [
        COL_NOM,
        COL_AMENE_PAR,
        colMontant("fete", "Fête ($)"),
        colMontant("tshirt", "T-shirt ($)"),
        colMontant("defense", "Défense ($)"),
        COL_STATUT,
        COL_INVITATION,
        COL_TOTAL,
      ],
      lignes: liste.map(formaterLigne),
      ligneTotal: construireLigneTotal(liste),
    };
  }

  // Export général : toutes les colonnes, donc format paysage — en portrait
  // les dix colonnes deviennent illisibles.
  return {
    nomFichier: "personnes-ayant-paye",
    titre: "Toutes les personnes — MAYUNDO Party",
    sousTitre: `${liste.length} personne(s) — Total encaissé : ${totalGeneral(liste)} $`,
    orientation: "landscape",
    colonnes: [
      COL_NOM,
      { cle: "categorie", titre: "Catégorie", largeur: 30 },
      COL_AMENE_PAR,
      colMontant("fete", "Fête ($)"),
      colMontant("tshirt", "T-shirt ($)"),
      colMontant("defense", "Défense ($)"),
      colMontant("comite", "Comité ($)"),
      COL_STATUT,
      COL_INVITATION,
      COL_TOTAL,
    ],
    lignes: liste.map(formaterLigne),
    ligneTotal: construireLigneTotal(liste),
  };
}

// Regroupe les encaissements d'un caissier par personne, en cumulant toutes
// les tranches qu'il a lui-même enregistrées. Le résultat a la même forme
// qu'une ligne de rapport, ce qui permet de réutiliser la mise en page.
// Le statut de l'invitation, lui, vient de la situation réelle de la personne
// (personnesServies) : c'est une information globale, pas propre au caissier.
export function agregerEncaissementsParPersonne(paiements, personnesServies = []) {
  const reference = Object.fromEntries(personnesServies.map((p) => [p.id, p]));
  const parPersonne = {};

  paiements.forEach((p) => {
    parPersonne[p.personneId] ??= {
      id: p.personneId,
      nom: p.personneNom,
      totaux: {},
      amenePar: "",
    };
    const groupe = parPersonne[p.personneId];
    groupe.totaux[p.typeFraisId] =
      (groupe.totaux[p.typeFraisId] || 0) + montantEffectifUSD(p);
    if (p.amenePar) groupe.amenePar = p.amenePar;
  });

  return Object.values(parPersonne)
    .map((groupe) => {
      let totalGeneral = 0;
      const detailFrais = TYPES_FRAIS.map((t) => {
        const paye = groupe.totaux[t.id] || 0;
        totalGeneral += paye;
        return {
          id: t.id,
          label: t.label,
          paye,
          du: t.montant,
          statut: paye >= t.montant - 0.01 ? "Soldé" : paye > 0 ? "Partiel" : "Aucun",
        };
      });

      const situation = reference[groupe.id];
      return {
        id: groupe.id,
        nom: groupe.nom,
        amenePar: groupe.amenePar,
        detailFrais,
        totalGeneral,
        categorie: (groupe.totaux.comite || 0) > 0 ? CATEGORIE_COMITE : CATEGORIE_INVITE,
        statutGlobal: situation?.statutGlobal || "—",
        statutInvitation: situation?.statutInvitation || STATUTS_INVITATION.INDISPONIBLE,
      };
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

// Export propre à un caissier : les montants sont CEUX QU'IL A ENCAISSÉS,
// pas la situation globale de la personne. Le total correspond donc exactement
// à ce qui figure dans sa vue d'ensemble personnelle.
export function preparerExportEncaissementsCaissier({ personnes, categorie, caissierEmail }) {
  const liste = personnes.filter((p) => p.categorie === categorie);
  const estComite = categorie === CATEGORIE_COMITE;

  return {
    nomFichier: estComite ? "mes-encaissements-comite" : "mes-encaissements-invites",
    titre: estComite
      ? "Mes encaissements — membres du comité"
      : "Mes encaissements — étudiants / invités",
    sousTitre: `${caissierEmail} — ${liste.length} personne(s) — Total encaissé : ${totalGeneral(liste)} $`,
    orientation: "portrait",
    colonnes: estComite
      ? [COL_NOM, colMontant("comite", "Frais comité ($)"), COL_INVITATION, COL_TOTAL]
      : [
          COL_NOM,
          COL_AMENE_PAR,
          colMontant("fete", "Fête ($)"),
          colMontant("tshirt", "T-shirt ($)"),
          colMontant("defense", "Défense ($)"),
          COL_INVITATION,
          COL_TOTAL,
        ],
    lignes: liste.map(formaterLigne),
    ligneTotal: construireLigneTotal(liste),
  };
}
