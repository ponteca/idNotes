/**
 * RNF002 (backend) - Envio transacional da idKey ao e-mail do usuário.
 *
 * Stub de envio: em produção, integrar um provedor (SendGrid, SES, Resend...)
 * e disparar dentro da janela de 60s exigida pela especificação. Aqui apenas
 * registramos o envio em log para fins de desenvolvimento/testes.
 */
export async function sendIdKeyEmail(email: string, idKey: string): Promise<void> {
  // TODO: substituir por chamada real ao provedor de e-mail transacional.
  console.log(`[email] (stub) idKey enviada para ${email}: ${idKey}`);
}
