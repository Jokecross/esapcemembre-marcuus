import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import Icone from './Icone.jsx'

/**
 * Les outils, en bande.
 *
 * Sur ordinateur, quatre tuiles alignées ; sur téléphone, un défilement
 * horizontal avec accrochage — quatre cartes empilées coûteraient six cents
 * pixels de hauteur avant d'arriver au programme.
 *
 * Le code promo est visible sans ouvrir la tuile : c'est lui qu'on vient
 * chercher.
 */
export default function BandeOutils() {
  const [outils, setOutils] = useState(null)

  useEffect(() => {
    supabase
      .from('tools')
      .select('id, name, description, promo_code, url')
      .order('position')
      .limit(8)
      .then(({ data }) => setOutils(data || []))
  }, [])

  if (!outils || !outils.length) return null

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Ton équipement</p>
          <h2 className="mt-1 font-title text-[19px] font-extrabold tracking-tight text-navy">
            Tes outils, avec tes codes
          </h2>
        </div>
        <Link
          to="/outils"
          className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-accent hover:underline"
        >
          Tout voir <Icone nom="fleche" taille={15} />
        </Link>
      </div>

      <div className="-mr-4 mt-4 flex gap-3 overflow-x-auto pb-1.5 pr-4 [scroll-snap-type:x_mandatory] sm:mr-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pr-0 lg:grid-cols-4">
        {outils.map((t) => (
          <Tuile key={t.id} outil={t} />
        ))}
      </div>
    </section>
  )
}

function Tuile({ outil: t }) {
  const [copie, setCopie] = useState(false)

  function copier(e) {
    e.preventDefault()
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
      setCopie(true)
      setTimeout(() => setCopie(false), 2000)
    }
    if (ok) return fini()
    navigator.clipboard?.writeText(t.promo_code).then(fini, () => {})
  }

  return (
    <a
      href={t.url || '#'}
      target={t.url ? '_blank' : undefined}
      rel="noopener"
      className="card min-w-[216px] p-4 [scroll-snap-align:start] transition duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-lift sm:min-w-0"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-xl bg-panel font-title text-xs font-extrabold text-white">
          {sigle(t.name)}
        </span>
        {t.promo_code && (
          <button
            onClick={copier}
            title="Copier le code"
            className="rounded-[7px] border border-dashed border-accent px-2.5 py-[3px] font-title text-[11px] font-extrabold tracking-wide text-accent transition hover:bg-accent-pastel"
          >
            {copie ? 'copié ✓' : t.promo_code}
          </button>
        )}
      </div>
      <b className="mt-3.5 block font-title text-[15px] font-extrabold text-navy">{t.name}</b>
      {t.description && (
        <span className="mt-0.5 block line-clamp-2 text-[13px] leading-snug">{t.description}</span>
      )}
    </a>
  )
}

/** Deux lettres tirées du nom : « Legal Place » → « LP », « Copyfy » → « CF ». */
function sigle(nom = '') {
  const mots = nom.trim().split(/\s+/).filter(Boolean)
  if (mots.length >= 2) return (mots[0][0] + mots[1][0]).toUpperCase()
  const seul = mots[0] || '?'
  const consonnes = seul.slice(1).replace(/[aeiouy]/gi, '')
  return (seul[0] + (consonnes[0] || seul[1] || '')).toUpperCase()
}
