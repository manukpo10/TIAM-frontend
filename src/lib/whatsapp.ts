// TIAM's WhatsApp business number in international format (no "+"), for wa.me links.
// Argentine mobiles carry the "9" right after the "54" country code.
export const WHATSAPP_NUMBER = '5492214817297'

// The message a buyer sends to activate the 30-day Challenge. The backend matches the sender's
// phone number against the purchase, so the wording is only a courtesy to whoever reads the chat.
export const DESAFIO_ACTIVATION_TEXT =
  '¡Hola! Ya compré el Desafío 30 días y quiero empezar. ¿Me mandan mi primer ejercicio? 💙'

export const desafioActivationLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(DESAFIO_ACTIVATION_TEXT)}`

/** Plain "write to us" link, without a prefilled message about the Challenge. */
export const supportLink = `https://wa.me/${WHATSAPP_NUMBER}`
