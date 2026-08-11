// Taux de change fixe utilisé pour tout le système : 1 $ = 2400 FC.
// Les types de frais sont définis en dollars ; toute tranche saisie en FC
// est convertie en équivalent dollars pour les calculs de solde et les totaux.
export const TAUX_FC_PAR_USD = 2400;

export const DEVISES = [
  { id: "USD", label: "$ (Dollar)" },
  { id: "CDF", label: "FC (Franc congolais)" },
];

export function convertirEnUSD(montant, devise) {
  if (devise === "CDF") return montant / TAUX_FC_PAR_USD;
  return montant;
}

export function convertirUSDenFC(montantUSD) {
  return montantUSD * TAUX_FC_PAR_USD;
}

export function formaterFC(montantFC) {
  return Math.round(montantFC).toLocaleString("fr-FR");
}
