// Chargement différé de xlsx / jspdf : ces libs sont lourdes, on ne les
// télécharge que quand l'utilisateur clique réellement sur Exporter.

// Exporte un tableau d'objets simples (colonnes = clés) en fichier Excel.
export async function exporterExcel({ nomFichier, colonnes, lignes }) {
  const XLSX = await import("xlsx");
  const donnees = lignes.map((ligne) => {
    const objet = {};
    colonnes.forEach((c) => {
      objet[c.titre] = ligne[c.cle];
    });
    return objet;
  });
  const feuille = XLSX.utils.json_to_sheet(donnees);
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, "Données");
  XLSX.writeFile(classeur, `${nomFichier}.xlsx`);
}

// Exporte le même tableau en PDF (titre + tableau).
export async function exporterPDF({ nomFichier, titre, colonnes, lignes }) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(titre, 14, 16);
  autoTable(doc, {
    startY: 22,
    head: [colonnes.map((c) => c.titre)],
    body: lignes.map((ligne) => colonnes.map((c) => String(ligne[c.cle] ?? ""))),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [27, 67, 50] }, // vert du thème
  });
  doc.save(`${nomFichier}.pdf`);
}
