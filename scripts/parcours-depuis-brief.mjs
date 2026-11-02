#!/usr/bin/env node
/**
 * Lit le brief « Cockpit Black Friday » (Markdown) et en tire le contenu du
 * parcours, sans rien recopier à la main :
 *
 *   node scripts/parcours-depuis-brief.mjs <brief.md> <sortie.json>
 *
 * - Les prompts sont pris tels quels dans les blocs ```text … ``` : aucun
 *   caractère n'est touché, sauf le résumé de la masterclass (règle de la
 *   section 0 du brief), retiré tant qu'on ne l'a pas.
 * - Les textes pour les élèves sont ceux entre « », débarrassés seulement
 *   des guillemets extérieurs.
 *
 * Le JSON produit est déposé en base par deposer-parcours.mjs. Il contient
 * les prompts : il reste hors de git (dossier .contenu/).
 */
import fs from 'node:fs'

const [, , source, sortie] = process.argv
if (!source || !sortie) {
  console.error('Usage : node scripts/parcours-depuis-brief.mjs <brief.md> <sortie.json>')
  process.exit(1)
}

const md = fs.readFileSync(source, 'utf8').replace(/\r\n/g, '\n')
const lignes = md.split('\n')

/* ---------- Outils ---------- */

// « … » → … (seulement les guillemets extérieurs)
function sansGuillemets(t) {
  const s = t.trim()
  if (!s.startsWith('« ') || !s.endsWith(' »')) throw new Error('Texte sans « » : ' + s)
  return s.slice(2, -2)
}

// « **Titre :** « texte » » → texte
function apresDeuxPoints(l) {
  const i = l.indexOf(':** ')
  if (i < 0) throw new Error('Ligne sans « :** » : ' + l)
  return sansGuillemets(l.slice(i + 4))
}

const estItem = (l) => /^(\d+\.|-) « /.test(l.trim())
const texteItem = (l) => sansGuillemets(l.trim().replace(/^(\d+\.|-)\s+/, ''))
const numeroItem = (l) => {
  const m = l.trim().match(/^(\d+)\./)
  return m ? Number(m[1]) : null
}

/** La liste qui suit la ligne i (lignes vides tolérées avant). */
function listeApres(i) {
  let j = i + 1
  while (j < lignes.length && !lignes[j].trim()) j++
  const items = []
  let depart = null
  while (j < lignes.length && estItem(lignes[j])) {
    if (depart === null) depart = numeroItem(lignes[j])
    items.push(texteItem(lignes[j]))
    j++
  }
  if (!items.length) throw new Error('Liste vide après : ' + lignes[i])
  return { items, depart, fin: j }
}

/** Le bloc ```text … ``` qui suit la ligne i, caractère pour caractère. */
function codeApres(i) {
  let j = i + 1
  while (j < lignes.length && lignes[j].trim() !== '```text') j++
  const debut = j + 1
  let k = debut
  while (k < lignes.length && lignes[k] !== '```') k++
  if (k >= lignes.length) throw new Error('Bloc de code non fermé après : ' + lignes[i])
  return { texte: lignes.slice(debut, k).join('\n'), fin: k + 1 }
}

