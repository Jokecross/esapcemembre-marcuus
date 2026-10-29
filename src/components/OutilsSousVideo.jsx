import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

/**
 * Les outils recommandés, rappelés sous chaque leçon. Même source que la
 * page « Outils » — une seule liste à tenir à jour, affichée à l'endroit
 * où l'élève en a besoin : juste après avoir vu comment s'en servir.
 */
export default function OutilsSousVideo() {
  const [outils, setOutils] = useState(null)
  const [copie, setCopie] = useState(null)

  useEffect(() => {
    supabase
      .from('tools')
      .select('id, name, description, promo_code, url')
      .order('position')
      .then(({ data }) => setOutils(data || []))
  }, [])

  function copier(t) {
    const zone = document.createElement('textarea')
    zone.value = t.promo_code
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
      setCopie(t.id)
      setTimeout(() => setCopie(null), 2000)
    }
    if (ok) return fini()
    navigator.clipboard?.writeText(t.promo_code).then(fini, () => {})
  }

  if (!outils || !outils.length) return null

  return (
    <section className="card mt-5 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg">Les outils dont tu as besoin</h2>
        <Link to="/outils" className="text-sm font-bold text-accent hover:underline">
          Tout voir →
        </Link>
      </div>
      <p className="mt-1 text-sm">Avec les codes négociés pour toi.</p>

      <ul className="mt-4 divide-y divide-line">
        {outils.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span className="min-w-0 flex-1">
              <span className="block font-title font-bold text-navy">{t.name}</span>
              {t.description && <span className="text-sm">{t.description}</span>}
            </span>

            {t.promo_code && (
              <button
                onClick={() => copier(t)}
                title="Copier le code"
                className="rounded-lg border border-dashed border-accent bg-accent-pastel px-3 py-1.5 font-title text-sm font-extrabold text-navy transition hover:bg-surface"
              >
                {copie === t.id ? '✓ copié' : t.promo_code}
              </button>
            )}

            {t.url && (
              <a
                href={t.url}
                target="_blank"
                rel="noopener"
                className="btn-ghost whitespace-nowrap py-2 text-sm"
              >
                Ouvrir
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
