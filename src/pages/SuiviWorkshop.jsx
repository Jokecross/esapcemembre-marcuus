import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import Icone from '../components/Icone.jsx'

/**
 * Où en sont réellement les élèves de leur workshop.
 *
 * Le compteur de jours n'est qu'un calendrier : il avance tout seul, que
 * l'élève travaille ou non. Ce qui compte ici, c'est l'écart entre le jour
 * où il devrait être et la dernière capture qu'il a déposée. C'est cet
 * écart qui désigne qui rappeler.
 */
export default function SuiviWorkshop() {
  const [lignes, setLignes] = useState(null)
  const [filtre, setFiltre] = useState('retard')
  const [apercu, setApercu] = useState(null)

  useEffect(() => {
    supabase
      .from('suivi_workshop')
      .select('*')
      .order('jours_de_retard', { ascending: false })
      .then(({ data }) => setLignes(data || []))
  }, [])

  if (!lignes) return <p className="text-muted">Chargement…</p>

  const vus = lignes.filter((l) =>
    filtre === 'retard' ? l.jours_de_retard >= 1 : filtre === 'rien' ? l.captures === 0 : true,
  )

  /* Les captures sont dans un seau privé : on en demande une adresse
     signée, valable une heure, au moment où on veut la regarder. */
  async function ouvrir(membre) {
    const { data } = await supabase
      .from('workshop_captures')
      .select('jour, file_path, created_at')
      .eq('member_id', membre.id)
      .order('jour')
    const avec = await Promise.all(
      (data || []).map(async (c) => {
        const { data: lien } = await supabase.storage
          .from('preuves')
          .createSignedUrl(c.file_path, 3600)
        return { ...c, url: lien?.signedUrl }
      }),
    )
    setApercu({ membre, captures: avec })
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {[
          ['retard', 'En retard'],
          ['rien', "Rien déposé"],
          ['tous', 'Tous'],
        ].map(([cle, nom]) => (
          <button
            key={cle}
            onClick={() => setFiltre(cle)}
            className={`rounded-full px-4 py-2 text-[13.5px] font-bold transition ${
              filtre === cle ? 'bg-accent text-on-accent' : 'border border-line bg-surface text-navy'
            }`}
          >
            {nom}
          </button>
        ))}
        <span className="ml-auto text-[13px] text-muted">{vus.length} élève(s)</span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11.5px] uppercase tracking-[.1em] text-muted">
              <th className="py-2.5 pr-3 font-bold">Élève</th>
              <th className="py-2.5 pr-3 font-bold">Jour</th>
              <th className="py-2.5 pr-3 font-bold">Captures</th>
              <th className="py-2.5 pr-3 font-bold">Dernière</th>
              <th className="py-2.5 pr-3 font-bold">Retard</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {vus.map((l) => (
              <tr key={l.id} className="border-b border-line/70">
                <td className="py-3 pr-3">
                  <b className="block font-title text-navy">{l.prenom || '—'}</b>
                  <span className="text-[12.5px] text-muted">{l.email}</span>
                </td>
                <td className="py-3 pr-3 font-title font-bold text-navy">{l.jour} / 7</td>
                <td className="py-3 pr-3">{l.captures}</td>
                <td className="py-3 pr-3 text-[12.5px] text-muted">
                  {l.dernier_jour_depose === null ? '—' : `jour ${l.dernier_jour_depose}`}
                </td>
                <td className="py-3 pr-3">
                  {l.jours_de_retard >= 2 ? (
                    <span className="pill bg-red-50 text-red-600">{l.jours_de_retard} jours</span>
                  ) : l.jours_de_retard === 1 ? (
                    <span className="pill pill-muted">1 jour</span>
                  ) : (
                    <span className="pill pill-success">à jour</span>
                  )}
                </td>
                <td className="py-3 text-right">
                  {l.captures > 0 && (
                    <button
                      onClick={() => ouvrir(l)}
                      className="text-[13px] font-bold text-accent hover:underline"
                    >
                      Voir
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!vus.length && (
          <p className="py-8 text-center text-sm text-muted">
            Personne dans cette catégorie.
          </p>
        )}
      </div>

      {apercu && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setApercu(null)}
        >
          <div
            className="card mx-auto max-w-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <b className="font-title text-lg text-navy">{apercu.membre.prenom}</b>
              <button onClick={() => setApercu(null)} className="ml-auto text-muted">
                <Icone nom="fleche" taille={18} />
              </button>
            </div>
            <div className="mt-4 grid gap-4">
              {apercu.captures.map((c) => (
                <figure key={c.jour}>
                  <figcaption className="eyebrow mb-1.5">Jour {c.jour}</figcaption>
                  {c.url && (
                    <img
                      src={c.url}
                      alt={`Jour ${c.jour}`}
                      className="w-full rounded-xl border border-line"
                    />
                  )}
                </figure>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
