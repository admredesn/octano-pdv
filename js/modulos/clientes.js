// ============================================================
// octano-pdv  -  CLIENTES (consulta, cadastro, selecao, dados manuais)
// ============================================================
// Fonte unica: tabela oct_pessoas (compartilhada com o retaguarda). Filtra
// quem tem a classificacao 'cliente'. Cadastrar aqui cria a pessoa ja como cliente.

// ---- F3: selecionar cliente para a venda ----
function pdvSelecionarCliente() {
  const box = abrirModal(`
    <div style="padding:22px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h2 style="color:#f97316">Cliente</h2>
        <button onclick="clienteNovo()" style="padding:6px 12px;border-radius:6px;border:none;background:#16a34a;color:#fff;cursor:pointer;font-size:0.82rem">+ Novo cliente</button>
      </div>
      <input id="cl-busca" placeholder="Buscar por nome, documento ou telefone..." style="width:100%;padding:10px;margin-bottom:12px;border-radius:6px;border:1px solid #ddd;color:#111">
      <div id="cl-lista" style="max-height:300px;overflow:auto"></div>
      ${PDV.venda.cliente ? `<div style="margin-top:12px;padding:10px;background:#ecfdf5;border-radius:6px;color:#065f46;font-size:0.85rem">Cliente atual: <strong>${PDV.venda.cliente.nome}</strong> <span onclick="clienteRemover()" style="color:#dc2626;cursor:pointer;float:right">remover</span></div>` : ""}
      <button onclick="fecharModal()" style="width:100%;margin-top:14px;padding:10px;border-radius:6px;border:1px solid #ddd;background:#fff;color:#555;cursor:pointer">Fechar</button>
    </div>`, { maxWidth: "460px" });

  const busca = box.querySelector("#cl-busca");
  busca.focus();
  let timer;
  busca.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => clienteBuscar(busca.value), 250); });
  clienteBuscar("");
}

async function clienteBuscar(termo) {
  const el = document.getElementById("cl-lista");
  if (!el) return;
  termo = (termo || "").trim();
  // Fonte unica de pessoas (oct_pessoas). Filtra quem e 'cliente' na classificacao.
  // cs = contains: classificacoes @> {cliente}. Tambem aceita o 'tipo' antigo.
  let q = sb.from("oct_pessoas")
    .select("id,nome,documento,telefone,email,classificacoes,tipo")
    .eq("empresa_id", PDV.empresaId).eq("ativo", true)
    .order("nome").limit(40);
  if (termo) q = q.or(`nome.ilike.%${termo}%,documento.ilike.%${termo}%,telefone.ilike.%${termo}%`);
  const { data } = await q;
  // mantem apenas quem e cliente (classificacoes contem 'cliente', ou tipo antigo cliente/ambos)
  const lista = (data || []).filter(p =>
    (Array.isArray(p.classificacoes) && p.classificacoes.includes("cliente")) ||
    p.tipo === "cliente" || p.tipo === "ambos"
  );
  if (!lista.length) {
    el.innerHTML = '<p style="color:#999;padding:14px;text-align:center;font-size:0.85rem">Nenhum cliente. Use "+ Novo cliente".</p>';
    return;
  }
  el.innerHTML = lista.map(c => `
    <div onclick='clienteSelecionar(${JSON.stringify({id:c.id,nome:c.nome,documento:c.documento,telefone:c.telefone,email:c.email}).replace(/'/g, "&#39;")})' style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid #eee;cursor:pointer" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
      <div>
        <div style="color:#111;font-weight:600;font-size:0.9rem">${c.nome}</div>
        <div style="color:#888;font-size:0.76rem">${c.documento || "sem documento"}${c.telefone ? " · " + c.telefone : ""}</div>
      </div>
      <span style="color:#f97316;font-size:0.8rem">selecionar →</span>
    </div>`).join("");
}

function clienteSelecionar(c) {
  PDV.venda.cliente = c;
  PDV.venda.clienteManual = null; // selecionar cliente cadastrado limpa dados manuais
  fecharModal();
  if (typeof pdvAtualizarIndicadorCliente === "function") pdvAtualizarIndicadorCliente();
  pdvToast(`Cliente: ${c.nome}`, "sucesso");
}

function clienteRemover() {
  PDV.venda.cliente = null;
  fecharModal();
  if (typeof pdvAtualizarIndicadorCliente === "function") pdvAtualizarIndicadorCliente();
  pdvToast("Cliente removido da venda.", "info");
}

