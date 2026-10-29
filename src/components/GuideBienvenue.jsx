import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import Icone from './Icone.jsx'
import { APP, MARQUE, OFFRE, OUTIL } from '../lib/marque'

const TOTAL = 4

/**
 * Le guide de bienvenue : trois cartes posées sur l'espace membre flouté.
 *
 * L'élève vient de créer son accès. Avant, il atterrissait sur la liste
 * des modules sans savoir par où commencer : il ne voyait pas que la
 * vidéo d'introduction était obligatoire, et il ignorait souvent qu'un
 * prompt l'attendait pour construire son outil. Les trois cartes disent
 * ces trois choses, dans l'ordre, une à la fois.
 *
 * La vidéo n'est pas obligatoire : c'est la fin du guide qui ouvre le
 * programme. Le seul passage obligé est la capture de l'outil, et
 * seulement pour qui dit ne pas avoir collé le prompt pendant l'appel.
 */
export default function GuideBienvenue({ etat, onFini }) {
  const [etape, setEtape] = useState(Math.min(etat.etape || 0, TOTAL - 1))

  const avancer = useCallback((suivante, promptRecu) => {
    setEtape(suivante)
    supabase.rpc('guide_avancer', {
      p_etape: suivante,
      p_prompt_recu: promptRecu ?? null,
    })
  }, [])

  async function terminer() {
    await supabase.rpc('guide_termine')
    onFini()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/45 backdrop-blur-[6px]">
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
        <div className="card w-full max-w-xl p-7 shadow-[0_32px_80px_-24px_rgba(0,0,0,.55)] sm:p-9">
          <Compteur etape={etape} />

          {etape === 0 && <Bienvenue prenom={etat.prenom} onSuivant={() => avancer(1)} />}
          {etape === 1 && (
            <Prompt
              prompt={etat.prompt_j0}
              reponse={etat.prompt_recu}
              preuveFaite={etat.preuve_faite}
              onSuivant={(recu) => avancer(2, recu)}
            />
          )}
          {etape === 2 && <Workshop onSuivant={() => avancer(3)} />}
          {etape === 3 && <Video lecons={etat.lecons_intro || []} onFini={terminer} />}
        </div>
      </div>
    </div>
  )
}

/* ---------- Le compteur, commun aux trois cartes ---------- */

