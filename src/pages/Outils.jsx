import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

export default function Outils() {
  const [tools, setTools] = useState(null)
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    supabase
      .from('tools')
      .select('id, name, description, promo_code, url')
      .order('position')
      .then(({ data }) => setTools(data || []))
  }, [])

  function copy(tool) {
    navigator.clipboard.writeText(tool.promo_code)
    setCopied(tool.id)
    setTimeout(() => setCopied(null), 2500)
  }

  if (!tools) return <p className="text-muted">Chargement…</p>

  return (
    <>
      <Link to="/" className="text-sm font-bold text-accent hover:underline">
        ← Retour au programme
      </Link>

      <p className="eyebrow mt-6">Ton équipement</p>
      <h1 className="mt-1.5 text-3xl">Outils pour bien avancer</h1>
      <p className="mt-2 text-sm">
        Les outils qu'on utilise au quotidien, avec leurs liens et les éventuels codes de réduction.
      </p>

      {!tools.length && (
        <p className="mt-6 text-muted">La liste arrive bientôt.</p>
      )}

      <div className="mt-6 space-y-4">
        {tools.map((t) => (
          <article key={t.id} className="card p-6">
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg">{t.name}</h2>
                {t.description && <p className="mt-1 text-sm">{t.description}</p>}
              </div>

              {t.url && (
                <a
                  href={t.url}
                  target="_blank"
                  rel="noopener"
                  className="btn whitespace-nowrap"
                >
                  Ouvrir l'outil →
                </a>
              )}
            </div>

            {t.promo_code && (
              <button
                onClick={() => copy(t)}
                className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-accent bg-accent-pastel px-4 py-3 text-left"
              >
                <span className="text-xs font-extrabold uppercase tracking-[.16em] text-muted">
                  Code promo
                </span>
                <span className="font-title text-lg font-extrabold text-navy">
                  {t.promo_code}
                </span>
                <span className="text-sm font-bold text-accent">
                  {copied === t.id ? '✓ copié' : 'copier'}
                </span>
              </button>
            )}
          </article>
        ))}
      </div>
    </>
  )
}
