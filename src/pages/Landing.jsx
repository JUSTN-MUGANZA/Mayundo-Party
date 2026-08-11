import { Link } from "react-router-dom";
import { useAuth } from "../context/contexteAuth";
import HomeRedirect from "./HomeRedirect";
import affiche from "../assets/affiche-mayundo.png";
import "./Landing.css";

export default function Landing() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="landing-loading">Chargement...</p>;
  }
  if (user) {
    return <HomeRedirect />;
  }

  return (
    <div className="landing">
      <header className="landing-nav">
        <span className="landing-nav-brand">MAYUNDO FAMILY</span>
        <Link to="/login" className="landing-nav-link">
          Connexion
        </Link>
      </header>

      <section className="landing-hero">
        <img
          src={affiche}
          alt="Affiche MAYUNDO FAMILY PARTY 2026"
          className="landing-hero-img"
        />
        <div className="landing-hero-veil" aria-hidden="true" />
        <div className="landing-hero-content">
          <p className="landing-eyebrow">Une soirée exceptionnelle finale</p>
          <h1 className="landing-brand">MAYUNDO FAMILY</h1>
          <p className="landing-tag">PARTY 2026 · BAC+3 IG · Bukavu</p>
          <p className="landing-lead">
            Une soirée inoubliable, ouverte à tous — organisée par les étudiants
            de la BAC3 Informatique de Gestion.
          </p>
          <div className="landing-cta">
            <Link to="/login" className="landing-btn landing-btn-primary">
              Accéder à la caisse
            </Link>
            <a href="#invitation" className="landing-btn landing-btn-ghost">
              Découvrir l&apos;événement
            </a>
          </div>
        </div>
      </section>

      <section id="invitation" className="landing-section">
        <h2>L&apos;invitation</h2>
        <p>
          Bonsoir à tous. Nous vous invitons à notre fête{" "}
          <strong>MAYUNDO FAMILLE / MASTER CLASS</strong> — une soirée
          exceptionnelle où beaux garçons, belles filles et artistes se
          retrouvent pour vous divertir.
        </p>
        <p>
          Nourriture, boissons et consommations : la communauté se charge de
          tout. Organisée par les étudiants de la BAC3 IG,{" "}
          <strong>tout le monde est cordialement invité</strong>.
        </p>
        <p className="landing-closing">
          Nous vous attendons nombreux pour vivre une soirée inoubliable.
        </p>
      </section>

      <section className="landing-section landing-infos">
        <h2>Infos pratiques</h2>
        <ul className="landing-meta">
          <li>
            <span>Date</span>
            <strong>Mercredi 02 septembre 2026</strong>
          </li>
          <li>
            <span>Heure</span>
            <strong>17h00</strong>
          </li>
          <li>
            <span>Lieu</span>
            <strong>Salle New Alliance</strong>
          </li>
          <li>
            <span>Étudiants &amp; invités</span>
            <strong>20 $</strong>
          </li>
          <li>
            <span>Membres du comité</span>
            <strong>30 $</strong>
          </li>
        </ul>
      </section>

      <section className="landing-section landing-creator">
        <h2>Le créateur</h2>
        <p>
          Application réalisée par <strong>Lubunga Justin</strong> — JENGA
          DIGITAL.
        </p>
        <a
          href="https://lubunga-portfolio.netlify.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="landing-btn landing-btn-primary"
        >
          Visiter le portfolio
        </a>
      </section>

      <footer className="landing-footer">
        <Link to="/login">Se connecter</Link>
        <span>© {new Date().getFullYear()} MAYUNDO FAMILY · BAC3 IG Bukavu</span>
      </footer>
    </div>
  );
}
