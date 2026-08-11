import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db, auth, getSecondaryAuth } from "../firebase";
import { createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, updateProfile } from "firebase/auth";
import { getTypeFrais, TYPES_FRAIS, IDS_FRAIS_INVITE, TOTAL_FRAIS_INVITE } from "../constants/typesFrais";
import { convertirEnUSD } from "../constants/devises";
import { envoyerEmailConfirmation, envoyerMessageUnique, envoyerEmailActivationCompte } from "./emailService";

const personnesRef = collection(db, "personnes");
const paiementsRef = collection(db, "paiements");
const sortiesRef = collection(db, "sorties");
const auditRef = collection(db, "auditLog");
const connexionsRef = collection(db, "connexions");
const utilisateursRef = collection(db, "utilisateurs");

// Montant réel (en $) à prendre en compte pour les totaux et les soldes.
// Une correction ÉCRASE le montant d'origine : "montantUSD" contient toujours
// la valeur en vigueur (l'ancienne n'est conservée que pour la traçabilité,
// dans ancienMontant/ancienMontantUSD et dans le journal d'audit).
// Une opération annulée ne compte plus pour rien.
export function montantEffectifUSD(data) {
  if (data.annule) return 0;
  return data.montantUSD ?? data.montant ?? 0;
}

// ---------- Personnes ----------

