// Chiffre d'affaires du site : visible seulement par le patron.
// Chiffre « Ventes totales » de Shopify (TTC, livraison comprise, remises et remboursements déduits), lu en lecture seule.
import { useCallback, useEffect, useState } from 'react';
import { useDonnees } from '../lib/donnees.jsx';
import { appelFonction, supabase } from '../lib/supabase.js';
import { euro } from '../lib/outils.js';

const CLE_CACHE = 'chiffre-affaires-dernier';

const lireCache = () => {
  try {
    return JSON.parse(localStorage.getItem(CLE_CACHE) || 'null');
  } catch {
    return null;
  }
};

function base64UrlVersOctets(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const s = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

const estIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const estInstallee = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
const pushDispo = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function Tuile({ titre, sous, valeur, commandes }) {
  return (
    <div className="tuile-ca">
      <div className="tuile-ca-titre">{titre}</div>
      {sous && <div className="tuile-ca-sous">{sous}</div>}
      <div className="tuile-ca-valeur">{valeur == null ? '—' : euro(valeur)}</div>
      {commandes != null && (
        <div className="tuile-ca-sous">
          {commandes} commande{commandes > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

function Notifications() {
  const d = useDonnees();
  const [etat, setEtat] = useState('verif'); // verif | indispo | a_installer | refuse | inactif | actif
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState('');

  const verifier = useCallback(async () => {
    if (!pushDispo()) {
      setEtat(estIOS() && !estInstallee() ? 'a_installer' : 'indispo');
      return;
    }
    if (estIOS() && !estInstallee()) {
      setEtat('a_installer');
      return;
    }
    if (Notification.permission === 'denied') {
      setEtat('refuse');
      return;
    }
    try {
      const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((_, ko) => setTimeout(() => ko(new Error('délai')), 5000))]);
      const abo = await reg.pushManager.getSubscription();
      setEtat(abo && Notification.permission === 'granted' ? 'actif' : 'inactif');
    } catch {
      setEtat('inactif');
    }
  }, []);

  useEffect(() => {
    verifier();
  }, [verifier]);

  async function activer() {
    setOccupe(true);
    setMessage('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setEtat(permission === 'denied' ? 'refuse' : 'inactif');
        return;
      }
      const { cle } = await appelFonction('chiffre-affaires', { action: 'cle_push' });
      const reg = await navigator.serviceWorker.ready;
      let abo = await reg.pushManager.getSubscription();
      if (!abo) abo = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlVersOctets(cle) });
      const j = abo.toJSON();
      const { error } = await supabase.from('push_abonnements').upsert(
        { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, appareil: navigator.userAgent.slice(0, 200) },
        { onConflict: 'endpoint' }
      );
      if (error) throw error;
      setEtat('actif');
      setMessage('Notifications activées sur ce téléphone. Tu recevras le chiffre tous les jours à 18 h 30.');
    } catch (e) {
      d.setErreur(`Activation impossible : ${e.message || e}`);
    } finally {
      setOccupe(false);
    }
  }

  async function tester() {
    setOccupe(true);
    setMessage('');
    try {
      const r = await appelFonction('chiffre-affaires', { action: 'test_push' });
      setMessage(r.envoyees ? 'Notification de test envoyée : elle arrive dans quelques secondes.' : 'Aucun téléphone abonné : réactive les notifications.');
    } catch (e) {
      d.setErreur(e.message);
    } finally {
      setOccupe(false);
    }
  }

  async function desactiver() {
    setOccupe(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const abo = await reg.pushManager.getSubscription();
      if (abo) {
        await supabase.from('push_abonnements').delete().eq('endpoint', abo.endpoint);
        await abo.unsubscribe();
      }
      setEtat('inactif');
      setMessage('Notifications coupées sur ce téléphone.');
    } catch (e) {
      d.setErreur(e.message);
    } finally {
      setOccupe(false);
    }
  }

  return (
    <section className="bloc-notif">
      <h2 className="groupe">Notification tous les jours à 18 h 30</h2>
      {etat === 'verif' && <p className="details">Vérification…</p>}
      {etat === 'a_installer' && (
        <p className="details">
          Sur iPhone, les notifications ne marchent que dans l’appli installée sur l’écran d’accueil. Ouvre l’appli depuis son icône « Phares FB », puis reviens ici.
        </p>
      )}
      {etat === 'indispo' && <p className="details">Ce navigateur ne permet pas les notifications. Ouvre l’appli depuis son icône sur l’écran d’accueil du téléphone.</p>}
      {etat === 'refuse' && (
        <p className="details">
          Les notifications sont bloquées pour l’appli. Sur iPhone : Réglages › Notifications › Phares FB › Autoriser les notifications. Puis reviens ici et appuie sur « Activer ».
        </p>
      )}
      {etat === 'inactif' && <p className="details">Pas encore activées sur ce téléphone.</p>}
      {etat === 'actif' && <p className="details">Activées sur ce téléphone ✓</p>}
      {message && <p className="details" style={{ color: 'var(--vert-texte)' }}>{message}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        {(etat === 'inactif' || etat === 'refuse') && (
          <button type="button" className="btn btn-plein" disabled={occupe || !d.enLigne} onClick={activer}>
            {occupe ? 'Un instant…' : 'Activer les notifications'}
          </button>
        )}
        {etat === 'actif' && (
          <>
            <button type="button" className="btn btn-plein" disabled={occupe || !d.enLigne} onClick={tester}>
              Envoyer une notification de test
            </button>
            <button type="button" className="btn" disabled={occupe} onClick={desactiver}>
              Couper sur ce téléphone
            </button>
          </>
        )}
      </div>
    </section>
  );
}

export default function ChiffreAffaires() {
  const d = useDonnees();
  const [ca, setCa] = useState(lireCache);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    if (!navigator.onLine) return;
    setOccupe(true);
    setErreur('');
    try {
      const r = await appelFonction('chiffre-affaires', { action: 'lire' });
      setCa(r);
      try {
        localStorage.setItem(CLE_CACHE, JSON.stringify(r));
      } catch {
        /* stockage plein */
      }
    } catch (e) {
      setErreur(e.message || String(e));
    } finally {
      setOccupe(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const lu = ca?.lu_le ? new Date(ca.lu_le) : null;
  const maintenant = new Date();
  const nomMois = maintenant.toLocaleDateString('fr-FR', { month: 'long', timeZone: 'Europe/Paris' });

  return (
    <main>
      <div className="bandeau" style={{ display: 'grid', gap: 6 }}>
        <span>
          Chiffre « Ventes totales » de Shopify : TTC, livraison comprise, remises et remboursements déduits. Lu sur Shopify en lecture seule.
          {lu ? ` Mis à jour à ${lu.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.` : ''}
        </span>
        <button type="button" className="lien-btn" disabled={occupe || !d.enLigne} onClick={charger}>
          {occupe ? 'Lecture en cours…' : d.enLigne ? 'Actualiser' : 'Hors connexion : dernier chiffre connu'}
        </button>
      </div>
      {erreur && <div className="bandeau erreur"><span>{erreur}</span></div>}
      <div className="tuiles-ca">
        <Tuile titre="Aujourd’hui" sous={maintenant.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })} valeur={ca?.jour?.total} commandes={ca?.jour?.commandes} />
        <Tuile titre="Ce mois-ci" sous={nomMois.charAt(0).toUpperCase() + nomMois.slice(1)} valeur={ca?.mois?.total} commandes={ca?.mois?.commandes} />
        <Tuile titre="Cette année" sous={String(maintenant.getFullYear())} valeur={ca?.annee?.total} commandes={ca?.annee?.commandes} />
      </div>
      <Notifications />
    </main>
  );
}
