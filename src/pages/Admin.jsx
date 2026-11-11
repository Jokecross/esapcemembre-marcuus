import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import Contenu from './Contenu.jsx'
import WorkshopAdmin from './WorkshopAdmin.jsx'
import SuiviWorkshop from './SuiviWorkshop.jsx'
import PromptJ0 from '../components/PromptJ0.jsx'

/* Ce que chacun voit du back-office. Un setter génère des invitations et
   rien d'autre : le contenu, les formules, les outils et les mots de passe
   des élèves restent aux administrateurs — la base le fait respecter, ces
   onglets ne font que ne pas les proposer. */
const ONGLETS = [
  ['invitations', 'Invitations', true],
  ['preuves',     'Preuves jour 0', false],
  ['etapes',      'Prochaines étapes', false],
  ['membres',     'Membres',     false],
  ['formules',    'Formules',    false],
  ['contenu',     'Contenu',     false],
  ['outils',      'Outils',      false],
  ['ressources',  'Ressources',  false],
  ['workshop',    'Workshop 7 jours', false],
  ['suivi',       'Suivi des élèves', true],
]

export default function Admin({ role, vendeur = false }) {
  // Closer Marcuus : le formulaire de vente et ses liens, sans onglets.
  return vendeur ? <VenteInvitations /> : <BackOffice role={role} />
}

function BackOffice({ role }) {
  const admin = role === 'admin'
  const onglets = ONGLETS.filter(([, , pourSetter]) => admin || pourSetter)
  const [tab, setTab] = useState(onglets[0][0])

  return (
    <>
      <h1 className="text-2xl">Back-office</h1>
      {!admin && (
        <p className="mt-2 text-sm">
          Génère ici le lien d'accès de la personne que tu viens d'inscrire, mensuel ou
          annuel, et envoie-le-lui juste après l'appel.
        </p>
      )}

      {onglets.length > 1 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {onglets.map(([id, libelle]) => (
            <Tab key={id} active={tab === id} onClick={() => setTab(id)}>
              {libelle}
            </Tab>
          ))}
        </div>
      )}

      <div className="mt-6">
        {tab === 'invitations' && <Invitations admin={admin} />}
        {tab === 'preuves' && <Preuves />}
        {tab === 'etapes' && <Etapes />}
        {tab === 'membres' && <Membres />}
        {tab === 'formules' && <Formules />}
        {tab === 'contenu' && <Contenu />}
        {tab === 'outils' && <Outils />}
        {tab === 'ressources' && <RessourcesAdmin />}
        {tab === 'workshop' && <WorkshopAdmin />}
        {tab === 'suivi' && <SuiviWorkshop />}
      </div>
    </>
  )
}

function Tab({ active, ...props }) {
  return (
    <button
      {...props}
      className={`rounded-full px-4 py-2 text-sm font-bold transition ${
        active ? 'bg-accent text-on-accent' : 'bg-surface text-navy border border-line hover:bg-canvas'
      }`}
    />
  )
}

/* ------------------------------------------------------------------ */
/*  Invitations                                                        */
/* ------------------------------------------------------------------ */

