import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import Icone from './Icone.jsx'
import { OUTIL } from '../lib/marque'

/**
 * Le prompt du jour 0, sous le formulaire d'invitation.
 *
 * Le setter vient de générer le lien ; dans la foulée, il copie le prompt
 * et l'envoie. Sans ça, il va le chercher ailleurs — et il finit par
 * envoyer une version périmée qu'il garde dans ses notes.
 *
 * Le texte vient de la base : un administrateur le change dans l'onglet
 * Workshop, et tous les setters ont la nouvelle version aussitôt.
 */
export default function PromptJ0() {
  const [prompt, setPrompt] = useState(null)
  const [copie, setCopie] = useState(false)
  const [deplie, setDeplie] = useState(false)

  useEffect(() => {
    supabase
      .from('workshop_reglages')
      .select('prompt_j0')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => setPrompt(data?.prompt_j0 || null))
  }, [])

  if (!prompt) return null

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

    const fini = () => {
      setCopie(true)
      setTimeout(() => setCopie(false), 3000)
    }
    if (ok) return fini()
    navigator.clipboard?.writeText(prompt).then(fini, () => {})
  }

  return (
    <section className="card mt-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg">Le prompt du jour 0</h2>
          <p className="mt-1 text-sm">
            À coller dans {OUTIL} <b className="text-navy">pendant l'appel</b>, depuis le compte
            de la personne. Ne raccroche pas avant d'avoir vu le résultat à l'écran.
          </p>
        </div>

        <button onClick={copier} className={copie ? 'btn-ghost' : 'btn'}>
          <Icone nom={copie ? 'valide' : 'copier'} taille={17} epaisseur={copie ? 2.2 : 1.6} />
          {copie ? 'Copié' : 'Copier le prompt'}
        </button>
      </div>

      <button
        onClick={() => setDeplie(!deplie)}
        className="mt-3 text-sm font-bold text-accent hover:underline"
      >
        {deplie ? 'Masquer le prompt' : 'Voir le prompt'}
      </button>

      {deplie && (
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-canvas p-4 font-mono text-xs leading-relaxed text-navy">
          {prompt}
        </pre>
      )}
    </section>
  )
}
