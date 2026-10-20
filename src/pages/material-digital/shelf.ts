/**
 * Pure rules of the "Material digital" shelf (MaterialDigitalPage.tsx). They have their tests in tests/material-shelf.test.ts (`npm test`).
 *
 * While MATERIAL_LAUNCHED (lib/platform.ts) is false the whole shelf says "Próximamente" and no card links anywhere, EXCEPT a product that is
 * `landingOpen`: its landing page is already online (in preview, with sales off), so its card links to it even though it cannot be bought yet.
 */

export interface ShelfProduct {
  /** The product's landing: a path served outside the app (a plain <a>, never <Link>) or a full URL. */
  landing?: string
  /** The landing is already online while the shelf is not launched: the card links to it (with a "Muy pronto" badge, no price). */
  landingOpen?: boolean
}

/** The landing a card links to right now, or undefined when it does not link anywhere. */
export function visibleLanding(product: ShelfProduct, launched: boolean): string | undefined {
  if (!product.landing) return undefined
  return launched || product.landingOpen ? product.landing : undefined
}

/** Only absolute http(s) URLs open in a new tab; a path of the site (like /cuadernos) is a plain link in the same tab. */
export const isExternal = (url: string): boolean => /^https?:\/\//.test(url)

const list = (names: string[]): string => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`)

/**
 * The line under the shelf's title.
 * @param total how many products the shelf has
 * @param openNames the names of the products whose landing is already online (see `landingOpen`)
 */
export function shelfCount(total: number, openNames: string[], launched: boolean): string {
  if (launched) return total === 1 ? '1 producto, en PDF para imprimir.' : `${total} productos, todos en PDF para imprimir.`
  if (openNames.length === 0) {
    return total === 1 ? '1 pack, en PDF para imprimir. Todavía no se puede comprar.' : `${total} packs, todos en PDF para imprimir. Todavía no se pueden comprar.`
  }
  const seen = `Ya podés ver ${openNames.length > 1 ? 'las páginas' : 'la página'} de ${list(openNames)}: la compra abre muy pronto.`
  const others = openNames.length < total ? ' Los demás todavía no se pueden comprar.' : ''
  return `${total} productos, todos en PDF para imprimir. ${seen}${others}`
}
