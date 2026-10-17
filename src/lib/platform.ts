/**
 * The professionals platform isn't open to the public yet. While this is
 * false, /plataforma renders the "Próximamente" page (PlataformaComingSoonPage)
 * instead of the full sales page (PlataformaPage, kept intact for the launch),
 * and the site stops offering accounts or describing the platform as live:
 * the header's "Iniciar sesión", "Probá gratis" and "Cómo funciona" (/demo
 * tour), the footer's "Cómo funciona", "Planes", "Iniciar sesión" and "Crear
 * cuenta" links and its blurb, the login page's sign-up prompt, the FAQ's
 * "Sobre TIAM" section, and the blog-post CTA (which points to the coming-soon
 * page instead). /login, /demo and /register still answer by direct URL, and a
 * logged-in user still gets "Ir a la biblioteca". Flip to true at launch to
 * bring all of it back — and update index.html's meta/og descriptions by hand,
 * which can't read this flag.
 */
export const PLATFORM_LAUNCHED = false

/**
 * The printable material (the Pack Básico) isn't finished, so it can't be bought yet. While this is
 * false, /material-digital shows its cards as "Próximamente": no price, no "Vista previa" bar and no
 * link to the product's landing (the landings stay online as a preview, reachable only by their URL).
 * Flip to true at launch, once the prices are final (see PREVIEW in MaterialDigitalPage).
 */
export const MATERIAL_LAUNCHED = false
