import { useEffect, useState } from 'react';
import { useDonnees } from '../lib/donnees.jsx';
import { appelFonction } from '../lib/supabase.js';
import { Champ, Feuille, Interrupteur, Segments } from '../composants/ui.jsx';
import { BandeauSynchro } from './Shopify.jsx';
import ImportAncienne from './ImportAncienne.jsx';

const ONGLETS = [
  ['a_commander', 'À commander'],
  ['dropshipping', 'Dropshipping'],
  ['base', 'Base Chine'],
  ['base2', 'Base 2'],
  ['commande', 'Commande phare'],
  ['ruptures', 'Rupture phares'],
  ['meilleures_ventes', 'Meilleures ventes phares site'],
  ['non_compatibles', 'Non compatibles'],
  ['retours', 'Retours client'],
  ['peinture', 'Peinture']
];
const CHAMPS = [
  ['prix_vente', 'Prix de vente'],
  ['prix_achat', "Prix d'achat"],
  ['marge', 'Marge'],
  ['fournisseur', 'Fournisseur, lien et réf. fournisseur']
];
const ROLES = { admin: 'Administrateur', vendeur: 'Vendeur', chine: 'Collègue Chine', lecteur: 'Lecture seule' };

export default function Reglages() {
  const d = useDonnees();
  const r = d.reglages || {};
  const [comptes, setComptes] = useState(d.equipe);
  const [nouveau, setNouveau] = useState(false);
  const [edition, setEdition] = useState(null);
  const [filtre, setFiltre] = useState(r.filtre_shopify || 'title:phare* AND NOT title:pare*');
  const [msg, setMsg] = useState('');

  const chargerComptes = async () => {
    try {
      const res = await appelFonction('comptes', { action: 'liste' });
      setComptes(res.comptes);
    } catch {
      /* hors connexion : on garde la liste en cache */
    }
  };
  useEffect(() => {
    if (d.enLigne) chargerComptes();
  }, [d.enLigne]);

  const basculerOnglet = (k) => (v) => d.enregistrerReglages({ onglets_vendeur: { ...(r.onglets_vendeur || {}), [k]: v } });
  const basculerChamp = (k) => (v) => d.enregistrerReglages({ champs_vendeur: { ...(r.champs_vendeur || {}), [k]: v } });

  async function modifierCompte(id, champs) {
    setMsg('');
    try {
      await appelFonction('comptes', { action: 'modifier', id, ...champs });
      await chargerComptes();
      d.recharger();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function accesFournisseurs(id, valeur) {
    setMsg('');
    setComptes((l) => l.map((c) => (c.id === id ? { ...c, acces_fournisseurs: valeur } : c)));
    try {
      await appelFonction('comptes', { action: 'acces_fournisseurs', id, valeur });
    } catch (e) {
      setMsg(e.message);
    }
    await chargerComptes();
  }

  return (
    <main>
      <h2 className="groupe">Shopify</h2>
      <BandeauSynchro />
      <div className="bloc" style={{ background: 'var(--carte)' }}>
        <Champ label="Quels produits Shopify sont des phares ?" aide="Recherche Shopify. Par défaut : les produits dont le titre contient « phare », sans les pare-chocs. Les pare-chocs sont de toute façon toujours exclus.">
          <div className="avec-bouton">
            <input value={filtre} onChange={(e) => setFiltre(e.target.value)} />
            <button type="button" className="petit-bouton neutre" disabled={filtre === r.filtre_shopify} onClick={() => d.enregistrerReglages({ filtre_shopify: filtre.trim() || 'title:phare* AND NOT title:pare*' })}>
              OK
            </button>
          </div>
        </Champ>
      </div>

      <h2 className="groupe">Marge marché</h2>
      <div className="bloc" style={{ background: 'var(--carte)' }}>
        <Champ label="Frais d'arrivée par phare (€)" aide="Transport, douane et TVA à l'import, de la Chine jusqu'à Taverny. Ils comptent dans la marge marché.">
          <FraisArrivee valeur={r.frais_arrivee ?? 15} onOk={(v) => d.enregistrerReglages({ frais_arrivee: v })} />
        </Champ>
      </div>

      <h2 className="groupe">Importer</h2>
      <ImportAncienne />

      <h2 className="groupe">
        Comptes
        <button type="button" className="lien-btn" onClick={() => setNouveau(true)} disabled={!d.enLigne}>
          + Ajouter un compte
        </button>
      </h2>
      {!d.enLigne && <div className="bandeau attention">La gestion des comptes demande du réseau.</div>}
      {msg && <div className="bandeau erreur">{msg}</div>}
      <div className="lignes">
        {comptes.map((c) => (
          <div className="ligne-r" key={c.id}>
            <button type="button" className="ouvrir" style={{ flex: 1 }} onClick={() => setEdition(c)} disabled={!d.enLigne}>
              <span style={{ fontWeight: 600 }}>{c.nom}</span>
              <small>
                {ROLES[c.role]} · {c.identifiant} · <span style={{ color: c.actif ? 'var(--vert-texte)' : 'var(--rouge-fonce)', fontWeight: 600 }}>{c.actif ? 'Actif' : 'Bloqué'}</span>
              </small>
            </button>
            {c.id !== d.profil.id && <Interrupteur actif={c.actif} label={`Compte de ${c.nom} actif`} onChange={(v) => modifierCompte(c.id, { actif: v })} />}
          </div>
        ))}
      </div>

      {d.profil?.acces_fournisseurs && (
        <>
          <h2 className="groupe">Qui voit l'onglet Fournisseurs</h2>
          <div className="lignes">
            <div className="ligne-r">
              <span>
                {d.profil.nom}
                <small>Toi · toujours</small>
              </span>
            </div>
            {comptes
              .filter((c) => c.id !== d.profil.id)
              .map((c) => (
                <div className="ligne-r" key={c.id}>
                  <span>
                    {c.nom}
                    <small>{ROLES[c.role]}</small>
                  </span>
                  <Interrupteur actif={!!c.acces_fournisseurs} label={`Fournisseurs visibles pour ${c.nom}`} onChange={(v) => accesFournisseurs(c.id, v)} />
                </div>
              ))}
          </div>
          <div className="aide" style={{ padding: '6px 2px' }}>
            Personne d'autre ne voit cet onglet, même les autres administrateurs. Un compte qui a l'accès peut ajouter et modifier des fournisseurs ; toi seul peux en supprimer.
          </div>
        </>
      )}

      <h2 className="groupe">Onglets que les vendeurs voient</h2>
      <div className="lignes">
        {ONGLETS.map(([k, l]) => (
          <div className="ligne-r" key={k}>
            <span>{l}</span>
            <Interrupteur actif={!!r.onglets_vendeur?.[k]} label={l} onChange={basculerOnglet(k)} />
          </div>
        ))}
      </div>
      <div className="aide" style={{ padding: '6px 2px' }}>
        L'onglet « J'ai vendu un phare » est toujours visible pour les vendeurs. Le collègue en Chine voit le dropshipping, la Base Chine, la Base 2, Commande phare et les retours ; il peut gérer les phares de ces bases, sans jamais voir les prix ni ton fournisseur. Un compte « Lecture seule » voit tout, prix compris, mais ne peut rien modifier.
      </div>

      <h2 className="groupe">Infos que les vendeurs voient dans les fiches</h2>
      <div className="lignes">
        <div className="ligne-r">
          <span>
            Photos, modèle, année, côté, réf. d'origine
            <small>Toujours visibles</small>
          </span>
        </div>
        {CHAMPS.map(([k, l]) => (
          <div className="ligne-r" key={k}>
            <span>{l}</span>
            <Interrupteur actif={!!r.champs_vendeur?.[k]} label={l} onChange={basculerChamp(k)} />
          </div>
        ))}
      </div>
      <div style={{ height: 24 }} />

      {nouveau && <NouveauCompte onFermer={() => setNouveau(false)} onCree={chargerComptes} />}
      {edition && (
        <ModifierCompte
          compte={edition}
          moi={edition.id === d.profil.id}
          onFermer={() => setEdition(null)}
          onModifier={async (champs) => {
            await modifierCompte(edition.id, champs);
            setEdition(null);
          }}
          onSupprimer={
            d.profil?.acces_fournisseurs && edition.id !== d.profil.id
              ? async () => {
                  if (!window.confirm(`Supprimer définitivement le compte de ${edition.nom} (${edition.identifiant}) ? Il ne pourra plus se connecter.`)) return;
                  setMsg('');
                  try {
                    await appelFonction('comptes', { action: 'supprimer', id: edition.id });
                    setEdition(null);
                  } catch (e) {
                    setMsg(e.message);
                    setEdition(null);
                  }
                  await chargerComptes();
                }
              : null
          }
        />
      )}
    </main>
  );
}

function NouveauCompte({ onFermer, onCree }) {
  const [c, setC] = useState({ nom: '', identifiant: '', mot_de_passe: '', role: 'vendeur' });
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);
  const maj = (k) => (e) => setC((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  return (
    <Feuille
      titre="Nouveau compte"
      onFermer={onFermer}
      pied={
        <>
          {erreur && <div className="bandeau erreur">{erreur}</div>}
          <button
            type="button"
            className="btn btn-rouge btn-plein"
            disabled={occupe}
            onClick={async () => {
              setErreur('');
              setOccupe(true);
              try {
                await appelFonction('comptes', { action: 'creer', ...c, identifiant: c.identifiant.trim().toLowerCase() });
                await onCree();
                onFermer();
              } catch (e) {
                setErreur(e.message);
              } finally {
                setOccupe(false);
              }
            }}
          >
            {occupe ? 'Création…' : 'Créer le compte'}
          </button>
        </>
      }
    >
      <Champ label="Rôle">
        <Segments valeur={c.role} onChange={maj('role')} options={[['vendeur', 'Vendeur'], ['chine', 'Chine'], ['lecteur', 'Lecture seule'], ['admin', 'Admin']]} />
      </Champ>
      <Champ label="Nom">
        <input value={c.nom} onChange={maj('nom')} placeholder="Ex. Karim" />
      </Champ>
      <Champ label="Identifiant" aide="Lettres minuscules et chiffres, sans espace. C'est ce qu'il tapera pour se connecter.">
        <input value={c.identifiant} onChange={maj('identifiant')} autoCapitalize="none" autoCorrect="off" placeholder="Ex. karim" />
      </Champ>
      <Champ label="Mot de passe" aide="8 caractères minimum. Donne-le lui de vive voix.">
        <input value={c.mot_de_passe} onChange={maj('mot_de_passe')} autoCapitalize="none" autoCorrect="off" />
      </Champ>
    </Feuille>
  );
}

function ModifierCompte({ compte, moi, onFermer, onModifier, onSupprimer }) {
  const [nom, setNom] = useState(compte.nom);
  const [role, setRole] = useState(compte.role);
  const [mdp, setMdp] = useState('');
  return (
    <Feuille
      titre={`Compte de ${compte.nom}`}
      onFermer={onFermer}
      pied={
        <div className={onSupprimer ? 'deux' : ''}>
          {onSupprimer && (
            <button type="button" className="btn btn-danger" onClick={onSupprimer}>
              Supprimer le compte
            </button>
          )}
          <button
            type="button"
            className="btn btn-rouge btn-plein"
            onClick={() => onModifier({ nom, ...(moi ? {} : { role }), ...(mdp ? { mot_de_passe: mdp } : {}) })}
          >
            Enregistrer
          </button>
        </div>
      }
    >
      <Champ label="Nom">
        <input value={nom} onChange={(e) => setNom(e.target.value)} />
      </Champ>
      {!moi && (
        <Champ label="Rôle">
          <Segments valeur={role} onChange={setRole} options={[['vendeur', 'Vendeur'], ['chine', 'Chine'], ['lecteur', 'Lecture seule'], ['admin', 'Admin']]} />
        </Champ>
      )}
      <Champ label="Nouveau mot de passe" aide="Laisse vide pour ne pas le changer.">
        <input value={mdp} onChange={(e) => setMdp(e.target.value)} autoCapitalize="none" autoCorrect="off" />
      </Champ>
    </Feuille>
  );
}

function FraisArrivee({ valeur, onOk }) {
  const [v, setV] = useState(String(valeur));
  const n = Number(String(v).replace(',', '.'));
  return (
    <div className="avec-bouton">
      <input value={v} onChange={(e) => setV(e.target.value)} inputMode="decimal" />
      <button type="button" className="petit-bouton neutre" disabled={Number.isNaN(n) || n < 0 || n === Number(valeur)} onClick={() => onOk(n)}>
        OK
      </button>
    </div>
  );
}
