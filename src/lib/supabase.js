import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error(
    "VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont manquantes. " +
    "Copie .env.example en .env et remplis-les."
  )
}

// La clé anon est publique par conception : ce sont les règles RLS du schéma
// qui décident ce que chaque membre peut lire.
export const supabase = createClient(url, key)

// Utile aux envois fragmentés, qui tapent l'API Storage directement.
export const SUPABASE_URL = url
