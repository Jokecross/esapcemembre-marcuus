import { useEffect, useState } from 'react'
import Icone from './Icone.jsx'
import { copier } from '../lib/copier.js'

/**
 * Un prompt à coller dans Base44 : un encadré lisible, à hauteur limitée,
 * et un gros bouton de copie.
 *
 * Le texte est affiché et copié tel qu'il est stocké, sans aucune
 * transformation : ce que l'élève colle est exactement ce qui est en base.
 */
export default function BlocPrompt({ texte, titre, libelle = 'COPIER LE PROMPT', compact = false }) {
  const [copie, setCopie] = useState(false)
  const [rate, setRate] = useState(false)
  const [plein, setPlein] = useState(false)

  async function lancer() {
    setRate(false)
    const ok = await copier(texte)
    if (!ok) return setRate(true)
    setCopie(true)
    setTimeout(() => setCopie(false), 2000)
  }

  return (
    <div className={compact ? '' : 'mt-5'}>
      {titre && <h3 className="font-title text-[15.5px] font-extrabold text-navy">{titre}</h3>}

      <div className="relative mt-2.5">
        <pre
          className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-line
                     bg-canvas p-4 pb-7 font-mono text-[12px] leading-relaxed text-navy sm:max-h-72"
        >
          {texte}
        </pre>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-px bottom-px h-8 rounded-b-xl bg-gradient-to-t from-canvas to-transparent"
        />
      </div>

      <button
        type="button"
        onClick={() => setPlein(true)}
        className="mt-2 text-[13px] font-bold text-accent underline-offset-2 hover:underline"
      >
        Voir tout le prompt
      </button>

      <button
        type="button"
        onClick={lancer}
        className={`btn mt-3 w-full py-4 text-[15px] uppercase tracking-wide ${copie ? 'brightness-95' : ''}`}
      >
        <Icone nom={copie ? 'valide' : 'copier'} taille={18} epaisseur={copie ? 2.2 : 1.8} />
        {copie ? 'Copié !' : libelle}
      </button>
      {rate && (
        <p className="mt-2 text-sm font-semibold text-red-600">
          La copie n'a pas marché. Ouvre « Voir tout le prompt », puis sélectionne et copie le texte.
        </p>
      )}

      {plein && <PromptEntier texte={texte} titre={titre} onFermer={() => setPlein(false)} onCopier={lancer} copie={copie} libelle={libelle} />}
    </div>
  )
}

/** Le prompt en entier, par-dessus la page. */
function PromptEntier({ texte, titre, onFermer, onCopier, copie, libelle }) {
  useEffect(() => {
    const echap = (e) => e.key === 'Escape' && onFermer()
    window.addEventListener('keydown', echap)
    const avant = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', echap)
      document.body.style.overflow = avant
    }
  }, [onFermer])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-0 backdrop-blur-[3px] sm:items-center sm:p-6"
      onClick={onFermer}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titre || 'Le prompt'}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-[22px] bg-surface shadow-lift sm:rounded-[22px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <b className="min-w-0 flex-1 truncate font-title text-[16px] text-navy">{titre || 'Le prompt'}</b>
          <button type="button" onClick={onFermer} className="text-sm font-bold text-muted hover:text-navy">
            Fermer
          </button>
        </div>
        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-[12.5px] leading-relaxed text-navy">
          {texte}
        </pre>
        <div className="border-t border-line p-4">
          <button type="button" onClick={onCopier} className="btn w-full py-4 text-[15px] uppercase tracking-wide">
            <Icone nom={copie ? 'valide' : 'copier'} taille={18} />
            {copie ? 'Copié !' : libelle}
          </button>
        </div>
      </div>
    </div>
  )
}
