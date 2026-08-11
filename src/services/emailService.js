import emailjs from "@emailjs/browser";

// ---------- Configuration EmailJS — Compte 1 ----------
// Réservé aux e-mails "activation de compte" (admin/caissier) et
// "paiement confirmé". Le message groupé de la veille de la fête utilisera
// un compte EmailJS séparé (voir Compte 2, à configurer plus tard).
const SERVICE_ID = "service_e2iamen";
const PUBLIC_KEY = "03a0LYJYud80Yg2zW";

// Template pour le mail envoyé quand un paiement est intégralement soldé.
// ⚠️ À remplacer par le vrai Template ID une fois créé sur EmailJS (le
// template "activation compte" ci-dessous est déjà configuré, celui-ci est
// un template différent, dédié à la confirmation de paiement).
const TEMPLATE_PAIEMENT_CONFIRME = "template_x3u7tpd";

// Template pour le mail envoyé à un nouvel admin/caissier pour activer son
// compte (définir son mot de passe).
const TEMPLATE_ACTIVATION_COMPTE = "template_mmwnosd";

// ---------- Informations de l'événement ----------
// À ajuster une fois la date/heure définitive connue — utilisées dans le
// mail de confirmation de paiement (billet d'entrée).
export const INFOS_EVENEMENT = {
  nomActivite: "MAYUNDO Party",
  date: "à définir",
  heure: "à définir",
};

const SIGNATURE = "Réalisé par l'entreprise JENGA DIGITAL";

// Envoie un e-mail de confirmation quand un invité a totalisé les 20 $
// (fête + t-shirt + défense), ou quand un membre a soldé son frais de comité.
// Jamais pour une tranche partielle d'invité. N'échoue jamais bruyamment :
// si l'e-mail ne part pas, on log et on continue — ça ne doit jamais bloquer
// l'enregistrement du paiement dans Firestore.
// elements : [{ typeFraisId, typeFraisLabel, montant }]
export async function envoyerEmailConfirmation({ nomPersonne, emailPersonne, elements, parametresEvenement }) {
  if (!emailPersonne) {
    console.warn("Pas d'e-mail renseigné pour", nomPersonne, "— confirmation non envoyée.");
    return false;
  }
  if (!elements || elements.length === 0) return false;

  const evenement = parametresEvenement || INFOS_EVENEMENT;
  const concerneEntree = elements.some((e) => e.typeFraisId === "fete" || e.typeFraisId === "comite");
  const messageBillet = concerneEntree
    ? `Vous pouvez passer chez le président de la fête pour récupérer votre billet d'entrée.`
    : "";

  const typeFrais = elements.map((e) => e.typeFraisLabel).join(", ");
  const montantTotal = elements.reduce((s, e) => s + e.montant, 0);

  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_PAIEMENT_CONFIRME,
    {
      to_name: nomPersonne,
      to_email: emailPersonne,
      type_frais: typeFrais,
      montant_total: montantTotal,
      nom_activite: evenement.nomActivite,
      date_activite: evenement.date,
      heure_activite: evenement.heure,
      message_billet: messageBillet,
      signature: SIGNATURE,
    },
    { publicKey: PUBLIC_KEY }
  );
  return true;
}

// Envoie l'e-mail de bienvenue/activation à un nouvel admin ou caissier créé
// par un supérieur. Contient le lien Firebase de création de mot de passe
// (voir services/caisseService.js — creerCompteUtilisateur), inséré via le
// paramètre lienActivation.
export async function envoyerEmailActivationCompte({ nom, email, role, lienActivation }) {
  const labelRole = role === "admin" ? "administrateur" : "caissier";
  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_ACTIVATION_COMPTE,
    {
      to_name: nom,
      to_email: email,
      role: labelRole,
      nom_systeme: INFOS_EVENEMENT.nomActivite,
      lien_activation: lienActivation,
      signature: SIGNATURE,
    },
    { publicKey: PUBLIC_KEY }
  );
}

// ---------- Configuration EmailJS — Compte 2 ----------
// Compte séparé, réservé au message groupé envoyé par le super admin
// (ex. la veille de la fête). Garde ce volume d'envoi isolé du Compte 1
// (activation de compte + confirmation de paiement) pour ne pas dépasser
// le quota gratuit d'un seul compte avec ~200 étudiants.
// ⚠️ À remplacer une fois le compte et le template créés sur EmailJS.
const SERVICE_ID_COMPTE2 = "service_kpip0yy";
const TEMPLATE_MESSAGE_GROUPE = "template_61vt9wf";
const PUBLIC_KEY_COMPTE2 = "Gg2T6TSPMnNfe2MU4";

// Envoie un message personnalisé (écrit par le super admin) à une seule
// personne. Utilisée en boucle par la page Message groupé du super admin.
export async function envoyerMessageUnique({ nomPersonne, emailPersonne, message }) {
  await emailjs.send(
    SERVICE_ID_COMPTE2,
    TEMPLATE_MESSAGE_GROUPE,
    {
      to_name: nomPersonne,
      to_email: emailPersonne,
      message_personnalise: message,
      nom_activite: INFOS_EVENEMENT.nomActivite,
      signature: SIGNATURE,
    },
    { publicKey: PUBLIC_KEY_COMPTE2 }
  );
}
