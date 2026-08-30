// Função serverless da Vercel — repassa o payload do Formulário Padrão para
// a API pública de leads do CRM (POST /api/v1/leads), adicionando a API key
// no lado do servidor. A chave nunca fica no HTML/JS que o navegador baixa:
// só existe aqui, lida de uma variável de ambiente (CRM_API_KEY, configurada
// no painel do projeto "formulario" na Vercel — Settings > Environment
// Variables), do mesmo jeito que o backend do CRM já faz.
//
// Só repassa os campos que montarPayload() (formulario-padrao.html) envia —
// não vira um gateway genérico "escreva qualquer coisa no CRM com minha
// chave" pra quem descobrir esta URL. Endpoint continua sem autenticação de
// chamador (ver aviso do commit): o rate limit de 30/min por chave já
// existente no CRM é a única contenção real contra abuso automatizado.
const CRM_API_URL = "https://crm.hineni.agency/api/v1/leads";

function str(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 2000) : null;
}

function buildPayload(body) {
  return {
    name: str(body.name),
    company: str(body.company),
    whatsapp: str(body.whatsapp),
    email: str(body.email),
    service: str(body.service),
    origin: str(body.origin) || "formulario",
    notes: str(body.notes)
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Método não permitido." });
  }

  const apiKey = process.env.CRM_API_KEY;
  if (!apiKey) {
    console.error("[enviar-crm] CRM_API_KEY não configurada no ambiente da Vercel.");
    return res.status(500).json({ message: "Integração com o CRM não configurada no servidor." });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const payload = buildPayload(body);

  if (!payload.name) {
    return res.status(400).json({ message: "Informe o nome do lead." });
  }

  try {
    const crmResponse = await fetch(CRM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey
      },
      body: JSON.stringify(payload)
    });

    const data = await crmResponse.json().catch(() => ({}));
    return res.status(crmResponse.status).json(data);
  } catch (error) {
    console.error("[enviar-crm] falha ao repassar para o CRM", error);
    return res.status(502).json({ message: "Falha ao contatar o CRM. Tente novamente." });
  }
}
