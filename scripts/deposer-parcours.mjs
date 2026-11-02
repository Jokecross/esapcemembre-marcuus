#!/usr/bin/env node
/**
 * Dépose le parcours « Cockpit Black Friday » en base, puis le relit pour
 * vérifier chaque prompt caractère pour caractère.
 *
 *   SUPABASE_URL=… SUPABASE_ANON_KEY=… ADMIN_EMAIL=… ADMIN_MDP=… \
 *     node scripts/deposer-parcours.mjs .contenu/parcours-cockpit.json
 *
 * Il se connecte avec un compte administrateur de l'espace membre : ce
 * sont les règles de la base (RLS) qui autorisent l'écriture, pas une clé
 * service_role.
 */
import fs from 'node:fs'

const { SUPABASE_URL: U, SUPABASE_ANON_KEY: A, ADMIN_EMAIL, ADMIN_MDP } = process.env
const fichier = process.argv[2]
if (!U || !A || !ADMIN_EMAIL || !ADMIN_MDP || !fichier) {
  console.error('Variables SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL, ADMIN_MDP et le fichier JSON sont requis.')
  process.exit(1)
}
const c = JSON.parse(fs.readFileSync(fichier, 'utf8'))

const session = await (
  await fetch(`${U}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: A, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_MDP }),
  })
).json()
if (!session.access_token) throw new Error('Connexion refusée : ' + JSON.stringify(session))
const h = { apikey: A, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }

async function patch(chemin, corps) {
  const r = await fetch(`${U}/rest/v1/${chemin}`, {
    method: 'PATCH',
    headers: { ...h, Prefer: 'return=representation' },
    body: JSON.stringify(corps),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`${chemin} : ${JSON.stringify(j)}`)
  if (!Array.isArray(j) || j.length !== 1) throw new Error(`${chemin} : ${j.length ?? 0} ligne modifiée (1 attendue)`)
  return j[0]
}

/* 1. Les réglages : prompt du jour 0, bandeau, textes du jour 0, secours */
const parcours = structuredClone(c.parcours)
parcours.sos.prompts = parcours.sos.prompts.map((p) => ({ ...p, texte: c.prompts[p.id] }))
await patch('workshop_reglages?id=eq.1', {
  prompt_j0: c.prompts.PROMPT_J0,
  parcours,
  updated_at: new Date().toISOString(),
})
console.log('✓ réglages (jour 0, bandeau, secours)')

/* 2. Les sept jours */
for (const j of c.jours) {
  const ids = j.blocs.filter((b) => b.type === 'prompt')
  const p1 = ids.find((b) => b.champ === 'prompt')
  const p2 = ids.find((b) => b.champ === 'prompt_2')
  await patch(`workshop_jours?jour=eq.${j.jour}`, {
    titre: j.titre,
    resume: j.resume,
    etapes: [],
    blocs: j.blocs,
    prompt: p1 ? c.prompts[p1.id] : null,
    prompt_2: p2 ? c.prompts[p2.id] : null,
    prompt_2_titre: p2 ? 'Jour 1 (suite) · Mon coach' : null,
    updated_at: new Date().toISOString(),
  })
  console.log(`✓ jour ${j.jour} · ${j.titre}`)
}

/* 3. Relecture : chaque prompt en base doit être identique au JSON */
const reg = (await (await fetch(`${U}/rest/v1/workshop_reglages?id=eq.1&select=prompt_j0,parcours`, { headers: h })).json())[0]
const js = await (await fetch(`${U}/rest/v1/workshop_jours?select=jour,prompt,prompt_2,blocs&order=jour`, { headers: h })).json()
const enBase = { PROMPT_J0: reg.prompt_j0 }
for (const p of reg.parcours.sos.prompts) enBase[p.id] = p.texte
for (const j of js)
  for (const b of j.blocs.filter((x) => x.type === 'prompt')) enBase[b.id] = j[b.champ]

let ok = 0
for (const [id, attendu] of Object.entries(c.prompts)) {
  if (enBase[id] === attendu) ok++
  else console.error(`✗ ${id} diffère en base`)
}
console.log(`\n${ok}/${Object.keys(c.prompts).length} prompts identiques en base.`)
if (ok !== Object.keys(c.prompts).length) process.exit(1)
