// Petits utilitaires d'affichage partagés par les trois tableaux de bord.

// Timestamp Firestore -> "12/08 14:30"
export function formatDateCourte(timestamp) {
  if (!timestamp?.seconds) return "—";
  return new Date(timestamp.seconds * 1000).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Timestamp Firestore -> "12/08/2026 14:30"
export function formatDate(timestamp) {
  if (!timestamp?.seconds) return "—";
  return new Date(timestamp.seconds * 1000).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function libelleDevise(devise) {
  return devise === "CDF" ? "FC" : "$";
}

// Cycle de vie d'une demande de correction :
// en_attente -> (accordee -> traitee) | refusee
export const LABEL_STATUT_DEMANDE = {
  en_attente: "En attente de l'admin",
  accordee: "En cours de traitement",
  traitee: "Corrigée",
  refusee: "Refusée",
};

export function classeBadgeStatutDemande(statut) {
  if (statut === "traitee") return "badge-solde";
  if (statut === "refusee") return "badge-annule";
  return "badge-partiel";
}
