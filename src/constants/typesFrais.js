// Types de frais fixés par le comité organisateur.
// Un "invité simple" (étudiant non-membre) paie normalement les 3 frais
// Fête + T-shirt + Défense (10 + 5 + 5 = 20 $ au total).
// Un "membre du comité" paie plutôt le "Frais de comité" (30 $).
// Gardés en dur ici (plutôt qu'en base) puisqu'ils ne changent pas souvent
// et que le projet vise une stack la plus simple possible.
export const TYPES_FRAIS = [
  { id: "fete", label: "Fête", montant: 10 },
  { id: "tshirt", label: "T-shirt", montant: 5 },
  { id: "defense", label: "Défense", montant: 5 },
  { id: "comite", label: "Frais de comité (membre)", montant: 30 },
];

// Frais d'un invité (étudiant) : fête + t-shirt + défense = 20 $.
// L'e-mail de confirmation part uniquement quand ce total est atteint,
// pas à chaque tranche soldée individuellement.
export const IDS_FRAIS_INVITE = ["fete", "tshirt", "defense"];
export const TOTAL_FRAIS_INVITE = TYPES_FRAIS
  .filter((t) => IDS_FRAIS_INVITE.includes(t.id))
  .reduce((s, t) => s + t.montant, 0);

export function getTypeFrais(id) {
  return TYPES_FRAIS.find((t) => t.id === id);
}
