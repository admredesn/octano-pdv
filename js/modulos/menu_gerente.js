// ============================================================
// octano-pdv  -  MENU GERENTE (F8)
// ============================================================
// Overlay administrativo, estilo legado (Tecno X).

function abrirMenuGerente() {
  const itens = [
    { rotulo: "Alterar Preço", icone: "💲", fn: "gerAlterarPreco()" },
    { rotulo: "Ajuste de Tanque", icone: "🛢️", fn: "gerAjusteTanque()" },
    { rotulo: "Cadastro Vendedor", icone: "👤", fn: "gerVendedores()" },
    { rotulo: "Relatório do Dia", icone: "📈", fn: "gerRelatorioDia()" },
  ];
  const botoes = itens.map(i => `
    <button onclick="${i.fn}" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:18px 8px;border-radius:10px;border:1px solid #2a2d3e;background:#1a1f3a;color:#fff;cursor:pointer;min-height:92px;transition:background .15s" onmouseover="this.style.background='#252a4a'" onmouseout="this.style.background='#1a1f3a'">
      <span style="font-size:1.6rem">${i.icone}</span>
      <span style="font-size:0.82rem;text-align:center">${i.rotulo}</span>
    </button>`).join("");

  abrirModal(`
    <div style="padding:22px;background:#0d0f17">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2 style="color:#a855f7">Menu Gerente</h2>
        <button onclick="fecharModal()" style="background:#2a2d3e;color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer">Fechar (Esc)</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">${botoes}</div>
    </div>`, { maxWidth: "400px" });
}
