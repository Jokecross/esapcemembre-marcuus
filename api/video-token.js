import { db, guardEnv, currentMember } from './_auth.js'

const TTL_SECONDS = 60 * 60 * 3 // le lien vaut trois heures, le temps de regarder

/**
 * Renvoie une URL de lecture signée pour UNE leçon.
 *
 * La vérification du déverrouillage est refaite ici, côté serveur : sans ça,
 * un élève qui appellerait l'endpoint à la main obtiendrait la vidéo d'un
 * module qu'il n'a pas payé, ou pas encore ouvert.
 *
 * Le seau « videos » est privé : en dehors de cette URL signée, et passé ces
 * trois heures, le fichier n'est atteignable par personne.
 */
export default async function handler(req, res) {
  if (guardEnv(res)) return

  const member = await currentMember(req)
  if (!member) return res.status(401).json({ error: 'Non authentifié' })

  const lessonId = Number(req.query.lessonId)
  if (!Number.isInteger(lessonId)) {
    return res.status(400).json({ error: 'lessonId manquant' })
  }

  const { data: lesson } = await db()
    .from('lessons')
    .select('id, video_path, vimeo_url, document_path, document_name, module_id')
    .eq('id', lessonId)
    .maybeSingle()

  if (!lesson?.video_path && !lesson?.vimeo_url && !lesson?.document_path) {
    return res.status(404).json({ error: 'Cette leçon n\'a pas encore de contenu.' })
  }

  if (member.role !== 'admin') {
    const { data: unlocked } = await db().rpc('is_module_unlocked', {
      p_member: member.id,
      p_module: lesson.module_id,
    })
    if (!unlocked) return res.status(403).json({ error: 'Module verrouillé' })
  }

  res.setHeader('Cache-Control', 'no-store')

  const payload = {}

  // Lecteur externe — Vimeo ou Loom. L'adresse n'est renvoyée qu'ici, donc
  // après les mêmes contrôles. La protection tient ensuite aux réglages de
  // la vidéo côté hébergeur : non répertoriée, limitée à ce domaine.
  if (lesson.vimeo_url) {
    payload.kind = 'lecteur'
    payload.url = lesson.vimeo_url
  } else if (lesson.video_path) {
    const { data, error } = await sign(lesson.video_path)
    if (error) return res.status(500).json({ error: error.message })
    payload.kind = 'fichier'
    payload.url = data.signedUrl
  }

  if (lesson.document_path) {
    const { data, error } = await sign(lesson.document_path)
    if (!error) {
      payload.document = { url: data.signedUrl, name: lesson.document_name || 'Document' }
    }
  }

  res.status(200).json(payload)
}

function sign(path) {
  return db().storage.from('videos').createSignedUrl(path, TTL_SECONDS)
}
