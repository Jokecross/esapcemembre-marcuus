import { useEffect, useRef, useState } from 'react'
import * as tus from 'tus-js-client'
import { supabase, SUPABASE_URL } from '../lib/supabase.js'

/**
 * Reconnaît un lien Vimeo, Loom, Tella ou Google Drive, collé depuis la barre d'adresse
 * comme depuis un code d'intégration, et renvoie l'adresse du lecteur.
 *
 * Le hash `h=` des vidéos Vimeo non répertoriées est conservé : sans lui,
 * le lecteur refuse de démarrer.
 */
export function lecteurUrl(input) {
  const texte = String(input || '').trim()
  if (!texte) return null

  const loom = texte.match(/loom\.com\/(?:share|embed)\/([0-9a-f]{16,})/i)
  if (loom) return `https://www.loom.com/embed/${loom[1]}`

  // Google Drive : le lien de partage d'un fichier ouvre la page Drive.
  // Le lecteur intégrable est sur /preview. Le fichier doit être partagé
  // à « Tous les utilisateurs disposant du lien ».
  const drive =
    texte.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{10,})/) ||
    texte.match(/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([A-Za-z0-9_-]{10,})/)
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`

  // Tella sert la lecture sur une adresse dédiée : le lien de partage seul
  // afficherait sa page, pas le lecteur.
  const tella = texte.match(/tella\.tv\/video\/([A-Za-z0-9_-]{8,})/i)
  if (tella) return `https://www.tella.tv/video/${tella[1]}/embed`

  // YouTube : vidéo, live ou lien raccourci. La vidéo doit être publique ou
  // non répertoriée, et autoriser l'intégration.
  const yt = texte.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|live\/|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i,
  )
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0`

  const player = texte.match(/player\.vimeo\.com\/video\/(\d+)(?:[?&]h=([A-Za-z0-9]+))?/)
  if (player) return vimeo(player[1], player[2])

  const partage = texte.match(/vimeo\.com\/(?:manage\/videos\/)?(\d+)(?:\/([A-Za-z0-9]+))?/)
  if (partage) return vimeo(partage[1], partage[2])

  if (/^\d+$/.test(texte)) return vimeo(texte)
  return null

  function vimeo(id, hash) {
    return `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ''}`
  }
}

/**
 * Création des modules et des leçons, et dépôt des vidéos, sans quitter le
 * navigateur. Les fichiers partent directement du Mac vers Supabase Storage.
 */
export default function Contenu() {
  const [modules, setModules] = useState(null)
  const [titre, setTitre] = useState('')
  const [titreBonus, setTitreBonus] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const { data, error } = await supabase
      .from('modules')
      .select('id, position, title, is_intro, is_bonus, lessons(id, module_id, position, title, video_path, vimeo_url, document_path, document_name, avertissement)')
      .order('position')

    // Une base pas encore migrée renvoie une erreur, pas une liste vide :
    // sans ce message, la page paraîtrait simplement dépourvue de modules.
    setError(error ? error.message : '')
    setModules(
      (data || []).map((m) => ({
        ...m,
        lessons: [...(m.lessons || [])].sort((a, b) => a.position - b.position),
      }))
    )
  }

  useEffect(() => {
    load()
  }, [])

  async function addModule(e) {
    e.preventDefault()
    const position = (modules?.at(-1)?.position || 0) + 1
    await supabase.from('modules').insert({ position, title: titre.trim() })
    setTitre('')
    load()
  }

  /* Les vidéos bonus sont des leçons, sans module à nommer : elles vivent
     dans un module « Vidéos bonus » que l'élève ne voit jamais comme tel.
     Il est créé avec la première vidéo, et ouvert aux deux formules : sans
     cela, personne ne le verrait tant qu'on n'a pas pensé à le cocher. */
  async function addBonus(e) {
    e.preventDefault()
    let module = modules.find((m) => m.is_bonus)
    if (!module) {
      const position = (modules?.at(-1)?.position || 0) + 1
      const { data } = await supabase
        .from('modules')
        .insert({ position, title: 'Vidéos bonus', is_bonus: true })
        .select('id, lessons(position)')
        .single()
      if (!data) return
      await ouvrirAuxFormules(data.id)
      module = { ...data, lessons: [] }
    }
    const position = Math.max(0, ...module.lessons.map((l) => l.position)) + 1
    await supabase.from('lessons').insert({ module_id: module.id, position, title: titreBonus.trim() })
    setTitreBonus('')
    load()
  }

  const leconsBonus = (modules || []).filter((m) => m.is_bonus).flatMap((m) => m.lessons)

  if (!modules) return <p className="text-muted">Chargement…</p>

  return (
    <>
      {error && (
        <div className="card mb-5 border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          La base ne répond pas comme attendu : {error}
          <span className="mt-1 block font-medium">
            Une migration SQL n'a probablement pas été passée — vérifie le dossier
            <code className="mx-1">supabase/</code> dans l'ordre des numéros.
          </span>
        </div>
      )}

      <p className="text-sm">
        Crée tes modules, ajoute les leçons dans l'ordre, puis dépose la vidéo de chaque
        leçon. Un fichier déposé remplace le précédent.
      </p>

      <div className="mt-5 space-y-4">
        {modules.filter((m) => !m.is_bonus).map((m) => (
          <Module key={m.id} module={m} onChange={load} />
        ))}
      </div>

      <form onSubmit={addModule} className="card mt-5 flex flex-wrap gap-3 p-5">
        <input
          className="field w-auto flex-1"
          placeholder="Titre d'un nouveau module"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          required
        />
        <button className="btn">Ajouter le module</button>
      </form>

      <h2 className="mt-10 text-lg">Modules vidéo bonus</h2>
      <p className="mt-1 text-sm">
        Affichés sous « Ton programme » (TikTok Shop, etc.) : un titre et sa vidéo, rien
        d'autre. Ouverts aux deux formules, dès l'arrivée de l'élève.
      </p>

      <section className="card mt-4 overflow-hidden">
        {leconsBonus.length > 0 ? (
          <ul>
            {leconsBonus.map((l) => (
              <Lesson key={l.id} lesson={l} onChange={load} />
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm text-muted">Aucune vidéo bonus pour l'instant.</p>
        )}

        <form onSubmit={addBonus} className="flex flex-wrap gap-3 border-t border-line p-4">
          <input
            className="field w-auto flex-1"
            placeholder="Titre de la vidéo bonus — ex. Les replays du défi avec Ibrahim"
            value={titreBonus}
            onChange={(e) => setTitreBonus(e.target.value)}
            required
          />
          <button className="btn">Ajouter la vidéo bonus</button>
        </form>
      </section>
    </>
  )
}

/** Coche un module dans toutes les formules (les doublons sont ignorés). */
async function ouvrirAuxFormules(moduleId) {
  const { data: plans } = await supabase.from('plans').select('code')
  if (!plans?.length) return
  await supabase
    .from('plan_modules')
    .upsert(plans.map((p) => ({ plan_code: p.code, module_id: moduleId })), {
      onConflict: 'plan_code,module_id',
      ignoreDuplicates: true,
    })
}

function Module({ module: m, onChange }) {
  const [titre, setTitre] = useState('')

  async function addLesson(e) {
    e.preventDefault()
    const position = (m.lessons.at(-1)?.position || 0) + 1
    await supabase
      .from('lessons')
      .insert({ module_id: m.id, position, title: titre.trim() })
    setTitre('')
    onChange()
  }

  async function removeModule() {
    if (!confirm(`Supprimer le module « ${m.title} » et toutes ses leçons ?`)) return
    await supabase.from('modules').delete().eq('id', m.id)
    onChange()
  }

  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-accent-pastel font-title font-extrabold text-accent">
          {m.is_intro ? '★' : m.position}
        </span>
        <h2 className="flex-1 text-lg">{m.title}</h2>
        <label className="flex items-center gap-2 text-xs font-semibold text-muted">
          <input
            type="checkbox"
            checked={!!m.is_intro}
            onChange={async (e) => {
              await supabase.from('modules').update({ is_intro: e.target.checked }).eq('id', m.id)
              onChange()
            }}
            className="h-4 w-4 accent-[#E86C46]"
          />
          Introduction
        </label>

        <button onClick={removeModule} className="text-sm font-bold text-muted hover:text-red-600">
          Supprimer
        </button>
      </header>

      <ul>
        {m.lessons.map((l) => (
          <Lesson key={l.id} lesson={l} onChange={onChange} />
        ))}
      </ul>

      <form onSubmit={addLesson} className="flex flex-wrap gap-3 border-t border-line p-4">
        <input
          className="field w-auto flex-1"
          placeholder="Titre d'une nouvelle leçon"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          required
        />
        <button className="btn-ghost">Ajouter la leçon</button>
      </form>
    </section>
  )
}

function Lesson({ lesson: l, onChange }) {
  const input = useRef(null)
  const docInput = useRef(null)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const [editVimeo, setEditVimeo] = useState(false)
  const [vimeo, setVimeo] = useState('')
  const [editNote, setEditNote] = useState(false)
  const [note, setNote] = useState(l.avertissement || '')

  async function upload(file) {
    if (!file) return
    setError('')
    setProgress(0)

    const ext = file.name.split('.').pop().toLowerCase()
    const path = `module-${l.module_id}/lecon-${l.id}.${ext}`
    const { data: s } = await supabase.auth.getSession()

    // Envoi fragmenté : Supabase refuse les envois classiques au-delà de
    // 50 Mo, et une leçon les dépasse toujours. Le fichier part du navigateur
    // directement vers Storage, sans passer par Vercel, et reprend où il en
    // était si la connexion tombe.
    const upload = new tus.Upload(file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${s.session.access_token}`,
        'x-upsert': 'true',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024, // taille imposée par Supabase
      metadata: {
        bucketName: 'videos',
        objectName: path,
        contentType: file.type || 'video/mp4',
      },
      onError: (e) => {
        setError(e.message)
        setProgress(null)
      },
      onProgress: (sent, total) => setProgress(Math.round((sent / total) * 100)),
      onSuccess: async () => {
        // Une leçon n'a qu'une source : le fichier déposé écarte le lien Vimeo.
        await supabase
          .from('lessons')
          .update({ video_path: path, vimeo_url: null })
          .eq('id', l.id)
        setProgress(null)
        onChange()
      },
    })

    const previous = await upload.findPreviousUploads()
    if (previous.length) upload.resumeFromPreviousUpload(previous[0])
    upload.start()
  }

  async function uploadDoc(file) {
    if (!file) return
    setError('')
    setProgress(0)

    // Un PDF pèse quelques mégaoctets : l'envoi classique suffit, pas besoin
    // du fragmenté réservé aux vidéos.
    const path = `module-${l.module_id}/lecon-${l.id}-document.pdf`
    const { error: upError } = await supabase.storage
      .from('videos')
      .upload(path, file, { upsert: true, contentType: file.type || 'application/pdf' })

    if (upError) {
      setError(upError.message)
      return setProgress(null)
    }

    await supabase
      .from('lessons')
      .update({ document_path: path, document_name: file.name })
      .eq('id', l.id)
    setProgress(null)
    onChange()
  }

  async function enregistrerNote(texte) {
    await supabase
      .from('lessons')
      .update({ avertissement: texte })
      .eq('id', l.id)
    setEditNote(false)
    onChange()
  }

  async function remove() {
    if (!confirm(`Supprimer la leçon « ${l.title} » ?`)) return
    await supabase.from('lessons').delete().eq('id', l.id)
    onChange()
  }

  async function saveVimeo() {
    const url = lecteurUrl(vimeo)
    if (!url) return setError("Lien non reconnu. Colle une adresse Vimeo, Loom, Tella ou Google Drive.")
    setError('')
    // Une leçon n'a qu'une source : enregistrer un lien Vimeo écarte le
    // fichier éventuellement déposé, pour qu'on sache toujours ce qui joue.
    await supabase.from('lessons').update({ vimeo_url: url, video_path: null }).eq('id', l.id)
    setVimeo('')
    setEditVimeo(false)
    onChange()
  }

  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 last:border-0">
      <span className="w-6 flex-none text-sm font-bold text-muted">{l.position}.</span>
      <span className="flex-1 text-sm font-semibold text-navy">{l.title}</span>

      {l.video_path ? (
        <span className="rounded-full bg-success-bg px-3 py-1 text-xs font-bold text-success">
          ✓ fichier
        </span>
      ) : l.vimeo_url ? (
        <span className="rounded-full bg-success-bg px-3 py-1 text-xs font-bold text-success">
          ✓ {/drive\.google/.test(l.vimeo_url) ? 'Google Drive' : /loom/.test(l.vimeo_url) ? 'Loom' : /tella/.test(l.vimeo_url) ? 'Tella' : /youtube/.test(l.vimeo_url) ? 'YouTube' : 'Vimeo'}
        </span>
      ) : (
        <span className="rounded-full bg-canvas px-3 py-1 text-xs font-bold text-muted">
          pas de vidéo
        </span>
      )}

      {l.document_path && (
        <span className="rounded-full bg-accent-pastel px-3 py-1 text-xs font-bold text-accent">
          📄 document
        </span>
      )}

      <input
        ref={input}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => upload(e.target.files?.[0])}
      />
      <button
        onClick={() => input.current.click()}
        disabled={progress !== null}
        className="text-sm font-bold text-accent hover:underline disabled:opacity-50"
      >
        {progress !== null
          ? `Envoi… ${progress} %`
          : l.video_path
            ? 'Remplacer'
            : 'Déposer la vidéo'}
      </button>
      <button
        onClick={() => setEditVimeo(!editVimeo)}
        className="text-sm font-bold text-accent hover:underline"
      >
        Lien vidéo
      </button>
      <button
        onClick={() => setEditNote(!editNote)}
        className={`text-sm font-bold hover:underline ${
          l.avertissement ? 'text-red-600' : 'text-accent'
        }`}
      >
        {l.avertissement ? '⚠️ Avertissement' : 'Avertissement'}
      </button>
      <input
        ref={docInput}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => uploadDoc(e.target.files?.[0])}
      />
      <button
        onClick={() => docInput.current.click()}
        disabled={progress !== null}
        className="text-sm font-bold text-accent hover:underline disabled:opacity-50"
      >
        {l.document_path ? 'Remplacer le PDF' : 'Ajouter un PDF'}
      </button>
      <button onClick={remove} className="text-sm font-bold text-muted hover:text-red-600">
        ✕
      </button>

      {editNote && (
        <div className="w-full">
          <textarea
            className="field"
            rows={3}
            placeholder="Message affiché en rouge au-dessus de la vidéo, pour rectifier un passage sans refaire la leçon."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus
          />
          <div className="mt-2 flex items-center gap-3">
            <button onClick={() => enregistrerNote(note.trim() || null)} className="btn-ghost">
              Enregistrer
            </button>
            {l.avertissement && (
              <button
                onClick={() => {
                  setNote('')
                  enregistrerNote(null)
                }}
                className="text-sm font-bold text-muted hover:text-red-600"
              >
                Retirer
              </button>
            )}
          </div>
        </div>
      )}

      {editVimeo && (
        <div className="flex w-full gap-2">
          <input
            className="field flex-1"
            placeholder="Colle le lien YouTube, Vimeo, Loom, Tella ou Google Drive"
            value={vimeo}
            onChange={(e) => setVimeo(e.target.value)}
            autoFocus
          />
          <button onClick={saveVimeo} className="btn-ghost">
            Enregistrer
          </button>
        </div>
      )}

      {progress !== null && (
        <span className="h-1.5 w-full overflow-hidden rounded-full bg-canvas">
          <span
            className="block h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </span>
      )}
      {error && <p className="w-full text-sm font-semibold text-red-600">{error}</p>}
    </li>
  )
}
