import { Component } from "react";

// Sans ce garde-fou, la moindre erreur de rendu démonte tout l'arbre React et
// laisse une page entièrement blanche, sans aucune indication — impossible à
// diagnostiquer pour la personne qui utilise l'application sur son téléphone.
// Doit rester un composant de classe : React n'a pas d'équivalent en hook.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { erreur: null };
  }

  static getDerivedStateFromError(erreur) {
    return { erreur };
  }

  componentDidCatch(erreur, info) {
    console.error("Erreur de rendu :", erreur, info);
  }

  render() {
    if (!this.state.erreur) return this.props.children;

    return (
      <div style={{ maxWidth: 520, margin: "80px auto", padding: 24, textAlign: "center" }}>
        <h1 style={{ fontSize: 20, marginBottom: 12 }}>Une erreur est survenue</h1>
        <p style={{ marginBottom: 16 }}>
          L'affichage de cette page a échoué. Recharge la page ; si le problème persiste,
          transmets le message ci-dessous à l'administrateur.
        </p>
        <pre
          style={{
            textAlign: "left",
            fontSize: 12,
            padding: 12,
            borderRadius: 8,
            background: "#f4f4f4",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {this.state.erreur?.message || String(this.state.erreur)}
        </pre>
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: 16 }}
          onClick={() => window.location.reload()}
        >
          Recharger la page
        </button>
      </div>
    );
  }
}
