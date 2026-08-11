import { useId, useState } from "react";
import { IconChevronRight } from "./Icons";

// Section dépliable, utilisée pour tous les tableaux de l'application.
// Avec ~200 payeurs, empiler tous les tableaux à l'écran rend les pages
// interminables : chaque tableau reste replié et ne s'ouvre qu'à la demande.
// Le compteur affiché dans l'en-tête permet de savoir s'il y a quelque chose
// à l'intérieur SANS avoir à ouvrir — utile notamment pendant une recherche.
//
// nombre       : nombre de lignes du tableau (affiché en pastille)
// sousTitre    : courte explication, visible même replié
// defautOuvert : ouvre la section au premier affichage
export default function SectionRepliable({
  titre,
  sousTitre,
  nombre = null,
  defautOuvert = false,
  children,
}) {
  const [ouvert, setOuvert] = useState(defautOuvert);
  const idContenu = useId();

  return (
    <section className={`section-repliable${ouvert ? " ouverte" : ""}`}>
      <button
        type="button"
        className="section-repliable-entete"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-controls={idContenu}
      >
        <span className="section-repliable-chevron" aria-hidden="true">
          <IconChevronRight size={16} />
        </span>
        <span className="section-repliable-titre">
          {titre}
          {nombre !== null && <span className="section-repliable-compteur">{nombre}</span>}
        </span>
        <span className="section-repliable-action">{ouvert ? "Masquer" : "Afficher"}</span>
      </button>

      {sousTitre && <p className="section-repliable-soustitre">{sousTitre}</p>}

      {/* Contenu monté uniquement à l'ouverture : inutile de faire rendre des
          centaines de lignes de tableau tant que personne ne les regarde. */}
      {ouvert && (
        <div className="section-repliable-contenu" id={idContenu}>
          {children}
        </div>
      )}
    </section>
  );
}
