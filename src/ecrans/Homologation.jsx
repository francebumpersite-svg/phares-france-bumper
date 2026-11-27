// Onglet « Homologation phares » : comment reconnaître un phare Europe,
// Angleterre ou USA sur son étiquette. Contenu fixe, rien n'est enregistré.

const PHOTO_EUROPE = `${import.meta.env.BASE_URL}homologation/europe-ece-rv.jpg`;

function Pastille({ n }) {
  return <span className="homo-num">{n}</span>;
}

// Dessin d'une étiquette (pas une vraie photo)
function DessinEtiquette({ haut, ligneE, bas, entoure }) {
  return (
    <svg viewBox="0 0 320 150" className="homo-dessin" role="img" aria-label={`Dessin d'étiquette : ${haut}`}>
      <rect x="4" y="4" width="312" height="142" rx="12" fill="#ececec" stroke="#9a9a9a" strokeWidth="2" />
      <text x="22" y="40" fontSize="22" fontWeight="700" fill="#222" fontFamily="Arial, sans-serif">{haut}</text>
      <rect x="200" y="20" width="96" height="70" fill="#fff" stroke="#bbb" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={208 + (i % 3) * 28} y={28 + Math.floor(i / 3) * 30} width="18" height="18" fill="#333" />
      ))}
      <text x="22" y="80" fontSize="15" fill="#444" fontFamily="Arial, sans-serif">REF 0000 941 000</text>
      {ligneE && (
        <g>
          <circle cx="40" cy="114" r="19" fill="none" stroke="#222" strokeWidth="2" />
          <text x="40" y="119" fontSize="14" textAnchor="middle" fill="#222" fontFamily="Arial, sans-serif">{ligneE}</text>
        </g>
      )}
      <text x={ligneE ? 68 : 22} y="120" fontSize="15" fill="#444" fontFamily="Arial, sans-serif">{bas}</text>
      {entoure && <ellipse cx={entoure.cx} cy={entoure.cy} rx={entoure.rx} ry="20" fill="none" stroke="#dc1e1e" strokeWidth="4" />}
    </svg>
  );
}

// Dessin d'un phare américain avec le catadioptre orange sur le côté
function DessinPhareUsa() {
  return (
    <svg viewBox="0 0 320 130" className="homo-dessin" role="img" aria-label="Dessin d'un phare américain avec un catadioptre orange sur le côté">
      <path d="M20 95 Q30 30 120 22 L290 30 Q306 60 296 104 L60 112 Q28 112 20 95 Z" fill="#2b2b2b" stroke="#111" strokeWidth="2" />
      <circle cx="140" cy="66" r="24" fill="#d9d9d9" stroke="#888" strokeWidth="3" />
      <circle cx="210" cy="66" r="24" fill="#d9d9d9" stroke="#888" strokeWidth="3" />
      <path d="M70 92 L270 88" stroke="#f4f4f4" strokeWidth="5" strokeLinecap="round" />
      <rect x="262" y="40" width="26" height="40" rx="6" fill="#f39200" stroke="#b86e00" strokeWidth="2" />
      <ellipse cx="275" cy="60" rx="30" ry="34" fill="none" stroke="#dc1e1e" strokeWidth="4" />
      <text x="160" y="126" fontSize="13" textAnchor="middle" fill="#444" fontFamily="Arial, sans-serif">catadioptre orange sur le côté = souvent USA</text>
    </svg>
  );
}

const CODES = [
  ['E1', 'Allemagne'],
  ['E2', 'France'],
  ['E3', 'Italie'],
  ['E4', 'Pays-Bas'],
  ['E6', 'Belgique'],
  ['E8', 'République tchèque'],
  ['E9', 'Espagne'],
  ['E11', 'Royaume-Uni'],
  ['E13', 'Luxembourg'],
  ['E20', 'Pologne']
];

export default function Homologation() {
  return (
    <main className="homo">
      <p className="homo-intro">
        Avant de commander un phare, regarde son <strong>étiquette</strong>. Pour la France, il faut un phare <strong>Europe, circulation à droite</strong>.
      </p>

      <section className="homo-carte ok">
        <h2 className="homo-titre">✅ Phare Europe : bon pour la France</h2>
        <img src={PHOTO_EUROPE} alt="Étiquette d'un phare Volkswagen T-Roc marquée ECE RV et E9" className="homo-photo" loading="lazy" />
        <ol className="homo-liste">
          <li>
            <Pastille n="1" /> <strong>ECE RV</strong> : version Europe, réglée pour rouler à droite (RV = « Rechtsverkehr », circulation à droite).
          </li>
          <li>
            <Pastille n="2" /> <strong>E dans un cercle + un chiffre</strong> : phare homologué en Europe. Le chiffre, c’est le pays qui a homologué le phare (ici E9 = Espagne).
          </li>
          <li>
            <Pastille n="3" /> <strong>L ou R</strong> : le côté du phare. L = gauche, R = droit.
          </li>
        </ol>
      </section>

      <section className="homo-carte ko">
        <h2 className="homo-titre">❌ Phare Angleterre : ECE LV</h2>
        <DessinEtiquette haut="ECE LV" ligneE="E11" bas="Royaume-Uni" entoure={{ cx: 66, cy: 33, rx: 60 }} />
        <p className="homo-texte">
          <strong>LV</strong> = « Linksverkehr », circulation à <strong>gauche</strong>. Le faisceau éclaire du mauvais côté en France. <strong>Attention :</strong> il a quand même le E dans un cercle. Le E ne suffit pas, il faut <strong>RV</strong>.
        </p>
      </section>

      <section className="homo-carte ko">
        <h2 className="homo-titre">❌ Phare USA : DOT / SAE</h2>
        <DessinEtiquette haut="DOT   SAE" bas="(pas de E dans un cercle)" entoure={{ cx: 82, cy: 33, rx: 74 }} />
        <DessinPhareUsa />
        <p className="homo-texte">
          Sur un phare américain, on voit <strong>DOT</strong> et <strong>SAE</strong>, et <strong>pas de E dans un cercle</strong>. Il a souvent un <strong>catadioptre orange sur le côté</strong>. Il n’est pas homologué en France : ne pas le commander.
        </p>
        <p className="homo-note">Ces deux images sont des dessins pour comprendre, pas de vraies photos.</p>
      </section>

      <section className="homo-carte">
        <h2 className="homo-titre">Le chiffre à côté du E</h2>
        <p className="homo-texte">C’est le pays qui a homologué le phare. Tous ces pays sont bons, tant que c’est marqué RV.</p>
        <div className="homo-codes">
          {CODES.map(([c, pays]) => (
            <div key={c} className="homo-code">
              <span className="homo-e">{c}</span>
              <span>{pays}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="homo-carte">
        <h2 className="homo-titre">En résumé</h2>
        <ul className="homo-resume">
          <li>✅ <strong>ECE RV</strong> + E dans un cercle → bon pour la France</li>
          <li>❌ <strong>ECE LV</strong> → Angleterre, ne pas commander</li>
          <li>❌ <strong>DOT / SAE</strong> sans E → USA, ne pas commander</li>
          <li>❓ Étiquette pas lisible → demander une photo nette de l’étiquette au fournisseur</li>
        </ul>
      </section>
    </main>
  );
}