function Compteur({ etape }) {
  return (
    <div className="flex items-center gap-3">
      <span className="eyebrow text-accent">
        Étape {etape + 1} / {TOTAL}
      </span>
      <span className="flex flex-1 gap-1.5">
        {Array.from({ length: TOTAL }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              i <= etape ? 'bg-accent' : 'bg-line'
            }`}
          />
        ))}
      </span>
    </div>
  )
}

/* ---------- 1. La bienvenue ---------- */

function Bienvenue({ prenom, onSuivant }) {
  return (
    <>
      <h1 className="mt-5 text-[26px] leading-tight sm:text-3xl">
        Bienvenue dans ta formation
        <br />
        <span className="text-accent">{MARQUE} {OFFRE}</span>
        {prenom ? `, ${prenom}` : ''}.
      </h1>

      <p className="mt-4 text-[15px] leading-relaxed">
        Tu viens de passer le cap, et c'est déjà la partie que la plupart des gens ne
        franchissent jamais. À partir d'ici, tu n'es plus en train de te renseigner : tu
        construis.
      </p>

      <p className="mt-3 text-[15px] leading-relaxed">
        Ce guide prend deux minutes. Il te montre par où commencer, te redonne le premier
        prompt de ton {APP}, et te fait regarder la vidéo qui ouvre le programme.
        Ensuite, tout l'espace est à toi.
      </p>

      <button onClick={onSuivant} className="btn mt-7 w-full">
        Commencer
      </button>
    </>
  )
}

/* ---------- 2. Le prompt du jour 0 ---------- */

function Prompt({ prompt, reponse, preuveFaite, onSuivant }) {
  const [recu, setRecu] = useState(reponse)
  const [copie, setCopie] = useState(false)
  const [preuve, setPreuve] = useState(!!preuveFaite)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')
  const champ = useRef(null)

  function copier() {
    // execCommand d'abord : il passe sans demander d'autorisation, là où
    // l'API moderne peut rester bloquée selon le navigateur.
    const zone = document.createElement('textarea')
    zone.value = prompt
    zone.style.position = 'fixed'
    zone.style.left = '-9999px'
    document.body.appendChild(zone)
    zone.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    document.body.removeChild(zone)
    if (!ok && navigator.clipboard) navigator.clipboard.writeText(prompt).catch(() => {})
    setCopie(true)
    setTimeout(() => setCopie(false), 2200)
  }

  // La capture part dans le même seau que les preuves du programme :
  // mêmes règles, et l'équipe la retrouve au même endroit.
  async function deposer(fichier) {
    if (!fichier) return
    setErreur('')
    if (!fichier.type.startsWith('image/')) {
      return setErreur('Dépose une image : une capture d\'écran ou une photo.')
    }
    if (fichier.size > 10 * 1024 * 1024) {
      return setErreur('Image trop lourde : 10 Mo maximum.')
    }

    setEnvoi(true)
    const { data: s } = await supabase.auth.getSession()
    const membre = s.session.user.id
    const ext = (fichier.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
    const chemin = `${membre}/jour0-${Date.now()}.${ext}`

    const { error: envoiErreur } = await supabase.storage
      .from('preuves')
      .upload(chemin, fichier, { contentType: fichier.type })
    if (envoiErreur) {
      setEnvoi(false)
      return setErreur(`L'envoi a échoué : ${envoiErreur.message}`)
    }

    const { error: dbErreur } = await supabase.from('preuves').upsert(
      {
        member_id: membre,
        file_path: chemin,
        file_name: fichier.name,
        taille: fichier.size,
        statut: 'deposee',
        motif: null,
      },
      { onConflict: 'member_id' },
    )
    setEnvoi(false)
    if (dbErreur) return setErreur(`Enregistrement impossible : ${dbErreur.message}`)
    setPreuve(true)
  }

  const bloque = recu === null || recu === undefined || (recu === false && !preuve)

  return (
    <>
      <h1 className="mt-5 text-[26px] leading-tight sm:text-3xl">Ton premier prompt</h1>

      <p className="mt-4 text-[15px] leading-relaxed">
        Pendant ton appel, un membre de l'équipe devait te faire coller un{' '}
        <b className="text-navy">premier prompt dans {OUTIL}</b> : celui qui construit ton{' '}
        {APP}, ton outil pour préparer ton Black Friday.
      </p>

      <p className="mt-4 font-title font-bold text-navy">Tu l'as bien fait ?</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Choix actif={recu === true} onClick={() => setRecu(true)}>
          Oui, je l'ai déjà fait
        </Choix>
        <Choix actif={recu === false} onClick={() => setRecu(false)}>
          Non, je ne l'ai pas fait
        </Choix>
      </div>

      {recu === false && (
        <div className="mt-5 rounded-2xl border-[1.5px] border-accent/60 bg-canvas p-5">
          <p className="text-[15px] leading-relaxed">
            On le fait maintenant, ça prend cinq minutes. Ouvre{' '}
            <b className="text-navy">{OUTIL}</b>, crée une nouvelle application, colle ce
            prompt en entier dans le chat et envoie-le. Tu n'as rien à modifier.
          </p>
          <textarea
            readOnly
            value={prompt || ''}
            spellCheck={false}
            className="mt-4 h-44 w-full resize-y rounded-xl border border-line-strong bg-surface p-3
                       font-mono text-xs leading-relaxed text-navy"
          />
          <button onClick={copier} className="btn-ghost mt-3 w-full">
            {copie ? 'Copié ✓' : 'Copier le prompt'}
          </button>

          <div className="mt-5 border-t border-line pt-5">
            <p className="font-title font-bold text-navy">Puis montre-nous ton {APP}</p>
            <p className="mt-1.5 text-sm leading-relaxed">
              Quand {OUTIL} a fini de construire, fais une capture d'écran de ton {APP} et
              dépose-la ici. C'est elle qui ouvre la suite.
            </p>

            <input
              ref={champ}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => deposer(e.target.files?.[0])}
            />

            {preuve ? (
              <p className="mt-3 rounded-xl bg-success-bg p-3.5 text-sm font-semibold text-success">
                ✓ Capture reçue. Tu peux continuer.
              </p>
            ) : (
              <button
                onClick={() => champ.current?.click()}
                disabled={envoi}
                className="btn-ghost mt-3 w-full"
              >
                {envoi ? 'Envoi…' : 'Déposer ma capture'}
              </button>
            )}

            {erreur && <p className="mt-2 text-sm font-semibold text-red-600">{erreur}</p>}
          </div>
        </div>
      )}

      {recu === true && (
        <p className="mt-5 rounded-2xl bg-success-bg p-4 text-sm font-semibold text-success">
          Parfait. Garde ton {APP} ouvert : c'est lui que tu vas enrichir chaque jour.
        </p>
      )}

      <button onClick={() => onSuivant(recu)} disabled={bloque} className="btn mt-7 w-full">
        Suivant
      </button>
      {bloque && (
        <p className="mt-3 text-center text-xs text-muted">
          {recu === false
            ? 'Dépose ta capture pour continuer.'
            : 'Réponds à la question pour continuer.'}
        </p>
      )}
    </>
  )
}

