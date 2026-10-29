import { db, guardEnv, currentMember } from './_auth.js'

const TTL_SECONDS = 60 * 60 // une heure suffit pour ouvrir un document

/**
 * Adresse signée d'un document de la section Ressources.
 *
 * Les ressources sont ouvertes à tous les membres, quelle que soit leur
 * formule : ce n'est pas du contenu de cours. Le seau reste privé, donc le
 * fichier n'est joignable que par cette adresse, et seulement une heure.
 */
export default async function handler(req, res) {
  if (guardEnv(res)) return

  const member = await currentMember(req)
  if (!member) return res.status(401).json({ error: 'Non authentifié' })

  const id = Number(req.query.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id manquant' })

  const { data: resource } = await db()
    .from('resources')
    .select('id, file_path')
    .eq('id', id)
    .maybeSingle()

  if (!resource?.file_path) return res.status(404).json({ error: 'Document absent' })

  const { data, error } = await db()
    .storage.from('videos')
    .createSignedUrl(resource.file_path, TTL_SECONDS)

  if (error) return res.status(500).json({ error: error.message })

  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ url: data.signedUrl })
}
