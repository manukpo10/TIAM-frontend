/**
 * Pure rules of the "Material digital" shelf (MaterialDigitalPage.tsx). They have their tests in tests/material-shelf.test.ts (`npm test`).
 *
 * While MATERIAL_LAUNCHED (lib/platform.ts) is false the whole shelf says "Próximamente": no card links anywhere and none shows a price, EXCEPT a product that is
 * `onSale` (the Cuadernos TIAM: the owner opened their sale on 2026-10-19). Its card says "Disponible", shows its price and links to its landing.
 */

export interface ShelfProduct {
  /** The product's landing: a path served outside the app (a plain <a>, never <Link>) or a full URL. */
  landing?: string
  /** Final price in Argentine pesos. */
  price?: number
  /** The product can be bought now, whatever the rest of the shelf says. */
  onSale?: boolean
}

/** The landing a card links to right now, or undefined when it does not link anywhere. */
export function visibleLanding(product: ShelfProduct, launched: boolean): string | undefined {
  if (!product.landing) return undefined
  return launched || product.onSale ? product.landing : undefined
}

/** A price is shown when the product has one and it can be bought (the shelf is launched, or the product is on sale). */
export function showsPrice(product: ShelfProduct, launched: boolean): boolean {
  return product.price !== undefined && (launched || !!product.onSale)
}

/** The small badge over the picture while the shelf is not launched: "Disponible" for a product on sale, "Próximamente" for the rest. */
export function shelfBadge(product: ShelfProduct, launched: boolean): string | null {
  if (launched) return null
  return product.onSale ? 'Disponible' : 'Próximamente'
}

/** Only absolute http(s) URLs open in a new tab; a path of the site (like /cuadernos) is a plain link in the same tab. */
export const isExternal = (url: string): boolean => /^https?:\/\//.test(url)

const list = (names: string[]): string => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`)

/**
 * The line under the shelf's title.
 * @param total how many products the shelf has
 * @param onSaleNames the names of the products that can be bought now (see `onSale`)
 */
export function shelfCount(total: number, onSaleNames: string[], launched: boolean): string {
  if (launched) return total === 1 ? '1 producto, en PDF para imprimir.' : `${total} productos, todos en PDF para imprimir.`
  if (onSaleNames.length === 0) {
    return total === 1 ? '1 pack, en PDF para imprimir. Todavía no se puede comprar.' : `${total} packs, todos en PDF para imprimir. Todavía no se pueden comprar.`
  }
  const now = `Ya podés comprar ${list(onSaleNames)}.`
  const others = onSaleNames.length < total ? ' Los demás todavía no se pueden comprar.' : ''
  return `${total} productos, todos en PDF para imprimir. ${now}${others}`
}
