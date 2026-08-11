// États possibles de l'invitation (billet d'entrée) d'une personne.
// L'invitation ne peut être remise qu'une fois l'entrée soldée : 10 $ de fête
// pour un invité, 30 $ de frais pour un membre du comité.
export const STATUTS_INVITATION = {
  INDISPONIBLE: "indisponible", // entrée pas encore soldée -> "--"
  A_DONNER: "a_donner", // entrée soldée, invitation pas encore remise
  DISTRIBUEE: "distribuee", // invitation remise à la personne
};

export const LABEL_STATUT_INVITATION = {
  [STATUTS_INVITATION.INDISPONIBLE]: "--",
  [STATUTS_INVITATION.A_DONNER]: "À donner",
  [STATUTS_INVITATION.DISTRIBUEE]: "Distribuée",
};

// Filtres proposés dans les listes de personnes.
export const FILTRES_INVITATION = [
  { id: "tous", label: "Toutes les invitations" },
  { id: STATUTS_INVITATION.A_DONNER, label: "À donner" },
  { id: STATUTS_INVITATION.DISTRIBUEE, label: "Déjà distribuées" },
  { id: STATUTS_INVITATION.INDISPONIBLE, label: "Entrée non soldée" },
];