// ---- cadastrar novo cliente ----
function clienteNovo() {
  const box = abrirModal(`
    <div style="padding:22px">
      <h2 style="color:#f97316;margin-bottom:14px">Novo Cliente</h2>
      <label style="color:#555;font-size:0.78rem">Nome *</label>
      <input id="nc-nome" style="width:100%;padding:9px;margin:5px 0 12px;border-radius:6px;border:1px solid #ddd;color:#111">
      <label style="color:#555;font-size:0.78rem">CPF/CNPJ</label>
      <input id="nc-doc" placeholder="só números" style="width:100%;padding:9px;margin:5px 0 12px;border-radius:6px;border:1px solid #ddd;color:#111">
      <label style="color:#555;font-size:0.78rem">Telefone</label>
      <input id="nc-tel" style="width:100%;padding:9px;margin:5px 0 12px;border-radius:6px;border:1px solid #ddd;color:#111">
      <label style="color:#555;font-size:0.78rem">E-mail</label>
      <input id="nc-email" style="width:100%;padding:9px;margin:5px 0 16px;border-radius:6px;border:1px solid #ddd;color:#111">
      <div style="display:flex;gap:10px">
        <button onclick="pdvSelecionarCliente()" style="flex:1;padding:10px;border-radius:6px;border:1px solid #ddd;background:#fff;color:#555;cursor:pointer">← Voltar</button>
        <button id="nc-salvar" style="flex:2;padding:10px;border-radius:6px;border:none;background:#16a34a;color:#fff;font-weight:600;cursor:pointer">Salvar e usar</button>
      </div>
      <div id="nc-msg" style="margin-top:10px;font-size:0.82rem;text-align:center"></div>
    </div>`, { maxWidth: "420px" });
  box.querySelector("#nc-nome").focus();
  box.querySelector("#nc-salvar").addEventListener("click", () => clienteSalvar(box));
}

async function clienteSalvar(box) {
  const nome = box.querySelector("#nc-nome").value.trim();
  const doc = box.querySelector("#nc-doc").value.replace(/\D/g, "");
  const tel = box.querySelector("#nc-tel").value.trim();
  const email = box.querySelector("#nc-email").value.trim();
  const msg = box.querySelector("#nc-msg");
  if (!nome) { msg.style.color = "#dc2626"; msg.textContent = "Informe o nome."; return; }
  msg.style.color = "#888"; msg.textContent = "Salvando...";
  // Cadastra na fonte unica (oct_pessoas) ja classificado como 'cliente'.
  const { data, error } = await sb.from("oct_pessoas").insert({
    empresa_id: PDV.empresaId,
    nome,
    documento: doc || null,
    telefone: tel || null,
    email: email || null,
    classificacoes: ["cliente"],
    tipo: "cliente",
    ativo: true,
  }).select("id,nome,documento,telefone,email").single();
  if (error) { msg.style.color = "#dc2626"; msg.textContent = "Erro: " + error.message; return; }
  clienteSelecionar(data);
}

// ---- F4: dados do cliente manuais (CPF/nome no cupom, sem cadastrar) ----
function pdvDadosClienteManual() {
  const atual = PDV.venda.clienteManual || {};
  const box = abrirModal(`
    <div style="padding:22px">
      <h2 style="color:#f97316;margin-bottom:2px">Dados no Cupom</h2>
      <p style="color:#888;font-size:0.8rem;margin-bottom:14px">Quando o cliente exige o CPF/CNPJ na nota, sem precisar cadastrar.</p>
      <label style="color:#555;font-size:0.78rem">CPF/CNPJ</label>
      <input id="dm-doc" value="${atual.cpf || ''}" placeholder="só números" style="width:100%;padding:9px;margin:5px 0 12px;border-radius:6px;border:1px solid #ddd;color:#111">
      <label style="color:#555;font-size:0.78rem">Nome (opcional)</label>
      <input id="dm-nome" value="${atual.nome || ''}" style="width:100%;padding:9px;margin:5px 0 16px;border-radius:6px;border:1px solid #ddd;color:#111">
      <div style="display:flex;gap:10px">
        <button onclick="fecharModal()" style="flex:1;padding:10px;border-radius:6px;border:1px solid #ddd;background:#fff;color:#555;cursor:pointer">Cancelar</button>
        <button id="dm-salvar" style="flex:2;padding:10px;border-radius:6px;border:none;background:#f97316;color:#fff;font-weight:600;cursor:pointer">Usar no cupom</button>
      </div>
      <div id="dm-msg" style="margin-top:10px;font-size:0.82rem;text-align:center"></div>
    </div>`, { maxWidth: "400px" });
  box.querySelector("#dm-doc").focus();
  box.querySelector("#dm-salvar").addEventListener("click", () => {
    const doc = box.querySelector("#dm-doc").value.replace(/\D/g, "");
    const nome = box.querySelector("#dm-nome").value.trim();
    const msg = box.querySelector("#dm-msg");
    if (doc && doc.length !== 11 && doc.length !== 14) { msg.style.color = "#dc2626"; msg.textContent = "CPF (11) ou CNPJ (14) dígitos."; return; }
    PDV.venda.clienteManual = doc ? { cpf: doc, nome: nome || null } : null;
    fecharModal();
    if (typeof pdvAtualizarIndicadorCliente === "function") pdvAtualizarIndicadorCliente();
    pdvToast(doc ? `Documento no cupom: ${doc}` : "Dados do cupom limpos.", "sucesso");
  });
}
