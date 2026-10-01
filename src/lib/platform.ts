/**
 * The professionals platform isn't open to the public yet. While this is
 * false, /plataforma renders the "Próximamente" page (PlataformaComingSoonPage)
 * instead of the full sales page (PlataformaPage, kept intact for the launch),
 * and the site stops inviting sign-ups or describing the platform as live:
 * the header's "Probá gratis" and "Cómo funciona" (/demo tour), the footer's
 * "Cómo funciona", "Planes" and "Crear cuenta" links and its blurb, the login
 * page's sign-up prompt, the FAQ's "Sobre TIAM" section, and the blog-post CTA
 * (which points to the coming-soon page instead). /demo and /register still
 * answer by direct URL. Flip to true at launch to bring all of it back — and
 * update index.html's meta/og descriptions by hand, which can't read this flag.
 */
export const PLATFORM_LAUNCHED = false
