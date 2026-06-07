// ============================================================
// octano-pdv  -  REGISTRO DE PONTO
// ============================================================

function pontoAbrir() {
  const box = abrirModal(`
    <div style="padding:22px">
      <h2 style="color:#f97316;margin-bottom:2px">Registrar Ponto</h2>
      <p style="color:#888;font-size:0.8rem;margin-bottom:16px">Entrada / saída de funcionário</p>

      <label style="color:#555;font-size:0.8rem">Funcionário</label>
      <input id="pt-func" placeholder="Nome do funcionário" value="${PDV.operador?.nome || PDV.turno?.operador || ''}" style="width:100%;padding:10px;margin:6px 0 14px;border-radius:6px;border:1px solid #ddd;color:#111">

      <label style="color:#555;font-size:0.8rem">Tipo</label>
      <div id="pt-tipo" style="display:flex;gap:8px;margin:8px 0 14px">
        <button data-tipo="entrada" class="pt-opt" style="flex:1;padding:10px;border-radius:6px;border:2px solid #16a34a;background:#16a34a;color:#fff;cursor:pointer;font-weight:600">▶ Entrada</button>
        <button data-tipo="saida" class="pt-opt" style="flex:1;padding:10px;border-radius:6px;border:2px solid #ddd;background:#fff;color:#555;cursor:pointer;font-weight:600">◀ Saída</button>
      </div>

      <label style="color:#555;font-size:0.8rem">Observação (opcional)</label>
      <input id="pt-obs" placeholder="ex: início do turno" style="width:100%;padding:10px;margin:6px 0 18px;border-radius:6px;border:1px solid #ddd;color:#111">

      <div style="display:flex;gap:10px">
        <button onclick="abrirMenuOperador()" style="flex:1;padding:11px;border-radius:6px;border:1px solid #ddd;background:#fff;color:#555;cursor:pointer">← Voltar</button>
        <button id="pt-salvar" style="flex:2;padding:11px;border-radius:6px;border:none;background:#f97316;color:#fff;font-weight:600;cursor:pointer">Registrar Ponto</button>
      </div>
      <div id="pt-msg" style="margin-top:12px;font-size:0.84rem;text-align:center"></div>
    </div>`, { maxWidth: "420px" });

  let tipoSel = "entrada";
  box.querySelectorAll(".pt-opt").forEach(b => b.addEventListener("click", () => {
    tipoSel = b.dataset.tipo;
    box.querySelectorAll(".pt-opt").forEach(x => {
      const ativo = x.dataset.tipo === tipoSel;
      const cor = x.dataset.tipo === "entrada" ? "#16a34a" : "#dc2626";
      x.style.border = "2px solid " + (ativo ? cor : "#ddd");
      x.style.background = ativo ? cor : "#fff";
      x.style.color = ativo ? "#fff" : "#555";
    });
  }));

  box.querySelector("#pt-salvar").addEventListener("click", async () => {
    const func = box.querySelector("#pt-func").value.trim();
    const obs = box.querySelector("#pt-obs").value.trim();
    const msg = box.querySelector("#pt-msg");
    if (!func) { msg.style.color = "#dc2626"; msg.textContent = "Informe o funcionário."; return; }
    msg.style.color = "#888"; msg.textContent = "Registrando...";
    const { error } = await sb.from("oct_pdv_ponto").insert({
      empresa_id: PDV.empresaId, turno_id: PDV.turno?.id || null,
      funcionario: func, tipo: tipoSel, observacao: obs || null,
    });
    if (error) { msg.style.color = "#dc2626"; msg.textContent = "Erro: " + error.message; return; }
    fecharModal();
    pdvToast(`Ponto de ${tipoSel} registrado para ${func}.`, "sucesso");
  });
}
