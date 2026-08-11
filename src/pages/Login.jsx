import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import { logConnexion } from "../services/caisseService";
import "./Login.css";

function messageErreurReset(err) {
  const code = err?.code || "";
  if (code === "auth/user-not-found") {
    return "Aucun compte Authentication avec cet e-mail. Vérifie qu'il existe bien dans Authentication (pas seulement dans Firestore).";
  }
  if (code === "auth/invalid-email") {
    return "Adresse e-mail invalide.";
  }
  if (code === "auth/too-many-requests") {
    return "Trop de tentatives. Attends quelques minutes puis réessaie.";
  }
  if (code === "auth/network-request-failed") {
    return "Problème réseau. Vérifie ta connexion puis réessaie.";
  }
  if (code.includes("unauthorized-continue-uri") || code.includes("invalid-continue-uri")) {
    return "Domaine non autorisé dans Firebase. Ajoute ton domaine dans Authentication → Settings → Authorized domains.";
  }
  return `Impossible d'envoyer l'e-mail (${code || "erreur inconnue"}). Vérifie la console Firebase (Authentication → Users).`;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [modeReinitialisation, setModeReinitialisation] = useState(false);
  const [statutReinitialisation, setStatutReinitialisation] = useState({ type: null, message: "" });
  const [envoiReinitialisation, setEnvoiReinitialisation] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      await logConnexion(cred.user);
      navigate("/");
    } catch (err) {
      setError("E-mail ou mot de passe incorrect.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRenvoyerEmail(e) {
    e.preventDefault();
    setStatutReinitialisation({ type: null, message: "" });
    if (!email.trim()) {
      setStatutReinitialisation({ type: "error", message: "Indique ton e-mail ci-dessus d'abord." });
      return;
    }
    setEnvoiReinitialisation(true);
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setStatutReinitialisation({
        type: "success",
        message: "E-mail envoyé (vérifie aussi tes spams) — clique sur le lien reçu pour définir ton mot de passe.",
      });
    } catch (err) {
      console.error("Réinitialisation mot de passe :", err?.code, err);
      setStatutReinitialisation({ type: "error", message: messageErreurReset(err) });
    } finally {
      setEnvoiReinitialisation(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <Link to="/" className="login-back">
          ← Accueil
        </Link>
        <span className="login-eyebrow">Caisse — MAYUNDO Party</span>
        <h1>Connexion</h1>
        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-field">
            <span>E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </label>
          <label className="login-field">
            <span>Mot de passe</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <button
          type="button"
          className="login-link"
          onClick={() => setModeReinitialisation((v) => !v)}
        >
          Mot de passe oublié / pas encore reçu l'e-mail d'activation ?
        </button>

        {modeReinitialisation && (
          <div className="login-reset-box">
            <p className="field-hint">
              Renvoie l'e-mail permettant de définir ton mot de passe, à l'adresse indiquée ci-dessus.
            </p>
            {statutReinitialisation.type && (
              <p className={statutReinitialisation.type === "error" ? "login-error" : "login-success"}>
                {statutReinitialisation.message}
              </p>
            )}
            <button
              type="button"
              className="login-submit"
              onClick={handleRenvoyerEmail}
              disabled={envoiReinitialisation}
            >
              {envoiReinitialisation ? "Envoi..." : "Renvoyer l'e-mail"}
            </button>
          </div>
        )}
      </div>
      <p className="login-footer">Réalisé par l'entreprise JENGA DIGITAL</p>
    </div>
  );
}
