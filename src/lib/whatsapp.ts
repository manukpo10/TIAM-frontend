// TIAM's WhatsApp business number in international format (no "+"), for wa.me links.
// Argentine mobiles carry the "9" right after the "54" country code.
export const WHATSAPP_NUMBER = '5492214817297'

// The Challenge month runs 30 days from the PURCHASE and starts from the buyer's personal link. WhatsApp is only the fallback: the message a buyer
// sends when there is no link (the backend matches the sender's phone number against the purchase, so the wording is a courtesy to whoever reads the chat).
export const DESAFIO_ACTIVATION_TEXT =
  '¡Hola! Ya compré el Desafío 30 días y quiero empezar. ¿Me pasan mi link? 💙'

export const desafioActivationLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(DESAFIO_ACTIVATION_TEXT)}`

/** Plain "write to us" link, without a prefilled message about the Challenge. */
export const supportLink = `https://wa.me/${WHATSAPP_NUMBER}`
