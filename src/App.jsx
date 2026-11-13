import { useEffect, useMemo, useState } from 'react';
import { appelFonction, configOk, supabase } from './lib/supabase.js';
import { DonneesProvider, useDonnees } from './lib/donnees.jsx';
import { dateHeure } from './lib/outils.js';
import { Feuille, Icone } from './composants/ui.jsx';
import Connexion from './ecrans/Connexion.jsx';
import ACommander from './ecrans/ACommander.jsx';
import Base from './ecrans/Base.jsx';
import { Ruptures, MeilleuresVentes } from './ecrans/Shopify.jsx';
import Dropshipping, { VueChine } from './ecrans/Dropshipping.jsx';
import Retours from './ecrans/Retours.jsx';
import VenteVendeur from './ecrans/VenteVendeur.jsx';
import Reglages from './ecrans/Reglages.jsx';

export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    if (!configOk) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!configOk) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Configuration manquante</h1>
        <p>Les adresses de la base de données ne sont pas renseignées (VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY).</p>
      </div>
    );
  }
  if (session === undefined) return <p style={{ padding: 16 }}>Chargement…</p>;
  if (!session) return <Connexion />;
  return (
    <DonneesProvider session={session}>
      <Coque />
    </DonneesProvider>
  );
}

const ONGLETS = [
  { id: 'vente', label: "J'ai vendu un phare" },
  { id: 'a_commander', label: 'À commander' },
  { id: 'dropshipping', label: 'Dropshipping' },
  { id: 'base', label: 'Base Chine' },
  { id: 'ruptures', label: 'Ruptures' },
  { id: 'meilleures_ventes', label: 'Meilleures ventes' },
  { id: 'non_compatibles', label: 'Non compatibles' },
  { id: 'retours', label: 'Retours client' }
];

function Coque() {
  const d = useDonnees();
  const { profil, reglages, pret, enLigne, file, erreur, setErreur, synchro } = d;
  const role = profil?.role;
  const [onglet, setOnglet] = useState(null);
  const [menu, setMenu] = useState(false);

  const onglets = useMemo(() => {
    if (role === 'admin') return [...ONGLETS.filter((o) => o.id !== 'vente'), { id: 'reglages', label: 'Réglages' }];
    if (role === 'vendeur') {
      const ok = reglages?.onglets_vendeur || {};
      return ONGLETS.filter((o) => o.id === 'vente' || ok[o.id]);
    }
    return [];
  }, [role, reglages]);

  const compte = useMemo(
    () => ({
      a_commander: d.phares.filter((p) => p.statut === 'a_commander').length + (role === 'admin' ? d.ventes.filter((v) => v.statut === 'en_attente').length : 0),
      dropshipping: d.dropship.filter((x) => ['a_commander', 'commande', 'expedie'].includes(x.statut)).length,
      ruptures: new Set(d.shopify.filter((s) => (s.stock ?? 0) <= 0).map((s) => s.product_id)).size,
      non_compatibles: d.phares.filter((p) => p.non_compatible).length,
      retours: d.retours.filter((r) => r.statut === 'ouvert').length
    }),
    [d.phares, d.ventes, d.dropship, d.shopify, d.retours, role]
  );

  // L'admin déclenche une synchro Shopify si la dernière date de plus de 2 h
  // (la toute première synchro enregistre aussi la mise à jour automatique toutes les heures)
  const derniere = synchro?.derniere;
  useEffect(() => {
    if (role !== 'admin' || !enLigne || !synchro) return;
    if (derniere && Date.now() - new Date(derniere).getTime() < 2 * 3600 * 1000) return;
    let annule = false;
    appelFonction('sync-shopify', {})
      .catch(() => {})
      .finally(() => !annule && d.recharger());
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, enLigne, derniere, !!synchro]);

  const actif = onglets.find((o) => o.id === onglet) ? onglet : onglets[0]?.id;

  if (!pret) return <p style={{ padding: 16 }}>Chargement…</p>;
  if (!profil) {
    return (
      <div style={{ padding: 24, display: 'grid', gap: 12 }}>
        <p>{enLigne ? 'Ce compte n’a pas accès à l’appli ou a été bloqué.' : 'Pas de réseau : connecte-toi une première fois avec internet.'}</p>
        <button className="btn" onClick={() => supabase.auth.signOut()}>
          Se déconnecter
        </button>
      </div>
    );
  }

  const libRole = { admin: 'Administrateur', vendeur: profil.nom, chine: `${profil.nom} · Chine` }[role];

  return (
    <div className="app">
      <header className="top">
        <div style={{ minWidth: 0 }}>
          <div className="marque-fb">
            <span>FRANCE</span> BUMPER
          </div>
          <div className="sous-titre">Phares · {libRole}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="etat">
            <span className={enLigne ? 'pill-etat ok' : 'pill-etat'}>
              {enLigne ? <Icone.enLigne /> : <Icone.horsLigne />}
              {enLigne ? 'En ligne' : 'Hors connexion'}
            </span>
            {file.length > 0 ? (
              <small>{file.length} envoi{file.length > 1 ? 's' : ''} en attente</small>
            ) : role !== 'chine' ? (
              <small>Stock Shopify : {dateHeure(synchro?.derniere)}</small>
            ) : null}
          </div>
          <button type="button" className="btn-icone" onClick={() => setMenu(true)} aria-label="Mon compte">
            <Icone.reglages />
          </button>
        </div>
      </header>

      {role !== 'chine' && (
        <div className="collant">
          <nav className="onglets" role="tablist" aria-label="Onglets">
            {onglets.map((o) => (
              <button key={o.id} type="button" role="tab" className="onglet" aria-selected={actif === o.id} onClick={() => { setOnglet(o.id); window.scrollTo(0, 0); }}>
                {o.label}
                {compte[o.id] > 0 && <span className="n">{compte[o.id]}</span>}
              </button>
            ))}
          </nav>
        </div>
      )}

      {erreur && (
        <div style={{ padding: '0 16px' }}>
          <div className="bandeau erreur">
            <span>{erreur}</span>
            <button type="button" onClick={() => setErreur(null)} aria-label="Fermer le message">
              ×
            </button>
          </div>
        </div>
      )}

      {role === 'chine' && <VueChine />}
      {actif === 'vente' && <VenteVendeur />}
      {actif === 'a_commander' && <ACommander />}
      {actif === 'dropshipping' && <Dropshipping />}
      {actif === 'base' && <Base mode="base" />}
      {actif === 'non_compatibles' && <Base mode="non_compatibles" />}
      {actif === 'ruptures' && <Ruptures />}
      {actif === 'meilleures_ventes' && <MeilleuresVentes />}
      {actif === 'retours' && <Retours />}
      {actif === 'reglages' && <Reglages />}

      {menu && (
        <Feuille titre="Mon compte" onFermer={() => setMenu(false)}>
          <div className="bloc">
            <div>
              <div className="lab">Connecté</div>
              <div className="val">
                {profil.nom} ({profil.identifiant})
              </div>
            </div>
            <div className="details">
              {enLigne ? 'En ligne' : 'Hors connexion'} · {file.length} envoi(s) en attente
            </div>
          </div>
          <button type="button" className="btn" onClick={() => { d.recharger(); setMenu(false); }} disabled={!enLigne}>
            Rafraîchir les données
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={async () => {
              if (file.length && !window.confirm('Des envois sont encore en attente. Te déconnecter quand même ? Ils seront perdus.')) return;
              await supabase.auth.signOut();
            }}
          >
            Se déconnecter
          </button>
        </Feuille>
      )}
    </div>
  );
}
