/**
 * Fetches a protein sequence from UniProt by accession ID.
 * Returns the raw amino acid sequence string (no FASTA header).
 */
export async function fetchUniProt(accessionId: string): Promise<string> {
  const id = accessionId.trim().toUpperCase()
  const url = `https://rest.uniprot.org/uniprotkb/${encodeURIComponent(id)}.fasta`


  const res = await fetch(url, {
    headers: { Accept: 'text/plain' },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `UniProt fetch failed for "${id}": ${res.status} ${res.statusText}\n${body}`
    )
  }

  const fasta = await res.text()
  const seq = fasta
    .split('\n')
    .filter((l) => l && !l.startsWith('>'))
    .join('')
    .trim()

  if (!seq) throw new Error(`No sequence found for "${id}"`)
  return seq
}