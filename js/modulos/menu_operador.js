// ============================================================
// octano-pdv  -  MENU OPERADOR (F7)
// ============================================================
// Overlay com grid de botoes, no estilo do sistema legado (Tecno X).

function abrirMenuOperador() {
  const itens = [
    { rotulo: "Abrir Turno", icone: "🔓", fn: "fecharModal();irPara('turno')", cond: () => !PDV.turno },
    { rotulo: "Fechar Turno", icone: "🔒", fn: "fecharModal();irPara('turno')", cond: () => !!PDV.turno },
    { rotulo: "Suprimento", icone: "➕", fn: "caixaAbrir('suprimento')" },
    { rotulo: "Sangria", icone: "➖", fn: "caixaAbrir('sangria')" },
    { rotulo: "Despesa", icone: "📤", fn: "caixaAbrir('despesa')" },
    { rotulo: "Receita", icone: "📥", fn: "caixaAbrir('receita')" },
    { rotulo: "Leitura X", icone: "📊", fn: "leituraX()" },
    { rotulo: "Aferição", icone: "🧪", fn: "afericaoAbrir()" },
    { rotulo: "Venda a Prazo", icone: "📝", fn: "prazoAbrir()" },
    { rotulo: "Contas a Prazo", icone: "💰", fn: "prazoListar()" },
    { rotulo: "Cupom → NF-e", icone: "🔄", fn: "cupomParaNfe()" },
    { rotulo: "Fidelidade", icone: "★", fn: "fidelidadeConsultar()" },
    { rotulo: "Consultar Produtos", icone: "🔍", fn: "produtosConsultar()" },
    { rotulo: "Registrar Ponto", icone: "🕐", fn: "pontoAbrir()" },
    { rotulo: "Cupons Fiscais", icone: "🧾", fn: "fecharModal();irPara('cupons')" },
  ];
  const visiveis = itens.filter(i => !i.cond || i.cond());
  const botoes = visiveis.map(i => `
    <button onclick="${i.fn}" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:18px 8px;border-radius:10px;border:1px solid #2a2d3e;background:#1a1f3a;color:#fff;cursor:pointer;min-height:92px;transition:background .15s" onmouseover="this.style.background='#252a4a'" onmouseout="this.style.background='#1a1f3a'">
      <span style="font-size:1.6rem">${i.icone}</span>
      <span style="font-size:0.82rem;text-align:center">${i.rotulo}</span>
    </button>`).join("");

  abrirModal(`
    <div style="padding:22px;background:#0d0f17">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2 style="color:#f97316">Menu Operador</h2>
        <button onclick="fecharModal()" style="background:#2a2d3e;color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer">Fechar (Esc)</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">${botoes}</div>
    </div>`, { maxWidth: "480px" });
}

// fecha o menu com Esc
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.getElementById("pdv-modal-overlay")) fecharModal();
});
