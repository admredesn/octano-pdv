// ============================================================
// octano-pdv  -  ABASTECIMENTO MANUAL + AFERICAO
// ============================================================
// Trabalha direto com oct_tanques (numero, combustivel, estoque_atual).
// Abastecimento: baixa estoque. Afericao: combustivel de teste que VOLTA ao tanque.

let __tanquesCache = null;

async function carregarTanques() {
  const { data } = await sb.from("oct_tanques").select("id,numero,combustivel,estoque_atual,capacidade").eq("empresa_id", PDV.empresaId).eq("ativo", true).order("numero");
  __tanquesCache = data || [];
  return __tanquesCache;
}

// ---- ABASTECIMENTO MANUAL ----
async function abastecimentoAbrir() {
  if (!PDV.turno) { pdvToast("Abra um turno antes.", "alerta"); return; }
  const tanques = await carregarTanques();
  if (!tanques.length) { pdvToast("Nenhum tanque cadastrado (cadastre no retaguarda).", "alerta"); return; }
  const opcoes = tanques.map(t => `<option value="${t.id}">Tanque ${t.numero} - ${t.combustivel} (estoque: ${Number(t.estoque_atual).toLocaleString("pt-BR")} L)</option>`).join("");

  const box = abrirModal(`
    <div style="padding:22px">
      <h2 style="color:#f97316;margin-bottom:2px">Abastecimento Manual</h2>
      <p style="color:#888;font-size:0.8rem;margin-bottom:14px">Registra abastecimento e baixa o estoque do tanque.</p>

      <label style="color:#555;font-size:0.78rem">Tanque / Combustível</label>
      <select id="ab-tanque" style="width:100%;padding:10px;margin:5px 0 12px;border-radius:6px;border:1px solid #ddd;color:#111">${opcoes}</select>

      <div style="display:flex;gap:10px">
        <div style="flex:1">
          <label style="color:#555;font-size:0.78rem">Litros</label>
          <input id="ab-litros" type="number" step="0.001" placeholder="0,000" style="width:100%;padding:10px;margin:5px 0 12px;border-radius:6px;border:1px solid #ddd;color:#111">
        </div>
        <div style="flex:1">
          <label style="color:#555;font-size:0.78rem">Preço/litro (R$)</label>
          <input id="ab-preco" type="number" step="0.001" placeholder="0,000" style="width:100%;padding:10px;margin:5px 0 12px;border-radius:6px;border:1px solid #ddd;color:#111">
        </div>
      </div>

      <label style="color:#555;font-size:0.78rem">Bico / Bomba (opcional)</label>
      <input id="ab-bico" placeholder="ex: Bico 3 / Bomba 2" style="width:100%;padding:10px;margin:5px 0 12px;border-radius:6px;border:1px solid #ddd;color:#111">

      <label style="color:#555;font-size:0.78rem">Frentista</label>
      <input id="ab-vendedor" value="${PDV.operador?.nome || PDV.turno?.operador || ''}" style="width:100%;padding:10px;margin:5px 0 14px;border-radius:6px;border:1px solid #ddd;color:#111">

      <div id="ab-total" style="text-align:right;color:#16a34a;font-weight:700;font-size:1.1rem;margin-bottom:12px">Total: R$ 0,00</div>

      <div style="display:flex;gap:10px">
        <button onclick="abrirMenuOperador()" style="flex:1;padding:11px;border-radius:6px;border:1px solid #ddd;background:#fff;color:#555;cursor:pointer">← Voltar</button>
        <button id="ab-salvar" style="flex:2;padding:11px;border-radius:6px;border:none;background:#f97316;color:#fff;font-weight:600;cursor:pointer">Registrar abastecimento</button>
      </div>
      <div id="ab-msg" style="margin-top:10px;font-size:0.82rem;text-align:center"></div>
    </div>`, { maxWidth: "460px" });

  const litros = box.querySelector("#ab-litros");
  const preco = box.querySelector("#ab-preco");
  const total = box.querySelector("#ab-total");
  const calc = () => { const v = (parseFloat(litros.value) || 0) * (parseFloat(preco.value) || 0); total.textContent = "Total: R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2 }); };
  litros.addEventListener("input", calc); preco.addEventListener("input", calc);
  litros.focus();
  box.querySelector("#ab-salvar").addEventListener("click", () => abastecimentoSalvar(box));
}

async function abastecimentoSalvar(box) {
  const tanqueId = box.querySelector("#ab-tanque").value;
  const litros = parseFloat(box.querySelector("#ab-litros").value) || 0;
  const preco = parseFloat(box.querySelector("#ab-preco").value) || 0;
  const bico = box.querySelector("#ab-bico").value.trim();
  const vendedor = box.querySelector("#ab-vendedor").value.trim();
  const msg = box.querySelector("#ab-msg");
  if (litros <= 0) { msg.style.color = "#dc2626"; msg.textContent = "Informe os litros."; return; }
  const tanque = (__tanquesCache || []).find(t => t.id === tanqueId);
  if (!tanque) { msg.style.color = "#dc2626"; msg.textContent = "Tanque inválido."; return; }
  if (litros > Number(tanque.estoque_atual)) { msg.style.color = "#dc2626"; msg.textContent = `Estoque insuficiente (${tanque.estoque_atual} L).`; return; }
  msg.style.color = "#888"; msg.textContent = "Registrando...";

  const valor = litros * preco;
  // grava o abastecimento
  const { error: e1 } = await sb.from("oct_pdv_abastecimentos").insert({
    empresa_id: PDV.empresaId, turno_id: PDV.turno.id, tipo: "abastecimento",
    tanque_id: tanqueId, combustivel: tanque.combustivel, bico: bico || null,
    litros, preco_litro: preco, valor, vendedor: vendedor || null, status: "concluido",
  });
  if (e1) { msg.style.color = "#dc2626"; msg.textContent = "Erro: " + e1.message; return; }
  // baixa o estoque do tanque
  const novoEstoque = Number(tanque.estoque_atual) - litros;
  await sb.from("oct_tanques").update({ estoque_atual: novoEstoque }).eq("id", tanqueId);

  fecharModal();
  pdvToast(`Abastecimento de ${litros} L registrado. Estoque do tanque ${tanque.numero}: ${novoEstoque.toLocaleString("pt-BR")} L.`, "sucesso");
}

// ---- AFERICAO (combustivel de teste que VOLTA ao tanque) ----
async function afericaoAbrir() {
  if (!PDV.turno) { pdvToast("Abra um turno antes.", "alerta"); return; }
  const tanques = await carregarTanques();
  if (!tanques.length) { pdvToast("Nenhum tanque cadastrado.", "alerta"); return; }
  const opcoes = tanques.map(t => `<option value="${t.id}">Tanque ${t.numero} - ${t.combustivel}</option>`).join("");

  const box = abrirModal(`
    <div style="padding:22px">
      <h2 style="color:#2563eb;margin-bottom:2px">Aferição de Bico</h2>
      <p style="color:#888;font-size:0.8rem;margin-bottom:14px">Teste de medida da bomba. O combustível retorna ao tanque (não é venda).</p>

      <label style="color:#555;font-size:0.78rem">Tanque / Combustível</label>
      <select id="af-tanque" style="width:100%;padding:10px;margin:5px 0 12px;border-radius:6px;border:1px solid #ddd;color:#111">${opcoes}</select>

      <label style="color:#555;font-size:0.78rem">Litros aferidos (voltam ao tanque)</label>
      <input id="af-litros" type="number" step="0.001" value="20" style="width:100%;padding:10px;margin:5px 0 12px;border-radius:6px;border:1px solid #ddd;color:#111">

      <label style="color:#555;font-size:0.78rem">Bico / Bomba (opcional)</label>
      <input id="af-bico" placeholder="ex: Bico 3" style="width:100%;padding:10px;margin:5px 0 12px;border-radius:6px;border:1px solid #ddd;color:#111">

      <label style="color:#555;font-size:0.78rem">Frentista</label>
      <input id="af-vendedor" value="${PDV.operador?.nome || PDV.turno?.operador || ''}" style="width:100%;padding:10px;margin:5px 0 14px;border-radius:6px;border:1px solid #ddd;color:#111">

      <div style="display:flex;gap:10px">
        <button onclick="abrirMenuOperador()" style="flex:1;padding:11px;border-radius:6px;border:1px solid #ddd;background:#fff;color:#555;cursor:pointer">← Voltar</button>
        <button id="af-salvar" style="flex:2;padding:11px;border-radius:6px;border:none;background:#2563eb;color:#fff;font-weight:600;cursor:pointer">Registrar aferição ↺</button>
      </div>
      <div id="af-msg" style="margin-top:10px;font-size:0.82rem;text-align:center"></div>
    </div>`, { maxWidth: "440px" });
  box.querySelector("#af-litros").focus();
  box.querySelector("#af-salvar").addEventListener("click", () => afericaoSalvar(box));
}

async function afericaoSalvar(box) {
  const tanqueId = box.querySelector("#af-tanque").value;
  const litros = parseFloat(box.querySelector("#af-litros").value) || 0;
  const bico = box.querySelector("#af-bico").value.trim();
  const vendedor = box.querySelector("#af-vendedor").value.trim();
  const msg = box.querySelector("#af-msg");
  if (litros <= 0) { msg.style.color = "#dc2626"; msg.textContent = "Informe os litros."; return; }
  const tanque = (__tanquesCache || []).find(t => t.id === tanqueId);
  if (!tanque) { msg.style.color = "#dc2626"; msg.textContent = "Tanque inválido."; return; }
  msg.style.color = "#888"; msg.textContent = "Registrando...";

  // grava a afericao (tipo afericao, sem valor de venda)
  const { error: e1 } = await sb.from("oct_pdv_abastecimentos").insert({
    empresa_id: PDV.empresaId, turno_id: PDV.turno.id, tipo: "afericao",
    tanque_id: tanqueId, combustivel: tanque.combustivel, bico: bico || null,
    litros, preco_litro: 0, valor: 0, vendedor: vendedor || null, status: "concluido",
    observacao: "Aferição - combustível retornado ao tanque",
  });
  if (e1) { msg.style.color = "#dc2626"; msg.textContent = "Erro: " + e1.message; return; }
  // o combustivel VOLTA ao tanque (afericao nao consome) -> estoque inalterado.
  // Registramos para controle, mas nao baixamos estoque.

  fecharModal();
  pdvToast(`Aferição de ${litros} L no tanque ${tanque.numero} registrada (combustível retornado).`, "sucesso");
}