function Choix({ actif, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`flex items-center gap-3 rounded-2xl border-[1.5px] px-4 py-3.5 text-left
                  font-bold transition ${
                    actif
                      ? 'border-accent bg-accent-pastel text-accent'
                      : 'border-line bg-surface text-navy hover:border-line-strong'
                  }`}
    >
      <span
        className={`grid h-5 w-5 flex-none place-items-center rounded-full border-2 ${
          actif ? 'border-accent' : 'border-line-strong'
        }`}
      >
        {actif && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
      </span>
      {children}
    </button>
  )
}

/* ---------- 3. Le workshop ---------- */

function Workshop({ onSuivant }) {
  return (
    <>
      <h1 className="mt-5 text-[26px] leading-tight sm:text-3xl">
        Ton {APP} se construit
        <br />
        <span className="text-accent">en 7 jours</span>.
      </h1>

      <p className="mt-4 text-[15px] leading-relaxed">
        Chaque jour, un prompt à coller dans {OUTIL}. Et chaque jour, ton {APP} sait faire
        une chose de plus : calculer ta marge au prix Black Friday, te proposer tes offres,
        te donner ton planning jusqu'au 27 novembre, écrire tes pubs, tes mails et tes SMS.
      </p>

      <p className="mt-3 text-[15px] leading-relaxed">
        C'est pour ça qu'il faut revenir tous les jours : un jour sauté, c'est une étape qui
        manque à ton {APP}.
      </p>

      <div className="mt-5 rounded-2xl border-[1.5px] border-accent/60 bg-canvas p-5">
        <p className="font-title font-bold text-navy">Les trois premiers jours comptent double</p>
        <p className="mt-1.5 text-[15px] leading-relaxed">
          Au <b className="text-navy">jour 3</b>, tous les modules de ta formule se débloquent
          d'un coup. En attendant,{' '}
          <b className="text-navy">tes deux premiers modules sont déjà ouverts</b> : tu peux
          commencer dès ce soir.
        </p>
      </div>

      <button onClick={onSuivant} className="btn mt-7 w-full">
        Suivant
      </button>
    </>
  )
}

/* ---------- 4. La vidéo d'introduction ---------- */