/** Les lignes d'une section « ## n. … », jusqu'à la suivante. */
function section(prefixe) {
  const d = lignes.findIndex((l) => l.startsWith('## ' + prefixe))
  if (d < 0) throw new Error('Section introuvable : ' + prefixe)
  let f = d + 1
  while (f < lignes.length && !lignes[f].startsWith('## ')) f++
  return { d, f, titre: lignes[d].replace(/^##\s+\d+\.\s+/, '') }
}

const prompts = {}
const ident = (l) => (l.match(/`([A-Z0-9_]+)`/) || [])[1]

/* ---------- Le résumé de la masterclass (section 0) ---------- */

function sansResume(id, texte) {
  if (id === 'PROMPT_J1_SHOP') {
    const avant =
      'Tu appliques la méthode de la masterclass Black Friday de Marcuus : [COLLER ICI LE RÉSUMÉ DE LA MASTERCLASS].'
    if (!texte.includes(avant)) throw new Error('Phrase du résumé introuvable dans ' + id)
    return texte.replace(avant, 'Tu appliques la méthode de la masterclass Black Friday de Marcuus.')
  }
  if (id === 'PROMPT_J1_COACH') {
    const ligne = '- La méthode de la masterclass : [COLLER ICI LE RÉSUMÉ DE LA MASTERCLASS].\n'
    if (!texte.includes(ligne)) throw new Error('Ligne du résumé introuvable dans ' + id)
    return texte.replace(ligne, '')
  }
  return texte
}

/* ---------- Jour 0 (section 2) ---------- */

const s2 = section('2.')
const j0 = {}
for (let i = s2.d; i < s2.f; i++) {
  const l = lignes[i]
  if (l.startsWith('**Titre :**')) j0.titre = apresDeuxPoints(l)
  else if (l.startsWith('**Intro :**')) j0.intro = apresDeuxPoints(l)
  else if (l.startsWith('**Les étapes :**')) j0.etapes = listeApres(i).items
  else if (l.startsWith('**Note sous les étapes :**')) j0.note = apresDeuxPoints(l)
  else if (l.startsWith('**Bouton de copie :**')) {
    const m = l.match(/« (.+?) », qui devient « (.+?) »/)
    j0.bouton_copie = m[1]
    j0.bouton_copie_fait = m[2]
  } else if (l.startsWith('**Zone de dépôt :**')) {
    const m = l.match(/« (.+?) », et en dessous « (.+?) »/)
    j0.zone = m[1]
    j0.zone_sous = m[2]
  } else if (l.startsWith('**Bouton final :**')) j0.bouton_final = apresDeuxPoints(l)
  else if (l.startsWith('### Le prompt du jour 0')) prompts.PROMPT_J0 = codeApres(i).texte
  else if (l.startsWith('### Rappel dans l')) {
    let k = i + 1
    while (!lignes[k].includes('Texte : «')) k++
    j0.rappel = lignes[k].slice(lignes[k].indexOf('Texte : «') + 8).trim().replace(/^« /, '').replace(/ »$/, '')
    const t = lignes[k].match(/page « (.+?) »/)
    j0.rappel_titre = t[1]
  }
}
// Les messages de la capture, donnés dans le corps du brief.
const capt = lignes.slice(s2.d, s2.f).join('\n')
j0.capture_ok = (capt.match(/le message vert « (.+?) »/) || [])[1]
j0.erreur_envoi = (capt.match(/Si l'envoi échoue : « (.+?) »/) || [])[1]
j0.erreur_format = (capt.match(/trop lourd : « (.+?) »/) || [])[1]
j0.bloque = (capt.match(/Au survol ou au toucher : « (.+?) »/) || [])[1]
j0.changer = (capt.match(/un lien « (.+?) »/) || [])[1]

/* ---------- Le bandeau (section 3) ---------- */

const s3 = section('3.')
const bandeau = {}
for (let i = s3.d; i < s3.f; i++) {
  if (lignes[i].startsWith('**Titre :**')) {
    bandeau.titre = apresDeuxPoints(lignes[i])
    bandeau.points = listeApres(i).items
  }
}

/* ---------- Les sept jours (sections 4 à 10) ---------- */

const ORDRE_JOURS = ['4.', '5.', '6.', '7.', '8.', '9.', '10.']
const jours = ORDRE_JOURS.map((p, n) => {
  const s = section(p)
  const titre = s.titre.replace(/^Jour \d+ · /, '')
  const blocs = []
  const coince = []
  let resume = null
  let premierPrompt = true

  for (let i = s.d + 1; i < s.f; i++) {
    const l = lignes[i]
    if (l.startsWith("**Ce que tu construis aujourd'hui :**")) {
      resume = apresDeuxPoints(l)
      blocs.push({ type: 'construis', texte: resume })
    } else if (l.startsWith('**Avant de commencer :**')) {
      blocs.push({ type: 'avant', texte: apresDeuxPoints(l) })
    } else if (l.startsWith('### Partie')) {
      blocs.push({ type: 'partie', titre: l.replace(/^###\s+/, '') })
    } else if (l.startsWith('**Les étapes :**')) {
      const { items, depart } = listeApres(i)
      blocs.push({ type: 'etapes', depart: depart || 1, items })
    } else if (l.startsWith('**Bon à savoir')) {
      if (/:\*\* « /.test(l)) blocs.push({ type: 'encadre', titre: 'Bon à savoir', items: [apresDeuxPoints(l)] })
      else blocs.push({ type: 'encadre', titre: 'Bon à savoir', items: listeApres(i).items })
    } else if (l.startsWith('**Si le bouton WhatsApp ne marche pas')) {
      const { items } = listeApres(i)
      blocs.push({ type: 'encadre', titre: 'Si le bouton WhatsApp ne marche pas', ordonne: true, items })
    } else if (l.startsWith('**Si ça coince :**')) {
      coince.push(...listeApres(i).items)
    } else if (l.startsWith('**Le prompt · `') || (l.startsWith('### Partie') === false && ident(l) && l.includes('Le prompt'))) {
      const id = ident(l)
      const { texte, fin } = codeApres(i)
      prompts[id] = sansResume(id, texte)
      blocs.push({ type: 'prompt', id, champ: premierPrompt ? 'prompt' : 'prompt_2' })
      premierPrompt = false
      i = fin - 1
    } else if (/^(\*\*|### )Tu as réussi si…/.test(l)) {
      blocs.push({ type: 'reussi', items: listeApres(i).items })
      if (coince.length) blocs.push({ type: 'coince', items: [...coince] })
      coince.length = 0
    } else if (l.startsWith('**Message de fin')) {
      blocs.push({ type: 'fin', texte: apresDeuxPoints(l) })
    }
  }
  if (coince.length) blocs.push({ type: 'coince', items: coince })
  return { jour: n + 1, titre, resume, blocs }
})

/* ---------- Si ça ne marche pas (section 11) ---------- */

const s11 = section('11.')
const sos = { titre: s11.titre.replace(/^Page /, '').replace(/^« |»$/g, '').trim(), prompts: [] }
for (let i = s11.d + 1; i < s11.f; i++) {
  const l = lignes[i]
  if (l.startsWith('**Intro :**')) sos.intro = apresDeuxPoints(l)
  else if (l.startsWith('### ')) {
    const id = ident(l)
    const titre = l.replace(/^###\s+/, '').replace(/\s+·\s+`[A-Z_]+`\s*$/, '')
    const item = { id, titre }
    let k = i + 1
    while (k < s11.f && !lignes[k].startsWith('```text')) {
      if (lignes[k].startsWith('**Texte au-dessus :**')) item.dessus = apresDeuxPoints(lignes[k])
      k++
    }
    const { texte, fin } = codeApres(k - 1)
    prompts[id] = texte
    sos.prompts.push(item)
    i = fin - 1
  }
}

/* ---------- Contrôles ---------- */

const ATTENDUS = [
  'PROMPT_J0', 'PROMPT_J1_SHOP', 'PROMPT_J1_COACH', 'PROMPT_J2', 'PROMPT_J3', 'PROMPT_J4',
  'PROMPT_J5', 'PROMPT_J6', 'PROMPT_J7', 'SOS_BUG', 'SOS_DESIGN', 'SOS_MENU', 'SOS_PARCOURS',
]
const manquants = ATTENDUS.filter((id) => !prompts[id])
if (manquants.length) throw new Error('Prompts manquants : ' + manquants.join(', '))
for (const [id, t] of Object.entries(prompts)) {
  if (t.includes('[COLLER ICI')) throw new Error('Crochets du résumé encore présents dans ' + id)
}
for (const [cle, v] of Object.entries(j0)) if (!v) throw new Error('Jour 0, texte manquant : ' + cle)

const resultat = {
  prompts,
  parcours: { j0, bandeau, sos },
  jours,
}
fs.writeFileSync(sortie, JSON.stringify(resultat, null, 2))
console.log(
  `${Object.keys(prompts).length} prompts, ${jours.length} jours, ` +
    `${sos.prompts.length} prompts de secours → ${sortie}`,
)
