import { useEffect, useState } from 'react';
import { appelFonction, emailDe, supabase } from '../lib/supabase.js';
import { Champ } from '../composants/ui.jsx';

export default function Connexion() {
  const [mode, setMode] = useState('chargement');
  const [nom, setNom] = useState('');
  const [identifiant, setIdentifiant] = useState('');
  const [mdp, setMdp] = useState('');
  const [mdp2, setMdp2] = useState('');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    supabase
      .rpc('admin_existe')
      .then(({ data, error }) => setMode(!error && data === false ? 'init' : 'connexion'))
      .catch(() => setMode('connexion'));
  }, []);

  async function seConnecter(e) {
    e.preventDefault();
    setErreur('');
    setOccupe(true);
    const { error } = await supabase.auth.signInWithPassword({ email: emailDe(identifiant), password: mdp });
    setOccupe(false);
    if (error) {
      setErreur(
        /fetch|network/i.test(error.message)
          ? 'Pas de réseau. La première connexion doit se faire avec internet.'
          : /banned/i.test(error.message)
          ? 'Ce compte est bloqué. Demande à ton responsable.'
          : 'Identifiant ou mot de passe incorrect.'
      );
    }
  }

  async function creerAdmin(e) {
    e.preventDefault();
    setErreur('');
    if (mdp !== mdp2) return setErreur('Les deux mots de passe ne sont pas identiques.');
    setOccupe(true);
    try {
      await appelFonction('comptes', { action: 'init', nom, identifiant: identifiant.toLowerCase(), mot_de_passe: mdp });
      const { error } = await supabase.auth.signInWithPassword({ email: emailDe(identifiant), password: mdp });
      if (error) throw error;
    } catch (err) {
      setErreur(err.message);
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className="connexion">
      <header className="top">
        <div>
          <div className="marque-fb">
            <span>FRANCE</span> BUMPER
          </div>
          <div className="sous-titre">Phares · commandes, ruptures et dropshipping</div>
        </div>
      </header>
      {mode === 'chargement' && <p style={{ padding: 16 }}>Chargement…</p>}
      {mode === 'connexion' && (
        <form onSubmit={seConnecter}>
          <h1>Connexion</h1>
          <Champ label="Identifiant">
            <input value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="username" required />
          </Champ>
          <Champ label="Mot de passe">
            <input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} autoComplete="current-password" required />
          </Champ>
          {erreur && <div className="bandeau erreur">{erreur}</div>}
          <button className="btn btn-rouge" disabled={occupe}>
            {occupe ? 'Connexion…' : 'Se connecter'}
          </button>
          <p className="aide">Une fois connecté, l'appli marche aussi sans réseau.</p>
        </form>
      )}
      {mode === 'init' && (
        <form onSubmit={creerAdmin}>
          <h1>Premier lancement</h1>
          <p className="aide" style={{ fontSize: 14 }}>
            Crée ton compte administrateur. Tu pourras ensuite créer les comptes de tes vendeurs et de ton collègue en Chine.
          </p>
          <Champ label="Ton nom">
            <input value={nom} onChange={(e) => setNom(e.target.value)} required />
          </Champ>
          <Champ label="Identifiant" aide="Lettres minuscules et chiffres, sans espace (ex. patron)">
            <input value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} autoCapitalize="none" autoCorrect="off" required />
          </Champ>
          <Champ label="Mot de passe" aide="8 caractères minimum">
            <input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} autoComplete="new-password" required minLength={8} />
          </Champ>
          <Champ label="Mot de passe (encore)">
            <input type="password" value={mdp2} onChange={(e) => setMdp2(e.target.value)} autoComplete="new-password" required minLength={8} />
          </Champ>
          {erreur && <div className="bandeau erreur">{erreur}</div>}
          <button className="btn btn-rouge" disabled={occupe}>
            {occupe ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>
      )}
    </div>
  );
}
