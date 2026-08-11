// Chargement différé de xlsx / jspdf : ces libs sont lourdes, on ne les
// télécharge que quand l'utilisateur clique réellement sur Exporter.
//
// Une colonne se décrit ainsi :
//   { cle, titre, aligne?: "left" | "right" | "center", largeur?: nombre (mm) }
//
// ligneTotal : objet de la même forme qu'une ligne, affiché en pied de tableau
// (nombre de lignes exportées + total des montants).

const VERT_THEME = [27, 67, 50];
const VERT_WASH = [231, 239, 234];

export async function exporterExcel({ nomFichier, colonnes, lignes, ligneTotal = null }) {
  const XLSX = await import("xlsx");
  const enLignes = (ligne) => {
    const objet = {};
    colonnes.forEach((c) => {
      objet[c.titre] = ligne[c.cle] ?? "";
    });
    return objet;
  };
  const donnees = lignes.map(enLignes);
  if (ligneTotal) donnees.push(enLignes(ligneTotal));

  const feuille = XLSX.utils.json_to_sheet(donnees);
  // Largeur des colonnes calée sur le contenu réel, sinon tout est tronqué.
  feuille["!cols"] = colonnes.map((c) => ({
    wch: Math.min(
      40,
      Math.max(c.titre.length + 2, ...lignes.map((l) => String(l[c.cle] ?? "").length + 2), 8)
    ),
  }));

  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, "Données");
  XLSX.writeFile(classeur, `${nomFichier}.xlsx`);
}

export async function exporterPDF(params) {
  const doc = await construirePDF(params);
  doc.save(`${params.nomFichier}.pdf`);
}

// Construction séparée du téléchargement : permet de contrôler la mise en page
// (largeur des colonnes, débordements) sans déclencher un enregistrement.
export async function construirePDF({
  titre,
  sousTitre,
  colonnes,
  lignes,
  ligneTotal = null,
  orientation = "portrait",
}) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const largeurPage = doc.internal.pageSize.getWidth();

  doc.setFontSize(14);
  doc.text(titre, 10, 14);

  let departTableau = 20;
  if (sousTitre) {
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(sousTitre, 10, 20);
    doc.setTextColor(0);
    departTableau = 26;
  }

  autoTable(doc, {
    startY: departTableau,
    head: [colonnes.map((c) => c.titre)],
    body: lignes.map((ligne) => colonnes.map((c) => String(ligne[c.cle] ?? ""))),
    foot: ligneTotal ? [colonnes.map((c) => String(ligneTotal[c.cle] ?? ""))] : undefined,
    // Police compacte + retour à la ligne : c'est ce qui évite que les colonnes
    // se chevauchent ou débordent de la page quand un nom est long.
    styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: VERT_THEME, textColor: 255, fontSize: 8, fontStyle: "bold" },
    footStyles: { fillColor: VERT_WASH, textColor: VERT_THEME, fontSize: 8, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: Object.fromEntries(
      colonnes.map((c, i) => [
        i,
        { halign: c.aligne || "left", ...(c.largeur ? { cellWidth: c.largeur } : {}) },
      ])
    ),
    margin: { left: 10, right: 10, top: 14 },
    tableWidth: largeurPage - 20,
    // Numérotation : un export de 200 personnes fait plusieurs pages.
    didDrawPage: (data) => {
      const page = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(130);
      doc.text(
        `Page ${data.pageNumber} / ${page}`,
        largeurPage - 10,
        doc.internal.pageSize.getHeight() - 6,
        { align: "right" }
      );
      doc.setTextColor(0);
    },
  });

  return doc;
}