export async function listerPersonnes() {
  const snap = await getDocs(query(personnesRef, orderBy("nom")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function creerPersonne({ nom, email }) {
  const docRef = await addDoc(personnesRef, {
    nom: nom.trim(),
    email: email?.trim() || "",
    createdAt: serverTimestamp(),
  });
  return { id: docRef.id, nom, email };
}

// ---------- Paiements ----------

// Retourne le total déjà payé (en équivalent $) par une personne pour un
// type de frais donné. "montantUSD" est utilisé pour tout paiement récent ;
// on retombe sur "montant" pour d'anciens paiements enregistrés avant la
// gestion multi-devises (considérés comme déjà en dollars).
export async function getTotalPaye(personneId, typeFraisId) {
  const soldes = await getSoldesParType(personneId);
  return soldes[typeFraisId] || 0;
}

// Une seule lecture Firestore pour tous les types de frais d'une personne
// (évite 4 requêtes quand le formulaire charge les soldes restants).
export async function getSoldesParType(personneId) {
  const q = query(paiementsRef, where("personneId", "==", personneId));
  const snap = await getDocs(q);
  const totaux = {};
  snap.docs.forEach((d) => {
    const data = d.data();
    totaux[data.typeFraisId] = (totaux[data.typeFraisId] || 0) + montantEffectifUSD(data);
  });
  return totaux;
}

// Total déjà payé (en $) par un invité sur l'ensemble des 3 frais
// (fête + t-shirt + défense), toutes tranches confondues.
export async function getTotalPayeInvite(personneId) {
  const soldes = await getSoldesParType(personneId);
  return IDS_FRAIS_INVITE.reduce((total, id) => total + (soldes[id] || 0), 0);
}

export async function listerPaiementsRecents(max = 20) {
  const q = query(paiementsRef, orderBy("createdAt", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Historique d'UN SEUL caissier — utilisé dans son propre espace, pour qu'il
// ne voie jamais les opérations enregistrées par d'autres caissiers.
// Tri côté client pour éviter l'index composite caissierId + createdAt
// (Firebase peut mettre plusieurs minutes à le construire).
export async function listerMesPaiementsRecents(caissierId, max = 20) {
  const q = query(paiementsRef, where("caissierId", "==", caissierId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .slice(0, max);
}

// Enregistre une tranche de paiement (en $ ou en FC) et journalise l'action.
// N'envoie PAS d'e-mail lui-même : quand plusieurs frais sont enregistrés
// d'un coup pour la même personne (plusieurs lignes dans le formulaire), on
// veut UN SEUL e-mail récapitulatif, pas un par frais — voir
// envoyerRecapitulatifPaiement, à appeler une fois après la boucle.
// Le solde et les totaux sont toujours calculés en équivalent dollars,
// puisque les types de frais sont fixés en dollars.
export async function enregistrerPaiement({ personne, typeFraisId, montant, devise, caissier, amenePar }) {
  const typeFrais = getTypeFrais(typeFraisId);
  if (!typeFrais) throw new Error("Type de frais inconnu.");
  if (!montant || montant <= 0) throw new Error("Le montant doit être positif.");

  const montantUSD = convertirEnUSD(montant, devise);

  const dejaPaye = await getTotalPaye(personne.id, typeFraisId);
  const restantAvant = typeFrais.montant - dejaPaye;
  // petite marge de tolérance (0.01$) pour les arrondis de conversion FC → $
  if (montantUSD > restantAvant + 0.01) {
    throw new Error(
      `Le montant dépasse le solde restant (${restantAvant.toFixed(2)} $ restants pour ${typeFrais.label}).`
    );
  }

  await addDoc(paiementsRef, {
    personneId: personne.id,
    personneNom: personne.nom,
    // Recopié sur le paiement pour que l'historique du caissier puisse
    // afficher l'e-mail sans relire la fiche "personnes" (il n'y a pas accès
    // ligne par ligne). Vide pour les paiements enregistrés avant cet ajout.
    personneEmail: personne.email || "",
    typeFraisId,
    typeFraisLabel: typeFrais.label,
    montant,
    devise,
    montantUSD,
    annule: false,
    amenePar: amenePar || "",
    caissierId: caissier.uid,
    caissierEmail: caissier.email,
    createdAt: serverTimestamp(),
  });

  await logAudit({
    utilisateur: caissier,
    typeAction: "ajout",
    cible: `paiement de ${personne.nom} (${typeFrais.label})`,
    details: `Montant : ${montant} ${devise === "CDF" ? "FC" : "$"}`,
  });

  const totalApres = dejaPaye + montantUSD;
  const estSolde = totalApres >= typeFrais.montant - 0.01;

  return {
    totalApres,
    restant: typeFrais.montant - totalApres,
    estSolde,
    typeFraisLabel: typeFrais.label,
    typeFraisMontant: typeFrais.montant,
  };
}

// Envoie UN SEUL e-mail de confirmation quand un invité a atteint le
// total des 3 frais (20 $), ou quand un membre a soldé son frais de comité.
// À appeler une fois après avoir traité toutes les lignes du formulaire.
export async function envoyerRecapitulatifPaiement({ personne, elementsSoldes }) {
  if (!elementsSoldes || elementsSoldes.length === 0) return false;
  try {
    const parametresEvenement = await obtenirParametresEvenement();
    return await envoyerEmailConfirmation({
      nomPersonne: personne.nom,
      emailPersonne: personne.email,
      elements: elementsSoldes,
      parametresEvenement,
    });
  } catch (err) {
    console.error("Échec de l'envoi de l'e-mail de confirmation :", err);
    return false;
  }
}

// Volontairement NON exportée : une correction ne peut partir que d'une
// demande de caissier traitée par un admin (traiterDemandeCorrection).
// Aucun écran ne doit pouvoir modifier un paiement en dehors de ce circuit —
// les règles Firestore imposent la même contrainte côté serveur.
async function appliquerCorrectionPaiement({ paiementId, nouveauMontant, nouvelleDevise, motif, admin }) {
  const paiementSnap = await getDoc(doc(db, "paiements", paiementId));
  const paiementAvant = paiementSnap.exists() ? paiementSnap.data() : null;
  if (!paiementAvant) throw new Error("Paiement introuvable.");

  const nouveauMontantUSD = convertirEnUSD(nouveauMontant, nouvelleDevise);

  await updateDoc(doc(db, "paiements", paiementId), {
    montant: nouveauMontant,
    devise: nouvelleDevise,
    montantUSD: nouveauMontantUSD,
    montantCorrige: nouveauMontant,
    deviseCorrigee: nouvelleDevise,
    montantUSDCorrige: nouveauMontantUSD,
    corrige: true,
    annule: false,
    ancienMontant: paiementAvant.montant ?? null,
    ancienneDevise: paiementAvant.devise ?? null,
    ancienMontantUSD: paiementAvant.montantUSD ?? paiementAvant.montant ?? null,
    correctionMotif: motif || "",
    correctionParEmail: admin.email,
    correctionDate: serverTimestamp(),
  });

  const ancienMontant = paiementAvant?.montant ?? 0;
  const ancienneDevise = paiementAvant?.devise === "CDF" ? "FC" : "$";
  const nouveauLibelle = `${nouveauMontant} ${nouvelleDevise === "CDF" ? "FC" : "$"}`;

  await logAudit({
    utilisateur: admin,
    typeAction: "modification",
    cible: `correction d'un paiement (${paiementAvant.personneNom} — ${paiementAvant.typeFraisLabel})`,
    details: `Ancien montant : ${ancienMontant} ${ancienneDevise} → Nouveau : ${nouveauLibelle}${motif ? ` — Motif : ${motif}` : ""}`,
  });

  await marquerDemandeTraitee(paiementId, {
    correctionMotif: motif || "",
    correctionResume: `Ancien montant : ${ancienMontant} ${ancienneDevise} → Nouveau : ${nouveauLibelle}`,
    correctionDate: serverTimestamp(),
    correctionParEmail: admin.email,
    statut: "traitee",
  });
}

// ---------- Demandes de correction (permission caissier → admin) ----------

const demandesRef = collection(db, "demandesCorrection");

// Le caissier SIGNALE une erreur sur une opération qu'il a lui-même
// enregistrée : il décrit le problème, il ne saisit AUCUN montant.
// C'est l'admin, et lui seul, qui entre ensuite le nouveau montant et applique
// la correction (voir traiterDemandeCorrection). Le caissier est simplement
// notifié du résultat dans son espace.
export async function demanderCorrection({ type, entiteId, resume, montantActuel, motif, caissier }) {
  const existante = await getDoc(doc(db, "demandesCorrection", entiteId));
  if (existante.exists()) {
    const statut = existante.data().statut;
    if (statut === "en_attente") throw new Error("Une demande est déjà en attente pour cette opération.");
    if (statut === "accordee") throw new Error("L'admin est en train de traiter cette opération.");
    if (statut === "traitee") throw new Error("Cette opération a déjà été corrigée par un admin.");
    // statut "refusee" : le caissier a le droit de refaire une demande.
  }

  const donnees = {
    type, // "paiement" | "sortie"
    entiteId,
    resume,
    montantActuel: montantActuel || "",
    motif: motif || "",
    statut: "en_attente",
    caissierId: caissier.uid,
    caissierEmail: caissier.email,
    createdAt: serverTimestamp(),
  };

  // Une nouvelle demande après un refus est une mise à jour du document
  // existant : on n'écrase que les champs de la demande, pas l'historique
  // du refus précédent (motifAdmin/traiteParEmail restent lisibles).
  if (existante.exists()) {
    await updateDoc(doc(db, "demandesCorrection", entiteId), donnees);
  } else {
    await setDoc(doc(db, "demandesCorrection", entiteId), donnees);
  }

  await logAudit({
    utilisateur: caissier,
    typeAction: "ajout",
    cible: `demande de correction (${resume})`,
    details: motif || "",
  });
}

// Toutes les demandes — espace admin et super admin uniquement.
export async function listerDemandesCorrection() {
  const snap = await getDocs(query(demandesRef, orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Les demandes d'UN SEUL caissier : c'est son historique de corrections, et
// le moyen d'être notifié qu'une demande a été traitée ou refusée.
// Tri côté client pour éviter l'index composite caissierId + createdAt.
export async function listerMesDemandesCorrection(caissierId) {
  const q = query(demandesRef, where("caissierId", "==", caissierId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

// Seul point d'entrée d'une correction : l'admin décide, et c'est LUI qui
// saisit le nouveau montant (le caissier n'a jamais fourni de chiffre).
export async function traiterDemandeCorrection({ demandeId, decision, admin, nouveauMontant = null, nouvelleDevise = null, motifAdmin = "" }) {
  if (decision === "refusee") {
    await updateDoc(doc(db, "demandesCorrection", demandeId), {
      statut: decision,
      traiteParEmail: admin.email,
      traiteDate: serverTimestamp(),
      motifAdmin,
    });

    await logAudit({
      utilisateur: admin,
      typeAction: "modification",
      cible: `demande de correction (${demandeId})`,
      details: "Demande refusée",
    });
    return;
  }

  const demandeSnap = await getDoc(doc(db, "demandesCorrection", demandeId));
  if (!demandeSnap.exists()) throw new Error("Demande introuvable.");
  const demande = demandeSnap.data();
  if (demande.statut !== "en_attente") {
    throw new Error("Cette demande a déjà été traitée.");
  }
  if (!nouveauMontant || Number(nouveauMontant) <= 0) {
    throw new Error("Saisis le nouveau montant avant d'appliquer la correction.");
  }

  await updateDoc(doc(db, "demandesCorrection", demandeId), {
    statut: "accordee",
    traiteParEmail: admin.email,
    traiteDate: serverTimestamp(),
    motifAdmin,
  });

  // Si l'application de la correction échoue (montant refusé par les règles,
  // coupure réseau...), la demande ne doit pas rester bloquée en "accordee" :
  // on la remet en attente pour que l'admin puisse réessayer.
  try {
    if (demande.type === "paiement") {
      await appliquerCorrectionPaiement({
        paiementId: demande.entiteId,
        nouveauMontant: Number(nouveauMontant),
        nouvelleDevise,
        motif: motifAdmin || demande.motif,
        admin,
      });
    } else {
      await appliquerCorrectionSortie({
        sortieId: demande.entiteId,
        nouveauMontant: Number(nouveauMontant),
        nouvelleDevise,
        motif: motifAdmin || demande.motif,
        admin,
      });
    }
  } catch (err) {
    await updateDoc(doc(db, "demandesCorrection", demandeId), { statut: "en_attente" });
    throw err;
  }
}

async function marquerDemandeTraitee(entiteId, details = {}) {
  try {
    await updateDoc(doc(db, "demandesCorrection", entiteId), { statut: "traitee", ...details });
  } catch {
    // pas grave si la demande n'existe plus (correction faite directement par un admin)
  }
}

// ---------- Sorties de caisse ----------

export async function enregistrerSortie({ motif, montant, devise, caissier }) {
  if (!motif?.trim()) throw new Error("Le motif est obligatoire.");
  if (!montant || montant <= 0) throw new Error("Le montant doit être positif.");

  const montantUSD = convertirEnUSD(montant, devise);
  const vue = await calculerVueEnsemble({ caissierId: caissier.uid });
  if (montantUSD > vue.solde + 0.01) {
    throw new Error(`Montant supérieur à votre solde disponible (${vue.solde.toFixed(2)} $).`);
  }

  await addDoc(sortiesRef, {
    motif: motif.trim(),
    montant,
    devise,
    montantUSD,
    annule: false,
    caissierId: caissier.uid,
    caissierEmail: caissier.email,
    createdAt: serverTimestamp(),
  });

  await logAudit({
    utilisateur: caissier,
    typeAction: "ajout",
    cible: "sortie de caisse",
    details: `Motif : ${motif} — Montant : ${montant} ${devise === "CDF" ? "FC" : "$"}`,
  });
}

// Non exportée, même raison que appliquerCorrectionPaiement.
async function appliquerCorrectionSortie({ sortieId, nouveauMontant, nouvelleDevise, motif, admin }) {
  const sortieSnap = await getDoc(doc(db, "sorties", sortieId));
  const sortieAvant = sortieSnap.exists() ? sortieSnap.data() : null;
  if (!sortieAvant) throw new Error("Sortie introuvable.");

  const nouveauMontantUSD = convertirEnUSD(nouveauMontant, nouvelleDevise);
  const vue = await calculerVueEnsemble({ caissierId: sortieAvant.caissierId });
  const ancienMontantUSD = montantEffectifUSD(sortieAvant || {});
  const soldeDisponibleApresRestitution = vue.solde + ancienMontantUSD;
  if (nouveauMontantUSD > soldeDisponibleApresRestitution + 0.01) {
    throw new Error(`Montant corrigé supérieur au solde du caissier (${soldeDisponibleApresRestitution.toFixed(2)} $).`);
  }

  await updateDoc(doc(db, "sorties", sortieId), {
    montant: nouveauMontant,
    devise: nouvelleDevise,
    montantUSD: nouveauMontantUSD,
    corrige: true,
    annule: false,
    ancienMontant: sortieAvant.montant ?? null,
    ancienneDevise: sortieAvant.devise ?? null,
    ancienMontantUSD: sortieAvant.montantUSD ?? sortieAvant.montant ?? null,
    correctionMotif: motif || "",
    correctionParEmail: admin.email,
    correctionDate: serverTimestamp(),
  });

  const ancienMontant = sortieAvant?.montant ?? 0;
  const ancienneDevise = sortieAvant?.devise === "CDF" ? "FC" : "$";
  const nouveauLibelle = `${nouveauMontant} ${nouvelleDevise === "CDF" ? "FC" : "$"}`;

  await logAudit({
    utilisateur: admin,
    typeAction: "modification",
    cible: `correction d'une sortie (${sortieAvant.motif || sortieId})`,
    details: `Ancien montant : ${ancienMontant} ${ancienneDevise} → Nouveau : ${nouveauLibelle}${motif ? ` — Motif : ${motif}` : ""}`,
  });

  await marquerDemandeTraitee(sortieId, {
    correctionMotif: motif || "",
    correctionResume: `Ancien montant : ${ancienMontant} ${ancienneDevise} → Nouveau : ${nouveauLibelle}`,
    correctionDate: serverTimestamp(),
    correctionParEmail: admin.email,
    statut: "traitee",
  });
}

export async function listerSortiesRecentes(max = 20) {
  const q = query(sortiesRef, orderBy("createdAt", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Historique d'UN SEUL caissier — mêmes raisons que listerMesPaiementsRecents.
// Tri côté client pour éviter l'index composite (même raison que pour les paiements).
export async function listerMesSortiesRecentes(caissierId, max = 20) {
  const q = query(sortiesRef, where("caissierId", "==", caissierId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .slice(0, max);
}

// ---------- Journal d'audit & connexions ----------

export async function logAudit({ utilisateur, typeAction, cible, details }) {
  await addDoc(auditRef, {
    utilisateurId: utilisateur.uid,
    utilisateurEmail: utilisateur.email,
    typeAction, // "ajout" | "modification" | "suppression"
    cible,
    details: details || "",
    date: serverTimestamp(),
  });
}

export async function logConnexion(utilisateur) {
  await addDoc(connexionsRef, {
    utilisateurId: utilisateur.uid,
    utilisateurEmail: utilisateur.email,
    date: serverTimestamp(),
  });
}

// ---------- Gestion des comptes utilisateurs (espace admin) ----------

export async function listerUtilisateurs() {
  const snap = await getDocs(query(utilisateursRef, orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Génère un mot de passe temporaire aléatoire, jamais affiché ni connu de
// la personne qui crée le compte — utilisé uniquement pour satisfaire
// Firebase à la création, avant que le nouvel utilisateur ne définisse
// lui-même son propre mot de passe via le lien reçu par e-mail.
function genererMotDePasseTemporaire() {
  const octets = new Uint8Array(18);
  crypto.getRandomValues(octets);
  return Array.from(octets, (o) => o.toString(36)).join("").slice(0, 24) + "Aa1!";
}

// Crée le compte Authentication (via une app Firebase secondaire, pour ne
// pas déconnecter l'admin en cours) puis le document Firestore associé.
//
// Si sansMotDePasse=true (cas admin et caissier) : la personne qui crée le
// compte ne choisit AUCUN mot de passe — un mot de passe temporaire aléatoire
// est généré en interne puis immédiatement oublié, et Firebase envoie un
// e-mail au nouvel utilisateur pour qu'il définisse lui-même son mot de
// passe. Cela évite que l'admin/CP puisse connaître ou être accusé de
// connaître le mot de passe d'un compte qu'il a créé.
export async function creerCompteUtilisateur({ nom, email, password, role, admin, sansMotDePasse }) {
  const secondaryAuth = getSecondaryAuth();
  const motDePasseUtilise = sansMotDePasse ? genererMotDePasseTemporaire() : password;
  let uid;
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, motDePasseUtilise);
    uid = cred.user.uid;
    // Le nom est enregistré sur le profil Firebase Auth (displayName) pour
    // que l'e-mail de définition de mot de passe puisse afficher %DISPLAY_NAME%
    // une fois le template personnalisé dans la console Firebase.
    await updateProfile(cred.user, { displayName: nom.trim() });
  } finally {
    // On se déconnecte de l'app secondaire dans tous les cas : la session
    // de l'admin (app principale) n'est jamais affectée par cette étape.
    await signOut(secondaryAuth);
  }

  await setDoc(doc(db, "utilisateurs", uid), {
    nom: nom.trim(),
    email: email.trim(),
    role,
    createdAt: serverTimestamp(),
  });

  await logAudit({
    utilisateur: admin,
    typeAction: "ajout",
    cible: `compte utilisateur (${email})`,
    details: `Rôle attribué : ${role}${sansMotDePasse ? " — invitation envoyée par e-mail" : ""}`,
  });

  let emailActivationEnvoye = false;

  if (sansMotDePasse) {
    // 1) E-mail Firebase officiel : le seul moyen, en pur client-side, d'obtenir
    // un lien qui fonctionne vraiment pour définir un mot de passe (sans
    // Cloud Functions). Son texte se personnalise dans la console Firebase :
    // Authentication → Templates → "Réinitialisation du mot de passe" — mais
    // ce modèle est parfois verrouillé par Firebase selon la configuration du
    // projet, auquel cas il reste basique/en anglais.
    await sendPasswordResetEmail(auth, email.trim());

    // 2) E-mail EmailJS personnalisé (félicitations, JENGA DIGITAL...) envoyé
    // en complément — toujours sous notre contrôle et bien présenté, même si
    // l'e-mail Firebase ci-dessus reste basique. Il ne contient pas de vrai
    // lien (impossible à générer sans backend payant) : il prévient juste que
    // le lien fonctionnel arrive dans un e-mail séparé de Firebase.
    try {
      await envoyerEmailActivationCompte({
        nom: nom.trim(),
        email: email.trim(),
        role,
        lienActivation: "📩 Un second e-mail (envoyé par Firebase) va suivre avec le lien pour définir votre mot de passe.",
      });
      emailActivationEnvoye = true;
    } catch (err) {
      console.error("Échec de l'envoi de l'e-mail d'activation EmailJS :", err);
      emailActivationEnvoye = false;
    }
  }

  return { uid, nom, email, role, emailActivationEnvoye };
}

export async function modifierRoleUtilisateur({ utilisateurId, nouveauRole, admin }) {
  await updateDoc(doc(db, "utilisateurs", utilisateurId), { role: nouveauRole });
  await logAudit({
    utilisateur: admin,
    typeAction: "modification",
    cible: `rôle de l'utilisateur ${utilisateurId}`,
    details: `Nouveau rôle : ${nouveauRole}`,
  });
}

// Retire l'accès d'un utilisateur : supprime son document Firestore, ce qui
// lui fait perdre tout rôle dans l'app (message "Aucun rôle associé").
// Important : ceci NE supprime PAS son compte Authentication — cela
// nécessiterait le SDK Admin (Cloud Functions), hors du périmètre "stack
// minimale, plan gratuit" choisi pour ce projet.
// L'admin n'a PAS le droit de retirer l'accès d'un compte caissier (seul le
// super admin le peut) : cette protection est vérifiée ici ET dans les
// règles Firestore, ne pas retirer l'une des deux.
export async function retirerAccesUtilisateur({ utilisateurId, emailUtilisateur, roleUtilisateur, admin, estSuperAdmin }) {
  if (roleUtilisateur === "caissier" && !estSuperAdmin) {
    throw new Error("Un administrateur n'a pas le droit de retirer l'accès d'un compte caissier.");
  }
  await deleteDoc(doc(db, "utilisateurs", utilisateurId));
  await logAudit({
    utilisateur: admin,
    typeAction: "suppression",
    cible: `accès de l'utilisateur (${emailUtilisateur})`,
    details: "Document de rôle retiré (compte Authentication conservé).",
  });
}

// Liste les personnes ayant le rôle "membre" (membre du comité organisateur),
// utilisée par le caissier pour indiquer qui a amené un invité.
export async function listerMembresComite() {
  const q = query(utilisateursRef, where("role", "==", "membre"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------- Supervision (espace super admin) ----------

export async function listerAuditLogRecent(max = 30) {
  const q = query(auditRef, orderBy("date", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listerConnexionsRecentes(max = 30) {
  const q = query(connexionsRef, orderBy("date", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Calcule les totaux financiers globaux (en équivalent $) : total encaissé,
// total des sorties, solde de caisse, et répartition du montant encaissé par
// caissier. Les opérations annulées/corrigées sont prises en compte à leur
// juste valeur (voir montantEffectifUSD).
export async function calculerTotauxFinanciers() {
  return calculerVueEnsemble();
}

export async function calculerVueEnsemble({ caissierId = null } = {}) {
  const paiementsQuery = caissierId
    ? query(paiementsRef, where("caissierId", "==", caissierId))
    : paiementsRef;
  const sortiesQuery = caissierId
    ? query(sortiesRef, where("caissierId", "==", caissierId))
    : sortiesRef;

  const [paiementsSnap, sortiesSnap] = await Promise.all([
    getDocs(paiementsQuery),
    getDocs(sortiesQuery),
  ]);

  let totalEncaisse = 0;
  let totalFete = 0;
  let totalTshirt = 0;
  let totalDefense = 0;
  let totalComite = 0;
  let totalSorties = 0;
  const parCaissier = {};

  paiementsSnap.forEach((d) => {
    const p = d.data();
    const montant = montantEffectifUSD(p);
    totalEncaisse += montant;

    if (p.typeFraisId === "fete") totalFete += montant;
    if (p.typeFraisId === "tshirt") totalTshirt += montant;
    if (p.typeFraisId === "defense") totalDefense += montant;
    if (p.typeFraisId === "comite") totalComite += montant;

    const cle = p.caissierEmail || "inconnu";
    parCaissier[cle] = (parCaissier[cle] || 0) + montant;
  });

  sortiesSnap.forEach((d) => {
    totalSorties += montantEffectifUSD(d.data());
  });

  return {
    totalEncaisse,
    totalFete,
    totalTshirt,
    totalDefense,
    totalComite,
    totalSorties,
    solde: totalEncaisse - totalSorties,
    totalInvite: totalFete + totalTshirt + totalDefense,
    totalGeneralAttendu: totalFete + totalTshirt + totalDefense + totalComite,
    progressionInvite: TOTAL_FRAIS_INVITE > 0 ? (totalFete + totalTshirt + totalDefense) / TOTAL_FRAIS_INVITE : 0,
    parCaissier: Object.entries(parCaissier)
      .map(([email, total]) => ({ email, total }))
      .sort((a, b) => b.total - a.total),
  };
}

// Sépare le total encaissé en deux catégories : l'argent des membres du
// comité (frais de comité) et l'argent des étudiants/invités (fête, t-shirt,
// défense).
export async function calculerTotauxParCategorie() {
  const paiementsSnap = await getDocs(paiementsRef);
  let totalComite = 0;
  let totalEtudiants = 0;
  paiementsSnap.forEach((d) => {
    const p = d.data();
    const montant = montantEffectifUSD(p);
    if (p.typeFraisId === "comite") totalComite += montant;
    else totalEtudiants += montant;
  });
  return { totalComite, totalEtudiants };
}

// ---------- Rapport des personnes ayant payé (espace admin, export) ----------

// Construit, pour chaque personne, le détail de ce qu'elle a payé par type de
// frais (montant $, statut soldé/partiel/aucun), son total général, et sa
// catégorie (membre du comité si elle a payé le frais de comité, sinon
// étudiant/invité).
// Additionne TOUTES les tranches d'un même frais.
// Piège corrigé : une personne qui paie la fête en 4 $ + 5 $ + 1 $ a bien payé
// 10 $ — pas 4 $. Chaque paiement est un document Firestore séparé, il faut
// donc cumuler tous les documents d'un même couple (personne, type de frais),
// jamais se contenter du premier trouvé. Vaut pour les invités comme pour les
// membres du comité.
function cumulerPaiementsParPersonne(paiementsSnap) {
  const totaux = {}; // totaux[personneId][typeFraisId] = montant payé (en $)
  const amenePar = {}; // personneId -> nom du membre du comité qui l'a amené
  const caissiers = {}; // personneId -> Set des caissiers ayant encaissé

  paiementsSnap.forEach((d) => {
    const p = d.data();
    totaux[p.personneId] ??= {};
    totaux[p.personneId][p.typeFraisId] =
      (totaux[p.personneId][p.typeFraisId] || 0) + montantEffectifUSD(p);
    if (p.amenePar) amenePar[p.personneId] = p.amenePar;
    caissiers[p.personneId] ??= new Set();
    caissiers[p.personneId].add(p.caissierId);
  });

  return { totaux, amenePar, caissiers };
}

// Construit la ligne de rapport d'une personne à partir de ses totaux cumulés.
function construireLignePersonne(personne, totauxParFrais = {}, amenePar = "") {
  let totalGeneral = 0;
  const detailFrais = TYPES_FRAIS.map((t) => {
    const paye = totauxParFrais[t.id] || 0;
    totalGeneral += paye;
    return {
      id: t.id,
      label: t.label,
      paye,
      du: t.montant,
      statut: paye >= t.montant - 0.01 ? "Soldé" : paye > 0 ? "Partiel" : "Aucun",
    };
  });

  const categorie = (totauxParFrais.comite || 0) > 0 ? "Membre du comité" : "Étudiant / invité";

  // Le statut global ne regarde QUE les frais qui concernent la personne :
  // un invité soldé à 20 $ est en règle même s'il n'a pas payé les 30 $ du
  // comité, qui ne le concernent pas.
  const fraisConcernes =
    categorie === "Membre du comité"
      ? detailFrais.filter((f) => f.id === "comite")
      : detailFrais.filter((f) => IDS_FRAIS_INVITE.includes(f.id));
  const statutGlobal = fraisConcernes.every((f) => f.statut === "Soldé")
    ? "Soldé"
    : fraisConcernes.some((f) => f.paye > 0)
    ? "Partiel"
    : "Aucun";

  return { ...personne, detailFrais, totalGeneral, categorie, statutGlobal, amenePar };
}

export async function listerPersonnesAvecPaiements() {
  const [personnesSnap, paiementsSnap] = await Promise.all([
    getDocs(query(personnesRef, orderBy("nom"))),
    getDocs(paiementsRef),
  ]);

  const { totaux, amenePar } = cumulerPaiementsParPersonne(paiementsSnap);

  return personnesSnap.docs.map((d) =>
    construireLignePersonne({ id: d.id, ...d.data() }, totaux[d.id], amenePar[d.id] || "")
  );
}

// Personnes encaissées au moins une fois par CE caissier, avec leur situation
// réelle et complète.
// Le total affiché tient compte de toutes les tranches, y compris celles
// encaissées par un autre caissier : sinon un invité passé successivement à
// deux guichets apparaîtrait comme non soldé, alors que le formulaire de
// paiement (et la vue globale) le comptent, eux, correctement.
// La liste reste limitée aux personnes que ce caissier a servies, et
// l'historique de ses opérations reste strictement personnel.
export async function listerPersonnesServiesPar(caissierId) {
  const [personnesSnap, paiementsSnap] = await Promise.all([
    getDocs(query(personnesRef, orderBy("nom"))),
    getDocs(paiementsRef),
  ]);

  const { totaux, amenePar, caissiers } = cumulerPaiementsParPersonne(paiementsSnap);

  return personnesSnap.docs
    .filter((d) => caissiers[d.id]?.has(caissierId))
    .map((d) =>
      construireLignePersonne({ id: d.id, ...d.data() }, totaux[d.id], amenePar[d.id] || "")
    );
}

// ---------- Message groupé (espace super admin) ----------

// Liste les personnes "en ordre" (soldées sur les frais qui les concernent
// selon leur catégorie) et disposant d'un e-mail — ce sont les destinataires
// du message groupé envoyé par le super admin.
export async function listerPersonnesEnOrdre() {
  const toutes = await listerPersonnesAvecPaiements();
  // statutGlobal tient déjà compte de la catégorie : le comité est jugé sur son
  // frais de 30 $, l'invité sur ses 3 frais (20 $).
  return toutes.filter((p) => p.email && p.statutGlobal === "Soldé");
}

// Envoie le message groupé du super admin à toutes les personnes "en ordre".
// onProgression(envoyes, total) est appelé après chaque envoi pour permettre
// d'afficher une barre de progression (l'envoi se fait un par un, depuis le
// navigateur — il faut garder l'onglet ouvert jusqu'à la fin, il n'y a pas de
// serveur en arrière-plan pour continuer si la page se ferme).
export async function envoyerMessageGroupe({ message, superAdmin, onProgression }) {
  const destinataires = await listerPersonnesEnOrdre();
  let envoyes = 0;
  const echecs = [];

  for (const personne of destinataires) {
    try {
      await envoyerMessageUnique({ nomPersonne: personne.nom, emailPersonne: personne.email, message });
    } catch (err) {
      echecs.push(personne.email);
      console.error("Échec d'envoi à", personne.email, err);
    }
    envoyes += 1;
    onProgression?.(envoyes, destinataires.length);
  }

  await logAudit({
    utilisateur: superAdmin,
    typeAction: "ajout",
    cible: "message groupé",
    details: `Envoyé à ${destinataires.length - echecs.length}/${destinataires.length} destinataires.`,
  });

  return { total: destinataires.length, echecs };
}

// ---------- Paramètres de l'événement (espace super admin) ----------
// Stockés dans Firestore plutôt qu'en dur dans le code, pour que le super
// admin puisse les définir/mettre à jour depuis l'application (nom de
// l'activité, date, heure) — utilisés dans les e-mails automatiques.

const DEFAUT_PARAMETRES_EVENEMENT = {
  nomActivite: "MAYUNDO Party",
  date: "à définir",
  heure: "à définir",
};

export async function obtenirParametresEvenement() {
  try {
    const snap = await getDoc(doc(db, "parametres", "evenement"));
    return snap.exists() ? { ...DEFAUT_PARAMETRES_EVENEMENT, ...snap.data() } : DEFAUT_PARAMETRES_EVENEMENT;
  } catch (err) {
    console.error("Impossible de lire les paramètres de l'événement :", err);
    return DEFAUT_PARAMETRES_EVENEMENT;
  }
}

export async function definirParametresEvenement({ nomActivite, date, heure, superAdmin }) {
  await setDoc(doc(db, "parametres", "evenement"), { nomActivite, date, heure }, { merge: true });
  await logAudit({
    utilisateur: superAdmin,
    typeAction: "modification",
    cible: "paramètres de l'événement",
    details: `${nomActivite} — ${date} à ${heure}`,
  });
}

// ---------- Suppression complète d'une personne (super admin uniquement) ----------
// Contrairement aux corrections, ceci supprime réellement la personne ET tout
// son historique de paiements. Réservé au super admin (rôle le plus haut) et
// à utiliser avec précaution (ex. doublon créé par erreur, personne qui ne
// participe finalement pas). Chaque suppression est journalisée.
export async function supprimerPersonneEtHistorique({ personneId, personneNom, superAdmin }) {
  const q = query(paiementsRef, where("personneId", "==", personneId));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, "personnes", personneId));

  await logAudit({
    utilisateur: superAdmin,
    typeAction: "suppression",
    cible: `personne (${personneNom}) et son historique de paiements`,
    details: `${snap.docs.length} paiement(s) supprimé(s).`,
  });
}
