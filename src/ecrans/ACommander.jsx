import { useMemo, useState } from 'react';
import { useDonnees, srcPhoto } from '../lib/donnees.jsx';
import { dateCourte, devinerDepuisTitre, libelleCote } from '../lib/outils.js';
import { BarreFiltres, Feuille, Icone, PhotoGrande, Segments, Vide, Vignette, useFiltres } from '../composants/ui.jsx';
import FichePhare, { CartePhare, PastillesVentes, infosShopify } from './FichePhare.jsx';

export default function ACommander() {
  const d = useDonnees();
  const admin = d.profil?.role === 'admin';
  const [vue, setVue] = useState('a_commander');
  const phares = useMemo(() => d.phares.filter((p) => p.statut === vue), [d.phares, vue]);
  const filtre = useFiltres(phares);
  const [selection, setSelection] = useState(new Set());
  const [fiche, setFiche] = useState(null);
  const [liste, setListe] = useState(false);
  const [grande, setGrande] = useState(null);

  const nomEquipe = useMemo(() => Object.fromEntries(d.equipe.map((e) => [e.id, e.nom])), [d.equipe]);
  const venteEnAttente = admin ? d.ventes.filter((v) => v.statut === 'en_attente') : [];

  // Ruptures Shopify qui se vendent et qui ne sont pas déjà dans la liste
  const suggestions = useMemo(() => {
    if (!admin || vue !== 'a_commander') return [];
    const dejaPris = new Set(d.phares.filter((p) => ['a_commander', 'commande'].includes(p.statut)).map((p) => p.shopify_product_id).filter(Boolean));
    const ids = [...new Set(d.shopify.map((s) => s.product_id))];
    return ids
      .map((id) => ({ id, info: infosShopify(d.shopify, d.comptoir, id) }))
      .filter((x) => x.info && x.info.stock <= 0 && x.info.ventes + x.info.comptoir > 0 && !dejaPris.has(x.id))
      .sort((a, b) => b.info.ventes + b.info.comptoir - (a.info.ventes + a.info.comptoir))
      .slice(0, 30);
  }, [admin, vue, d.phares, d.shopify, d.comptoir]);

  const basculer = (id) =>
    setSelection((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const choisis = filtre.filtres.filter((p) => selection.has(p.id));
  const toutSel = filtre.filtres.length > 0 && filtre.filtres.every((p) => selection.has(p.id));

  return (
    <>
      {admin && (
        <div style={{ padding: '10px 16px 0' }}>
          <Segments
            valeur={vue}
            onChange={(v) => { setVue(v); setSelection(new Set()); }}
            options={[
              ['a_commander', 'À commander'],
              ['commande', 'Commandés'],
              ['recu', 'Reçus']
            ]}
          />
        </div>
      )}
      <BarreFiltres {...filtre} />
      <main>
        {vue === 'a_commander' && venteEnAttente.length > 0 && (
          <>
            <h2 className="groupe">Envoyés par l'équipe</h2>
            <div className="liste">
              {venteEnAttente.map((v) => (
                <div className="carte" key={v.id}>
                  <Vignette chemin={v.photo} taille={64} onClick={v.photo ? () => setGrande(v.photo) : undefined} alt="Photo envoyée par un vendeur" />
                  <div className="corps">
                    <div className="titre">{[v.marque, v.modele].filter(Boolean).join(' ') || 'Phare sans nom'}</div>
                    <div className="details">
                      {[v.annee, libelleCote(v.cote) !== '—' ? libelleCote(v.cote) : null].filter(Boolean).join(' · ')}
                    </div>
                    {v.ref && <div className="ref">{v.ref}</div>}
                    <div className="pastilles">
                      <span className={v.type === 'comptoir' ? 'pastille p-noir' : 'pastille p-bleu'}>{v.type === 'comptoir' ? 'Vente comptoir' : 'Vente en ligne'}</span>
                      <span className="pastille">
                        {nomEquipe[v.vendeur_id] || 'Vendeur'} · {dateCourte(v.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="droite">
                    <button
                      type="button"
                      className="petit-bouton"
                      onClick={() =>
                        setFiche({
                          initial: {
                            marque: v.marque || '',
                            modele: v.modele || '',
                            annees: v.annee || '',
                            cote: v.cote || 'gauche',
                            ref_oe: v.ref || '',
                            photos: v.photo ? [v.photo] : [],
                            shopify_product_id: v.shopify_product_id || null,
                            statut: 'a_commander'
                          },
                          venteId: v.id
                        })
                      }
                    >
                      + À commander
                    </button>
                    <button type="button" className="petit-bouton neutre" onClick={() => d.majVente(v.id, { statut: 'ignore' })}>
                      Ignorer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {suggestions.length > 0 && (
          <>
            <h2 className="groupe">Proposés par Shopify · en rupture et se vendent</h2>
            <div className="liste">
              {suggestions.map(({ id, info }) => (
                <div className="carte" key={id}>
                  <Vignette url={info.image} taille={56} alt={info.titre} />
                  <div className="corps">
                    <div className="titre" style={{ fontSize: 14 }}>{info.titre}</div>
                    <div className="details">
                      Stock 0 · vendu {info.ventes + info.comptoir} fois sur 60 j
                    </div>
                    <div className="pastilles">
                      <PastillesVentes info={info} />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="petit-bouton"
                    onClick={() => setFiche({ initial: { ...devinerDepuisTitre(info.titre), shopify_product_id: id, statut: 'a_commander' } })}
                  >
                    + Ajouter
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <h2 className="groupe">
          <span>
            {filtre.filtres.length} phare{filtre.filtres.length > 1 ? 's' : ''}
          </span>
          {admin && filtre.filtres.length > 0 && vue !== 'recu' && (
            <button type="button" className="lien-btn" onClick={() => setSelection(toutSel ? new Set() : new Set(filtre.filtres.map((p) => p.id)))}>
              {toutSel ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
          )}
        </h2>
        <div className="liste">
          {filtre.filtres.map((p) => (
            <CartePhare key={p.id} phare={p} onOuvrir={(x) => setFiche({ phare: x })} selection={admin && vue !== 'recu' ? selection : null} onSelection={admin && vue !== 'recu' ? basculer : null} />
          ))}
        </div>
        {!filtre.filtres.length && (
          <Vide
            titre={phares.length ? 'Aucun phare avec ces filtres' : vue === 'a_commander' ? 'Rien à commander' : 'Aucun phare ici'}
            texte={admin && vue === 'a_commander' ? 'Ajoute un phare, ou passe un phare de la base en « À commander ».' : ''}
          />
        )}
      </main>

      {admin && (
        <div className="barre">
          <div className="barre-in">
            {vue === 'a_commander' && (
              <>
                {selection.size > 0 && <div className="barre-info">{choisis.length} phare{choisis.length > 1 ? 's' : ''} sélectionné{choisis.length > 1 ? 's' : ''}</div>}
                <div className="deux">
                  <button type="button" className="btn btn-rouge" disabled={!choisis.length} onClick={() => setListe(true)}>
                    Commander
                  </button>
                  <button type="button" className="btn" onClick={() => setFiche({ initial: { statut: 'a_commander' } })}>
                    + Ajouter un phare
                  </button>
                </div>
              </>
            )}
            {vue === 'commande' && (
              <button
                type="button"
                className="btn btn-vert"
                disabled={!choisis.length}
                onClick={async () => {
                  await d.majPhares(choisis.map((p) => p.id), { statut: 'recu' });
                  setSelection(new Set());
                }}
              >
                Marquer {choisis.length || ''} comme reçu{choisis.length > 1 ? 's' : ''}
              </button>
            )}
            {vue === 'recu' && <div className="barre-info">Phares reçus du fournisseur</div>}
          </div>
        </div>
      )}

      {fiche && (
        <FichePhare
          phare={fiche.phare}
          initial={fiche.initial}
          onFermer={() => setFiche(null)}
          onEnregistre={() => fiche.venteId && d.majVente(fiche.venteId, { statut: 'ajoute' })}
        />
      )}
      {liste && (
        <ListeWhatsApp
          phares={choisis}
          onFermer={() => setListe(false)}
          onCommande={async (quantites) => {
            for (const p of choisis) {
              await d.majPhares([p.id], { statut: 'commande', quantite: quantites[p.id] || p.quantite || 1 });
            }
            setSelection(new Set());
            setListe(false);
          }}
        />
      )}
      {grande && <PhotoGrande chemin={grande} onFermer={() => setGrande(null)} />}
    </>
  );
}

function ListeWhatsApp({ phares, onFermer, onCommande }) {
  const d = useDonnees();
  const [q, setQ] = useState(() => Object.fromEntries(phares.map((p) => [p.id, p.quantite || 1])));
  const [etat, setEtat] = useState('');

  const texte = () => {
    const lignes = [`Commande France Bumper — ${new Date().toLocaleDateString('fr-FR')}`, ''];
    phares.forEach((p, i) => {
      const rf = d.prive[p.id]?.ref_fournisseur;
      lignes.push(
        `${i + 1}. ${p.marque} ${p.modele || ''} · ${p.annees || ''} · ${libelleCote(p.cote)}${p.type_eclairage ? ` · ${p.type_eclairage}` : ''}`.replace(/\s+·\s+·/g, ' ·'),
        `   Réf. ${p.ref_oe || '—'}${rf ? ` / ${rf}` : ''} — Quantité : ${q[p.id] || 1}`
      );
    });
    return lignes.join('\n');
  };

  async function envoyer() {
    setEtat('Préparation des photos…');
    const t = texte();
    const fichiers = [];
    for (const [i, p] of phares.entries()) {
      const chemin = p.photos?.[0] || p.photos_fiche?.[0];
      if (!chemin) continue;
      try {
        const r = await fetch(srcPhoto(chemin));
        const b = await r.blob();
        fichiers.push(new File([b], `${i + 1}-${p.marque}-${p.modele || ''}.jpg`.replace(/\s+/g, '-'), { type: 'image/jpeg' }));
      } catch {
        /* photo indisponible */
      }
    }
    try {
      if (fichiers.length && navigator.canShare?.({ files: fichiers })) {
        await navigator.share({ files: fichiers, text: t });
      } else if (navigator.share) {
        await navigator.share({ text: t });
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank');
      }
    } catch (e) {
      if (e?.name === 'AbortError') {
        setEtat('');
        return;
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank');
    }
    setEtat('');
    if (window.confirm('Message envoyé ? Les phares vont passer en « Commandé ».')) await onCommande(q);
  }

  return (
    <Feuille
      titre={`Liste à envoyer · ${phares.length} phare${phares.length > 1 ? 's' : ''}`}
      onFermer={onFermer}
      pied={
        <>
          <button type="button" className="btn btn-vert btn-plein" onClick={envoyer} disabled={!!etat}>
            <Icone.whatsapp /> {etat || 'Envoyer sur WhatsApp'}
          </button>
          <button type="button" className="btn btn-plein" onClick={() => onCommande(q)}>
            Marquer commandé sans envoyer
          </button>
        </>
      }
    >
      <div className="details">Aperçu de ce que ton fournisseur va recevoir (photos + texte). Les prix ne sont jamais envoyés.</div>
      {phares.map((p, i) => (
        <div className="carte" key={p.id}>
          <Vignette chemin={p.photos?.[0] || p.photos_fiche?.[0]} taille={88} />
          <div className="corps">
            <div className="titre">
              {i + 1}. {p.marque}
            </div>
            <div className="mvc">
              <span>
                <span className="lab" style={{ display: 'block' }}>Modèle</span>
                <span className="val">{p.modele || '—'}</span>
              </span>
              <span>
                <span className="lab" style={{ display: 'block' }}>Année</span>
                <span className="val">{p.annees || '—'}</span>
              </span>
              <span>
                <span className="lab" style={{ display: 'block' }}>Côté</span>
                <span className="val">{libelleCote(p.cote)}</span>
              </span>
            </div>
            <div className="ref">Réf. {p.ref_oe || '—'}</div>
            <label className="champ" style={{ gridTemplateColumns: 'auto 70px', alignItems: 'center', marginTop: 6 }}>
              <span>Quantité</span>
              <input value={q[p.id]} onChange={(e) => setQ((x) => ({ ...x, [p.id]: Math.max(1, Number(e.target.value) || 1) }))} inputMode="numeric" />
            </label>
          </div>
        </div>
      ))}
    </Feuille>
  );
}