function Invitations({ admin }) {
  const [plans, setPlans] = useState([])
  const [invites, setInvites] = useState([])
  const [equipe, setEquipe] = useState({})
  const [plan, setPlan] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(null)
  // L'administrateur général (Martin) vérifie les factures des closers et
  // envoie la vente dans le CRM. La base le vérifie aussi.
  const [general, setGeneral] = useState(false)
  const [aVerifier, setAVerifier] = useState(false)
  const [traite, setTraite] = useState(null)

  useEffect(() => {
    if (admin) supabase.rpc('est_admin_general').then(({ data }) => setGeneral(data === true))
  }, [admin])

  async function load() {
    const [{ data: p }, { data: i }] = await Promise.all([
      supabase.from('plans').select('code, label, rank').order('rank'),
      supabase
        .from('invites')
        .select('token, plan_code, label, created_at, expires_at, used_at, created_by, client_prenom, client_nom, client_email, client_telephone, facture_path, verif, verif_motif')
        .order('created_at', { ascending: false })
        .limit(200),
    ])
    setPlans(p || [])
    setInvites(i || [])
    if (!plan && p?.length) setPlan(p[0].code)

    // Dix-huit setters partagent cette liste : un administrateur a besoin
    // de voir qui a généré quoi. Les noms sont résolus ici plutôt que par
    // une jointure, qui dépendrait du nom exact de la clé étrangère.
    if (admin) {
      const { data: m } = await supabase.from('members').select('id, first_name, last_name')
      setEquipe(Object.fromEntries((m || []).map((x) => [x.id, x])))
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function create(e) {
    e.preventDefault()
    setBusy(true)
    const { data: s } = await supabase.auth.getSession()
    const { data } = await supabase
      .from('invites')
      .insert({ plan_code: plan, label: label.trim() || null, created_by: s.session.user.id })
      .select('token')
      .single()
    setLabel('')
    setBusy(false)
    if (data) {
      await load()
      copy(data.token)
    }
  }

  async function envoyer(i) {
    // Les montants imposés par le CRM (12b-builder-annuel.sql, 11/11/2026).
    const montant = i.plan_code === 'builder_annuel' ? 'Builder annuel, 450 $' : i.plan_code === 'annuel' ? 'Starter annuel, 250 $' : 'Builder mensuel, 200 $'
    if (!window.confirm(`Envoyer la vente de ${i.label} (${montant}) dans le CRM ?`)) return
    setTraite(i.token)
    const { error } = await supabase.rpc('valider_vente', { p_token: i.token })
    setTraite(null)
    if (error) return window.alert(error.message)
    await load()
  }

  async function refuser(i) {
    const motif = window.prompt(`Refuser la vente de ${i.label} ? Le lien sera désactivé.\n\nMotif (facultatif, visible par le closer) :`, '')
    if (motif === null) return
    setTraite(i.token)
    const { error } = await supabase.rpc('refuser_vente', { p_token: i.token, p_motif: motif })
    setTraite(null)
    if (error) return window.alert(error.message)
    await load()
  }

  function linkFor(token) {
    return `${window.location.origin}/bienvenue/${token}`
  }

  function copy(token) {
    navigator.clipboard.writeText(linkFor(token))
    setCopied(token)
    setTimeout(() => setCopied(null), 2500)
  }

  return (
    <>
      <div className="card p-5">
        <h2 className="text-lg">Créer un lien d'invitation</h2>
        <p className="mt-1 text-sm">
          Choisis ce que la personne a payé. Le lien s'ouvre une seule fois et expire au bout
          de 14 jours — envoie-le après l'appel.
        </p>

        <form onSubmit={create} className="mt-4 flex flex-wrap items-center gap-3">
          <select
            className="field w-auto"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
          >
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </select>
          <input
            className="field w-auto flex-1"
            placeholder="Nom de la personne (pour t'y retrouver)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <button className="btn" disabled={busy || !plan}>
            {busy ? 'Création…' : 'Générer le lien'}
          </button>
        </form>
      </div>

      <PromptJ0 />

      {admin && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Tab active={!aVerifier} onClick={() => setAVerifier(false)}>Toutes</Tab>
          <Tab active={aVerifier} onClick={() => setAVerifier(true)}>
            À vérifier ({invites.filter((x) => x.verif === 'a_verifier').length})
          </Tab>
        </div>
      )}

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-5 py-3 font-extrabold">Pour</th>
              <th className="px-5 py-3 font-extrabold">Formule</th>
              {admin && <th className="px-5 py-3 font-extrabold">Client</th>}
              {admin && <th className="px-5 py-3 font-extrabold">Par</th>}
              {admin && <th className="px-5 py-3 font-extrabold">Vérification</th>}
              <th className="px-5 py-3 font-extrabold">État</th>
              <th className="px-5 py-3 font-extrabold">Lien</th>
            </tr>
          </thead>
          <tbody>
            {invites.filter((x) => !aVerifier || x.verif === 'a_verifier').map((i) => {
              const expired = new Date(i.expires_at) < new Date()
              return (
                <tr key={i.token} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-bold text-navy">{i.label || '—'}</td>
                  <td className="px-5 py-3">{i.plan_code}</td>
                  {admin && (
                    <td className="px-5 py-3 text-muted">
                      {i.client_email || i.client_telephone ? (
                        <>
                          <span className="block">{i.client_email}</span>
                          <span className="block">{i.client_telephone}</span>
                        </>
                      ) : '—'}
                      {i.facture_path && <VoirFacture chemin={i.facture_path} />}
                    </td>
                  )}
                  {admin && (
                    <td className="px-5 py-3 text-muted">
                      {[equipe[i.created_by]?.first_name, equipe[i.created_by]?.last_name]
                        .filter(Boolean)
                        .join(' ') || '—'}
                    </td>
                  )}
                  {admin && (
                    <td className="px-5 py-3">
                      {i.verif === 'a_verifier' ? (
                        general ? (
                          <div className="flex flex-col items-start gap-1.5">
                            <button
                              onClick={() => envoyer(i)}
                              disabled={traite === i.token}
                              className="whitespace-nowrap rounded-full bg-success px-3.5 py-1.5 text-xs font-bold text-white transition hover:brightness-105 disabled:opacity-50"
                            >
                              Envoyer dans le CRM
                            </button>
                            <button
                              onClick={() => refuser(i)}
                              disabled={traite === i.token}
                              className="text-xs font-bold text-muted hover:text-accent hover:underline disabled:opacity-50"
                            >
                              Refuser
                            </button>
                          </div>
                        ) : (
                          <span className="pill pill-accent">À vérifier</span>
                        )
                      ) : i.verif === 'validee' ? (
                        <span className="pill pill-success">✓ Dans le CRM</span>
                      ) : i.verif === 'refusee' ? (
                        <span className="pill pill-muted" title={i.verif_motif || ''}>Refusée</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-5 py-3">
                    {i.used_at ? (
                      <span className="text-success">✓ utilisé</span>
                    ) : expired ? (
                      <span className="text-muted">expiré</span>
                    ) : (
                      <span className="text-accent">en attente</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {i.used_at || expired ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <button
                        onClick={() => copy(i.token)}
                        className="font-bold text-accent hover:underline"
                      >
                        {copied === i.token ? '✓ copié' : 'Copier le lien'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {!invites.length && (
              <tr>
                <td colSpan={admin ? 7 : 4} className="px-5 py-6 text-center text-muted">
                  Aucune invitation pour l'instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Vente — le back-office des closers Marcuus                         */
/* ------------------------------------------------------------------ */

/* Ouvre la facture déposée par le closer, via un lien signé d'une minute. */
function VoirFacture({ chemin }) {
  async function ouvrir() {
    const { data } = await supabase.storage.from('factures-clients').createSignedUrl(chemin, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
  }
  return (
    <button type="button" onClick={ouvrir} className="mt-1 block font-bold text-accent hover:underline">
      Voir la facture
    </button>
  )
}

const VIDE = { prenom: '', nom: '', email: '', telephone: '' }
const emailValide = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim())
const telValide = (v) => v.replace(/\D/g, '').length >= 8

/**
 * Le closer ne génère un lien qu'une fois le client renseigné et la
 * facture déposée. Le bouton reste grisé tant qu'il manque quelque chose,
 * et la base refuse de toute façon une invitation incomplète.
 */
function VenteInvitations() {
  const [plans, setPlans] = useState([])
  const [invites, setInvites] = useState([])
  const [plan, setPlan] = useState('')
  const [client, setClient] = useState(VIDE)
  const [facture, setFacture] = useState(null)
  const [cleFichier, setCleFichier] = useState(0)
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')
  const [nouveau, setNouveau] = useState(null)
  const [copied, setCopied] = useState(null)

  async function load() {
    const { data: s } = await supabase.auth.getSession()
    const [{ data: p }, { data: i }] = await Promise.all([
      supabase.from('plans').select('code, label, rank').order('rank'),
      supabase
        .from('invites')
        .select('token, plan_code, label, client_email, client_telephone, created_at, expires_at, used_at, verif, verif_motif')
        .eq('created_by', s.session.user.id)
        .order('created_at', { ascending: false })
        .limit(100),
    ])
    setPlans(p || [])
    setInvites(i || [])
    if (!plan && p?.length) setPlan(p[0].code)
  }

  useEffect(() => {
    load()
  }, [])

  const champ = (cle) => ({
    value: client[cle],
    onChange: (e) => setClient({ ...client, [cle]: e.target.value }),
  })

  const manque = [
    !client.prenom.trim() && 'le prénom',
    !client.nom.trim() && 'le nom',
    !emailValide(client.email) && "l'e-mail",
    !telValide(client.telephone) && 'le téléphone',
    !facture && 'la facture',
    !plan && 'la formule',
  ].filter(Boolean)
  const pret = manque.length === 0

  function choisirFacture(e) {
    const f = e.target.files?.[0] || null
    setErreur('')
    if (f && f.size > 15 * 1024 * 1024) {
      setErreur('La facture dépasse 15 Mo.')
      setFacture(null)
      setCleFichier((k) => k + 1)
      return
    }
    setFacture(f)
  }

  async function creer(e) {
    e.preventDefault()
    if (!pret || busy) return
    setBusy(true)
    setErreur('')
    try {
      const { data: s } = await supabase.auth.getSession()
      const uid = s.session.user.id
      const ext = (facture.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf'
      const chemin = `${uid}/${crypto.randomUUID()}.${ext}`
      const { error: eUp } = await supabase.storage
        .from('factures-clients')
        .upload(chemin, facture, { contentType: facture.type || undefined })
      if (eUp) throw new Error("La facture n'a pas pu être envoyée : " + eUp.message)

      const prenom = client.prenom.trim()
      const nom = client.nom.trim()
      const { data, error } = await supabase
        .from('invites')
        .insert({
          plan_code: plan,
          label: `${prenom} ${nom}`,
          created_by: uid,
          client_prenom: prenom,
          client_nom: nom,
          client_email: client.email.trim().toLowerCase(),
          client_telephone: client.telephone.trim(),
          facture_path: chemin,
        })
        .select('token')
        .single()
      if (error) throw new Error("Le lien n'a pas pu être créé : " + error.message)

      setClient(VIDE)
      setFacture(null)
      setCleFichier((k) => k + 1)
      setNouveau(data.token)
      copy(data.token)
      await load()
    } catch (ex) {
      setErreur(ex.message)
    } finally {
      setBusy(false)
    }
  }

  const linkFor = (token) => `${window.location.origin}/bienvenue/${token}`

  function copy(token) {
    navigator.clipboard?.writeText(linkFor(token))
    setCopied(token)
    setTimeout(() => setCopied(null), 2500)
  }

  const libellePlan = (code) => plans.find((p) => p.code === code)?.label || code

  return (
    <>
      <h1 className="text-2xl">Back-office</h1>
      <p className="mt-2 text-sm">
        Renseigne le client, dépose la facture qu'il t'a envoyée pendant l'appel, puis génère
        son lien d'accès.
      </p>

      <form onSubmit={creer} className="card mt-6 p-5 sm:p-6">
        <h2 className="text-lg">Créer un lien d'invitation</h2>

        <p className="eyebrow mt-5">1. Le client</p>
        <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
          <input className="field" placeholder="Prénom" autoComplete="off" {...champ('prenom')} />
          <input className="field" placeholder="Nom" autoComplete="off" {...champ('nom')} />
          <input className="field" type="email" inputMode="email" placeholder="E-mail" autoComplete="off" {...champ('email')} />
          <input className="field" type="tel" inputMode="tel" placeholder="Téléphone" autoComplete="off" {...champ('telephone')} />
        </div>

        <p className="eyebrow mt-6">2. La facture</p>
        <label
          className={`mt-2.5 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3.5 text-sm transition ${
            facture ? 'border-success bg-success-bg/60' : 'border-line-strong hover:bg-canvas'
          }`}
        >
          <input
            key={cleFichier}
            type="file"
            accept="application/pdf,image/*"
            className="sr-only"
            onChange={choisirFacture}
          />
          <span className={`flex-none whitespace-nowrap font-bold ${facture ? 'text-success' : 'text-accent'}`}>
            {facture ? '✓ Facture jointe' : 'Importer la facture'}
          </span>
          <span className="min-w-0 truncate text-muted">
            {facture ? facture.name : 'PDF ou photo, 15 Mo max.'}
          </span>
        </label>

        <p className="eyebrow mt-6">3. La formule</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {plans.map((p) => (
            <button
              type="button"
              key={p.code}
              onClick={() => setPlan(p.code)}
              className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${
                plan === p.code
                  ? 'bg-accent text-on-accent'
                  : 'border border-line bg-surface text-navy hover:bg-canvas'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button className="btn" disabled={!pret || busy}>
            {busy ? 'Création…' : 'Générer le lien'}
          </button>
          {!pret && !busy && (
            <span className="text-sm text-muted">Il manque {manque.join(', ')}.</span>
          )}
        </div>
        {erreur && <p className="mt-3 text-sm font-bold text-accent">{erreur}</p>}

        {nouveau && (
          <div className="mt-5 rounded-xl bg-success-bg/70 p-4 text-sm">
            <b className="text-success">Lien créé et copié.</b> Envoie-le au client : il s'ouvre
            une seule fois et expire au bout de 14 jours.
            <span className="mt-2 block break-all font-bold text-navy">{linkFor(nouveau)}</span>
          </div>
        )}
      </form>

      <h2 className="mt-8 text-lg">Mes liens</h2>
      <div className="mt-3 grid gap-2.5">
        {invites.map((i) => {
          const expired = new Date(i.expires_at) < new Date()
          return (
            <div key={i.token} className="card flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3.5 text-sm">
              <div className="min-w-0 flex-1">
                <b className="block truncate text-navy">
                  {i.label || '—'}
                  {i.verif === 'validee' && <span className="ml-2 text-xs font-bold text-success">✓ vente validée</span>}
                </b>
                <span className="block truncate text-muted">
                  {[libellePlan(i.plan_code), i.client_email, i.client_telephone].filter(Boolean).join(' · ')}
                </span>
              </div>
              {i.verif === 'refusee' ? (
                <span className="pill pill-muted" title={i.verif_motif || ''}>
                  Refusée{i.verif_motif ? ` : ${i.verif_motif}` : ''}
                </span>
              ) : i.used_at ? (
                <span className="pill pill-success">✓ utilisé</span>
              ) : expired ? (
                <span className="pill pill-muted">expiré</span>
              ) : (
                <>
                  <span className="pill pill-accent">en attente</span>
                  <button onClick={() => copy(i.token)} className="font-bold text-accent hover:underline">
                    {copied === i.token ? '✓ copié' : 'Copier le lien'}
                  </button>
                </>
              )}
            </div>
          )
        })}
        {!invites.length && (
          <p className="card px-5 py-6 text-center text-sm text-muted">Aucun lien pour l'instant.</p>
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Prochaines étapes                                                  */
/* ------------------------------------------------------------------ */

/**
 * L'offre d'accompagnement proposée en fin de programme. Le texte d'une
 * offre change plus souvent que le code qui l'affiche : il se modifie ici.
 */
function Etapes() {
  const [f, setF] = useState(null)
  const [etat, setEtat] = useState('') // '' | 'enregistrement' | 'ok'

  useEffect(() => {
    supabase
      .from('prochaines_etapes')
      .select('actif, eyebrow, titre, texte, cta_libelle, cta_url, note')
      .maybeSingle()
      .then(({ data }) => setF(data || null))
  }, [])

  async function enregistrer(e) {
    e.preventDefault()
    setEtat('enregistrement')
    await supabase.from('prochaines_etapes').update(f).eq('id', 1)
    setEtat('ok')
    setTimeout(() => setEtat(''), 2500)
  }

  if (!f) {
    return (
      <p className="text-sm">
        Rien à afficher. Passe <code className="mx-1">supabase/15-prochaines-etapes.sql</code>
        dans Supabase pour créer l'offre.
      </p>
    )
  }

  const champ = (cle) => ({
    value: f[cle] ?? '',
    onChange: (e) => setF({ ...f, [cle]: e.target.value }),
  })

  return (
    <form onSubmit={enregistrer} className="card max-w-2xl space-y-4 p-6">
      <p className="text-sm">
        Ce bloc n'apparaît qu'aux élèves ayant terminé <b>tous les modules de leur formule</b> —
        mensuel comme annuel. Personne ne le voit avant.
      </p>

      <label className="flex items-center gap-3 text-sm font-bold text-navy">
        <input
          type="checkbox"
          checked={!!f.actif}
          onChange={(e) => setF({ ...f, actif: e.target.checked })}
          className="h-4 w-4 accent-[#E86C46]"
        />
        Afficher l'offre
      </label>

      <div>
        <span className="eyebrow">Surtitre</span>
        <input className="field mt-1.5" {...champ('eyebrow')} />
      </div>
      <div>
        <span className="eyebrow">Titre</span>
        <input className="field mt-1.5" required {...champ('titre')} />
      </div>
      <div>
        <span className="eyebrow">Texte</span>
        <textarea className="field mt-1.5 min-h-32" {...champ('texte')} />
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="min-w-48 flex-1">
          <span className="eyebrow">Libellé du bouton</span>
          <input className="field mt-1.5" required {...champ('cta_libelle')} />
        </div>
        <div className="min-w-64 flex-[2]">
          <span className="eyebrow">Lien</span>
          <input className="field mt-1.5" type="url" required {...champ('cta_url')} />
        </div>
      </div>
      <div>
        <span className="eyebrow">Mention sous le bouton</span>
        <input className="field mt-1.5" {...champ('note')} />
      </div>

      <div className="flex items-center gap-4 pt-1">
        <button className="btn" disabled={etat === 'enregistrement'}>
          {etat === 'enregistrement' ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {etat === 'ok' && <span className="text-sm font-bold text-success">✓ Enregistré</span>}
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/*  Preuves du jour 0                                                  */
/* ------------------------------------------------------------------ */

/**
 * Les photos déposées par les élèves. Le dépôt ouvre déjà le programme :
 * on ne valide pas pour donner l'accès, on refuse pour le retirer quand la
 * photo ne montre pas ce qu'elle devrait.
 */
function Preuves() {
  const [rows, setRows] = useState(null)
  const [apercu, setApercu] = useState(null) // { nom, url }
  const [busy, setBusy] = useState(null)

  async function load() {
    const { data } = await supabase.rpc('etat_portes')
    setRows(data || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function voir(r) {
    const { data, error } = await supabase.storage
      .from('preuves')
      .createSignedUrl(r.file_path, 900)
    if (error) return
    setApercu({ nom: r.first_name || r.email, url: data.signedUrl })
  }

  async function trancher(r, statut) {
    const motif =
      statut === 'refusee'
        ? prompt('Que dire à l’élève ? Il verra ce message et pourra redéposer.',
            "Cette photo ne montre pas le résultat du prompt du jour 0.")
        : null
    if (statut === 'refusee' && motif === null) return

    setBusy(r.member_id)
    await supabase.from('preuves').update({ statut, motif }).eq('member_id', r.member_id)
    setBusy(null)
    load()
  }

  if (!rows) return <p className="text-muted">Chargement…</p>

  const attente = rows.filter((r) => r.preuve === 'deposee')

  return (
    <>
      <p className="text-sm">
        Le dépôt d’une photo ouvre le programme immédiatement. Tu n’as rien à valider pour
        débloquer quelqu’un — refuse seulement une photo qui ne montre pas le résultat du jour 0, et son
        accès se referme jusqu’au prochain dépôt.
      </p>

      {attente.length > 0 && (
        <p className="mt-3 text-sm font-bold text-accent">
          {attente.length} photo{attente.length > 1 ? 's' : ''} à regarder
        </p>
      )}

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-5 py-3 font-extrabold">Élève</th>
              <th className="px-5 py-3 font-extrabold">Introduction</th>
              <th className="px-5 py-3 font-extrabold">Photo</th>
              <th className="px-5 py-3 font-extrabold">Accès</th>
              <th className="px-5 py-3 font-extrabold"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.member_id} className="border-b border-line last:border-0">
                <td className="px-5 py-3">
                  <b className="block font-title text-navy">{r.first_name || '—'}</b>
                  <span className="text-xs text-muted">{r.email}</span>
                </td>
                <td className="px-5 py-3">
                  {r.intro_ok ? (
                    <span className="text-success">✓ vues</span>
                  ) : (
                    <span className="text-muted">pas terminées</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  {r.file_path ? (
                    <button onClick={() => voir(r)} className="font-bold text-accent hover:underline">
                      Voir la photo
                    </button>
                  ) : (
                    <span className="text-muted">aucune</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  {r.preuve === 'refusee' ? (
                    <span className="font-bold text-red-600">fermé</span>
                  ) : r.preuve === 'aucune' ? (
                    <span className="text-muted">fermé</span>
                  ) : (
                    <span className="font-bold text-success">ouvert</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  {r.file_path && r.preuve !== 'refusee' && (
                    <button
                      onClick={() => trancher(r, 'refusee')}
                      disabled={busy === r.member_id}
                      className="font-bold text-muted hover:text-red-600"
                    >
                      Refuser
                    </button>
                  )}
                  {r.preuve === 'refusee' && (
                    <button
                      onClick={() => trancher(r, 'validee')}
                      disabled={busy === r.member_id}
                      className="font-bold text-accent hover:underline"
                    >
                      Rouvrir
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan="5" className="px-5 py-6 text-center text-muted">
                  Aucun élève pour l’instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {apercu && (
        <div
          onClick={() => setApercu(null)}
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6"
        >
          <div className="max-h-full w-full max-w-3xl overflow-auto rounded-2xl bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <b className="font-title text-navy">{apercu.nom}</b>
              <button onClick={() => setApercu(null)} className="text-sm font-bold text-muted">
                Fermer ✕
              </button>
            </div>
            <img src={apercu.url} alt="Résultat du jour 0" className="w-full rounded-xl" />
          </div>
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Membres                                                            */
/* ------------------------------------------------------------------ */

function Membres() {
  const [rows, setRows] = useState(null)
  const [plans, setPlans] = useState([])
  const [nouveau, setNouveau] = useState(null) // { email, password }
  const [busy, setBusy] = useState(null)

  async function load() {
    const [{ data: m }, { data: p }] = await Promise.all([
      supabase
        .from('members')
        .select('id, first_name, last_name, email, plan_code, role, activated_at')
        .order('activated_at', { ascending: false }),
      supabase.from('plans').select('code, label, rank').order('rank'),
    ])
    setRows(m || [])
    setPlans(p || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function changePlan(id, plan_code) {
    await supabase.from('members').update({ plan_code }).eq('id', id)
    load()
  }

  async function reinitialiser(m) {
    const nom = [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email
    if (!confirm(`Poser un nouveau mot de passe pour ${nom} ? L'ancien cessera de marcher.`)) return
    setBusy(m.id)
    setNouveau(null)
    const { data: s } = await supabase.auth.getSession()
    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${s.session.access_token}`,
      },
      body: JSON.stringify({ memberId: m.id }),
    })
    const corps = await res.json()
    setBusy(null)
    if (!res.ok) return alert(corps.error)
    setNouveau(corps)
  }

  if (!rows) return <p className="text-muted">Chargement…</p>

  return (
    <>
      {nouveau && (
        <div className="card mb-4 border-accent/30 bg-accent-pastel p-5">
          <p className="text-sm">
            Nouveau mot de passe pour <b className="text-navy">{nouveau.email}</b>. Il n'est
            affiché qu'ici, une seule fois — transmets-le maintenant.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <code className="rounded-lg bg-surface px-4 py-2 font-title text-lg font-extrabold text-navy">
              {nouveau.password}
            </code>
            <button
              onClick={() => navigator.clipboard?.writeText(nouveau.password)}
              className="btn-ghost"
            >
              Copier
            </button>
            <button onClick={() => setNouveau(null)} className="text-sm font-bold text-muted">
              Fermer
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="px-5 py-3 font-extrabold">Personne</th>
            <th className="px-5 py-3 font-extrabold">Adresse</th>
            <th className="px-5 py-3 font-extrabold">Formule</th>
            <th className="px-5 py-3 font-extrabold">Accès</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-b border-line last:border-0">
              <td className="px-5 py-3 font-bold text-navy">
                {m.first_name} {m.last_name}
                {m.role === 'admin' && (
                  <span className="ml-2 rounded-full bg-accent-pastel px-2 py-0.5 text-xs text-accent">
                    équipe
                  </span>
                )}
              </td>
              <td className="px-5 py-3 text-muted">{m.email}</td>
              <td className="px-5 py-3">
                <select
                  className="rounded-lg border border-line px-2 py-1 text-sm"
                  value={m.plan_code || ''}
                  onChange={(e) => changePlan(m.id, e.target.value || null)}
                >
                  <option value="">— aucune —</option>
                  {plans.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-5 py-3">
                <button
                  onClick={() => reinitialiser(m)}
                  disabled={busy === m.id}
                  className="text-sm font-bold text-accent hover:underline disabled:opacity-50"
                >
                  {busy === m.id ? 'En cours…' : 'Nouveau mot de passe'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Formules                                                           */
/* ------------------------------------------------------------------ */

function Formules() {
  const [matrix, setMatrix] = useState(null)
  const [plans, setPlans] = useState([])

  async function load() {
    const [{ data: mx }, { data: p }] = await Promise.all([
      supabase.rpc('plan_matrix'),
      supabase.from('plans').select('code, label, rank').order('rank'),
    ])
    setMatrix(mx || [])
    setPlans(p || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function toggle(moduleId, planCode, on) {
    if (on) await supabase.from('plan_modules').insert({ plan_code: planCode, module_id: moduleId })
    else
      await supabase
        .from('plan_modules')
        .delete()
        .eq('plan_code', planCode)
        .eq('module_id', moduleId)
    load()
  }

  if (!matrix) return <p className="text-muted">Chargement…</p>

  return (
    <>
      <p className="text-sm">
        Coche les modules compris dans chaque formule. Un élève ne voit que les siens, et
        l'ordre de déblocage ne tient compte que de ceux-là.
      </p>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-5 py-3 font-extrabold">Module</th>
              {plans.map((p) => (
                <th key={p.code} className="px-5 py-3 text-center font-extrabold">
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((m) => (
              <tr key={m.module_id} className="border-b border-line last:border-0">
                <td className="px-5 py-3 font-bold text-navy">
                  {m.position}. {m.title}
                </td>
                {plans.map((p) => {
                  const on = m.plan_codes.includes(p.code)
                  return (
                    <td key={p.code} className="px-5 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(m.module_id, p.code, !on)}
                        className="h-4 w-4 accent-[#E86C46]"
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Outils                                                             */
/* ------------------------------------------------------------------ */

function Outils() {
  const [tools, setTools] = useState(null)
  const vide = { name: '', description: '', promo_code: '', url: '' }
  const [form, setForm] = useState(vide)

  async function load() {
    const { data } = await supabase
      .from('tools')
      .select('id, position, name, description, promo_code, url')
      .order('position')
    setTools(data || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function add(e) {
    e.preventDefault()
    const position = (tools?.at(-1)?.position || 0) + 1
    await supabase.from('tools').insert({
      position,
      name: form.name.trim(),
      description: form.description.trim() || null,
      promo_code: form.promo_code.trim() || null,
      url: form.url.trim() || null,
    })
    setForm(vide)
    load()
  }

  async function remove(t) {
    if (!confirm(`Retirer « ${t.name} » de la liste ?`)) return
    await supabase.from('tools').delete().eq('id', t.id)
    load()
  }

  if (!tools) return <p className="text-muted">Chargement…</p>

  return (
    <>
      <p className="text-sm">
        Ces outils s'affichent pour tous les élèves, quelle que soit leur formule.
      </p>

      <div className="mt-5 space-y-3">
        {tools.map((t) => (
          <div key={t.id} className="card flex flex-wrap items-center gap-4 p-5">
            <div className="min-w-0 flex-1">
              <b className="block font-title text-navy">{t.name}</b>
              {t.description && <span className="text-sm">{t.description}</span>}
              <span className="mt-1 block text-xs text-muted">
                {t.promo_code ? `Code : ${t.promo_code}` : 'Sans code'} · {t.url || 'sans lien'}
              </span>
            </div>
            <button
              onClick={() => remove(t)}
              className="text-sm font-bold text-muted hover:text-red-600"
            >
              Retirer
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={add} className="card mt-5 space-y-3 p-5">
        <h2 className="text-lg">Ajouter un outil</h2>
        <input
          className="field"
          placeholder="Nom de l'outil"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="field"
          placeholder="À quoi il sert, en une phrase"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div className="flex flex-wrap gap-3">
          <input
            className="field w-auto flex-1"
            placeholder="Code promo"
            value={form.promo_code}
            onChange={(e) => setForm({ ...form, promo_code: e.target.value })}
          />
          <input
            className="field w-auto flex-[2]"
            type="url"
            placeholder="https://…"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
        </div>
        <button className="btn">Ajouter</button>
      </form>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Ressources                                                         */
/* ------------------------------------------------------------------ */

function RessourcesAdmin() {
  const [rows, setRows] = useState(null)
  const vide = { kind: 'fichier', title: '', description: '', prompt_text: '' }
  const [form, setForm] = useState(vide)
  const [fichier, setFichier] = useState(null)
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')

  async function load() {
    const { data, error } = await supabase
      .from('resources')
      .select('id, position, kind, title, description, file_name, prompt_text')
      .order('position')
    setErreur(error ? error.message : '')
    setRows(data || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function ajouter(e) {
    e.preventDefault()
    setBusy(true)
    setErreur('')
    const position = (rows?.at(-1)?.position || 0) + 1

    let file_path = null
    let file_name = null
    if (form.kind === 'fichier') {
      if (!fichier) {
        setBusy(false)
        return setErreur('Choisis un fichier à déposer.')
      }
      const ext = fichier.name.split('.').pop().toLowerCase()
      file_path = `ressources/${Date.now()}-${position}.${ext}`
      file_name = fichier.name
      const { error } = await supabase.storage
        .from('videos')
        .upload(file_path, fichier, { upsert: true, contentType: fichier.type || undefined })
      if (error) {
        setBusy(false)
        return setErreur(error.message)
      }
    }

    const { error } = await supabase.from('resources').insert({
      position,
      kind: form.kind,
      title: form.title.trim(),
      description: form.description.trim() || null,
      file_path,
      file_name,
      prompt_text: form.kind === 'prompt' ? form.prompt_text : null,
    })
    if (error) setErreur(error.message)

    setForm(vide)
    setFichier(null)
    setBusy(false)
    load()
  }

  async function retirer(r) {
    if (!confirm(`Retirer « ${r.title} » ?`)) return
    await supabase.from('resources').delete().eq('id', r.id)
    load()
  }

  if (!rows) return <p className="text-muted">Chargement…</p>

  return (
    <>
      <p className="text-sm">
        Ces ressources s'affichent sous les modules, pour tous les élèves. Un document
        s'ouvre dans un nouvel onglet ; un prompt se déplie avec un bouton pour le copier.
      </p>

      {erreur && (
        <div className="card mt-4 border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {erreur}
        </div>
      )}

      <div className="mt-5 space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="card flex flex-wrap items-center gap-4 p-5">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-accent-pastel">
              {r.kind === 'prompt' ? '⌘' : '📄'}
            </span>
            <div className="min-w-0 flex-1">
              <b className="block font-title text-navy">{r.title}</b>
              {r.description && <span className="text-sm">{r.description}</span>}
              <span className="mt-0.5 block text-xs text-muted">
                {r.kind === 'prompt'
                  ? `${(r.prompt_text || '').length.toLocaleString('fr-FR')} caractères`
                  : r.file_name || 'fichier'}
              </span>
            </div>
            <button
              onClick={() => retirer(r)}
              className="text-sm font-bold text-muted hover:text-red-600"
            >
              Retirer
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={ajouter} className="card mt-5 space-y-3 p-5">
        <h2 className="text-lg">Ajouter une ressource</h2>

        <div className="flex gap-2">
          {['fichier', 'prompt'].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setForm({ ...form, kind: k })}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                form.kind === k
                  ? 'bg-accent text-on-accent'
                  : 'border border-line bg-surface text-navy hover:bg-canvas'
              }`}
            >
              {k === 'fichier' ? '📄 Document' : '⌘ Prompt'}
            </button>
          ))}
        </div>

        <input
          className="field"
          placeholder="Titre — ex. Guide de démarrage"
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <input
          className="field"
          placeholder="À quoi ça sert, en une phrase"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        {form.kind === 'fichier' ? (
          <input
            type="file"
            accept=".pdf,.txt,.md,.csv,.png,.jpg,.jpeg,.zip"
            onChange={(e) => setFichier(e.target.files?.[0] || null)}
            className="field"
          />
        ) : (
          <textarea
            className="field font-mono text-xs"
            rows={8}
            placeholder="Colle ici le prompt que l'élève devra copier."
            required
            value={form.prompt_text}
            onChange={(e) => setForm({ ...form, prompt_text: e.target.value })}
          />
        )}

        <button className="btn" disabled={busy}>
          {busy ? 'Envoi…' : 'Ajouter'}
        </button>
      </form>
    </>
  )
}
