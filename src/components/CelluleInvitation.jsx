import { useState } from "react";
import { marquerInvitationDistribuee } from "../services/caisseService";
import { STATUTS_INVITATION, LABEL_STATUT_INVITATION } from "../constants/invitation";
import { formatDateCourte } from "../utils/format";

// Cellule "Invitation" partagée par tous les écrans qui listent des personnes.
// Trois états :
//   "--"                 tant que l'entrée n'est pas soldée
//   [DONNER INVITATION]  dès que l'entrée est soldée
//   "Distribuée"         une fois le billet remis
//
// Le passage à "Distribuée" est irréversible : il constate la remise d'un
// billet physique. Une confirmation est donc demandée, pour qu'un appui
// involontaire sur un téléphone ne consomme pas l'invitation de quelqu'un.
//
// peutDonner = false rend la cellule purement informative (rôle en lecture seule).
export default function CelluleInvitation({ personne, utilisateur, peutDonner = true, onChange }) {
  const [confirmation, setConfirmation] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  async function handleDonner() {
    setEnvoi(true);
    setErreur("");
    try {
      await marquerInvitationDistribuee({
        personneId: personne.id,
        personneNom: personne.nom,
        utilisateur,
      });
      setConfirmation(false);
      await onChange?.();
    } catch (err) {
      console.error("Remise de l'invitation :", err);
      setErreur(
        err?.code === "permission-denied"
          ? "Ton rôle ne permet pas de remettre une invitation."
          : "Échec de l'enregistrement."
      );
    } finally {
      setEnvoi(false);
    }
  }

  if (personne.statutInvitation === STATUTS_INVITATION.DISTRIBUEE) {
    return (
      <span>
        <span className="badge badge-solde">
          {LABEL_STATUT_INVITATION[STATUTS_INVITATION.DISTRIBUEE]}
        </span>
        {personne.invitationDate && (
          <div className="field-hint">{formatDateCourte(personne.invitationDate)}</div>
        )}
        {personne.invitationParEmail && (
          <div className="field-hint">Par {personne.invitationParEmail}</div>
        )}
      </span>
    );
  }

  if (personne.statutInvitation === STATUTS_INVITATION.INDISPONIBLE) {
    return <span className="field-hint">{LABEL_STATUT_INVITATION[STATUTS_INVITATION.INDISPONIBLE]}</span>;
  }

  // Entrée soldée : l'invitation reste à remettre.
  if (!peutDonner) {
    return (
      <span className="badge badge-partiel">
        {LABEL_STATUT_INVITATION[STATUTS_INVITATION.A_DONNER]}
      </span>
    );
  }

  if (confirmation) {
    return (
      <span className="correction-box">
        <span className="field-hint">Invitation remise à {personne.nom} ?</span>
        <button className="btn btn-primary btn-compact" onClick={handleDonner} disabled={envoi}>
          {envoi ? "..." : "Confirmer"}
        </button>
        <button className="link-button" onClick={() => setConfirmation(false)}>
          ×
        </button>
        {erreur && <span className="field-hint">{erreur}</span>}
      </span>
    );
  }

  return (
    <button className="btn btn-primary btn-compact" onClick={() => setConfirmation(true)}>
      DONNER INVITATION
    </button>
  );
}
