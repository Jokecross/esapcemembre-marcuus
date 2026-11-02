/**
 * Copie un texte tel quel dans le presse-papiers.
 *
 * L'API moderne d'abord ; si le navigateur la refuse (page non sécurisée,
 * permission bloquée, vieux Safari), on passe par une zone de texte
 * cachée et execCommand. Renvoie true si l'une des deux a marché.
 */
export async function copier(texte) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texte)
      return true
    }
  } catch {
    /* on tente la solution de secours */
  }

  const zone = document.createElement('textarea')
  zone.value = texte
  zone.setAttribute('readonly', '')
  zone.style.position = 'fixed'
  zone.style.top = '0'
  zone.style.left = '-9999px'
  zone.style.opacity = '0'
  document.body.appendChild(zone)
  // iOS ne sélectionne qu'avec setSelectionRange.
  zone.select()
  zone.setSelectionRange(0, texte.length)
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(zone)
  return ok
}