function Video({ lecons, onFini }) {
  const [n, setN] = useState(0)
  const [source, setSource] = useState(null)
  const [erreur, setErreur] = useState(null)
  const cadre = useRef(null)

  const lecon = lecons[n]
  // S'il n'y a pas d'introduction en base, le guide ne doit pas enfermer
  // l'élève devant un cadre vide.
  const sansVideo = !lecon
  const derniere = n >= lecons.length - 1

  useEffect(() => {
    if (sansVideo) return
    setSource(null)
    setErreur(null)
    let vivant = true
    supabase.auth.getSession().then(async ({ data: s }) => {
      try {
        const res = await fetch(`/api/video-token?lessonId=${lecon.id}`, {
          headers: { Authorization: `Bearer ${s.session.access_token}` },
        })
        if (!vivant) return
        if (!res.ok) throw new Error('indisponible')
        setSource(await res.json())
      } catch {
        if (vivant) setErreur("La vidéo n'a pas pu être chargée.")
      }
    })
    return () => {
      vivant = false
    }
  }, [lecon, sansVideo])

  // Vimeo et Loom annoncent la fin par un message de la fenêtre. On
  // s'abonne auprès du lecteur, puis on écoute.
  useEffect(() => {
    if (source?.kind !== 'lecteur') return

    function abonner() {
      for (const value of ['ready', 'ended', 'finish']) {
        try {
          cadre.current?.contentWindow?.postMessage(
            JSON.stringify({ method: 'addEventListener', value }),
            '*',
          )
        } catch {
          /* le lecteur n'est pas encore prêt : le message suivant le trouvera */
        }
      }
    }

    function ecouter(e) {
      if (!/vimeo|loom/.test(e.origin)) return
      let d = e.data
      if (typeof d === 'string') {
        try {
          d = JSON.parse(d)
        } catch {
          return
        }
      }
      const nom = d?.event || d?.type
      if (nom === 'ready') return abonner()
      if (nom === 'ended' || nom === 'finish') marquerVue()
    }

    window.addEventListener('message', ecouter)
    const t = setTimeout(abonner, 1200)
    return () => {
      window.removeEventListener('message', ecouter)
      clearTimeout(t)
    }
  }, [source])

  // La vidéo n'ouvre plus rien, mais la regarder jusqu'au bout doit rester
  // visible dans la progression de l'élève.
  async function marquerVue() {
    if (!lecon) return
    const { data: s } = await supabase.auth.getSession()
    await supabase
      .from('lesson_progress')
      .upsert(
        { lesson_id: lecon.id, member_id: s.session.user.id },
        { onConflict: 'member_id,lesson_id', ignoreDuplicates: true },
      )
  }

  return (
    <>
      <h1 className="mt-5 text-[26px] leading-tight sm:text-3xl">
        {lecon?.title || 'Introduction au programme'}
      </h1>

      <p className="mt-4 text-[15px] leading-relaxed">
        Dernière étape : {lecons.length > 1 ? 'ces vidéos t\'expliquent' : "cette vidéo t'explique"}{' '}
        comment le programme est construit et dans quel ordre avancer. Prends le temps de
        {lecons.length > 1 ? ' les ' : ' la '}regarder — tu la retrouveras dans ton espace
        quand tu voudras.
      </p>

      {lecons.length > 1 && (
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-muted">
          Vidéo {n + 1} sur {lecons.length}
        </p>
      )}

      {!sansVideo && (
        <div className="mt-5 aspect-video overflow-hidden rounded-[18px] bg-panel">
          {source?.kind === 'lecteur' ? (
            <iframe
              key={source.url}
              ref={cadre}
              src={source.url}
              title={lecon.title}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />
          ) : source?.kind ? (
            <video
              key={source.url}
              src={source.url}
              controls
              controlsList="nodownload"
              onEnded={marquerVue}
              onContextMenu={(e) => e.preventDefault()}
              className="h-full w-full"
            />
          ) : (
            <div className="grid h-full place-items-center px-6 text-center text-sm text-[#DDE1E7]">
              {erreur || 'Préparation de la vidéo…'}
            </div>
          )}
        </div>
      )}

      <button onClick={onFini} className="btn mt-6 w-full">
        <Icone nom="fleche" className="h-4 w-4" />
        Accéder à mon espace membre
      </button>

      {lecons.length > 1 && !derniere && (
        <button
          onClick={() => setN(n + 1)}
          className="mx-auto mt-3 block text-xs font-semibold text-muted underline"
        >
          Passer à la vidéo suivante
        </button>
      )}
    </>
  )
}
