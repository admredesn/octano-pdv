// ============================================================
// octano-pdv  -  Modulo CUPONS FISCAIS (NFC-e)
// ============================================================
// Stub da Fase 0. Na proxima fase: lista de NFC-e do turno/dia,
// reimpressao, cancelamento, transformar em NF-e.

registrarTela("cupons", function (root) {
  root.innerHTML = `
    <div style="max-width:900px;margin:30px auto;padding:0 14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2 style="color:#f97316">Cupons Fiscais (NFC-e)</h2>
        <button onclick="irPara('venda')" style="padding:7px 14px;border-radius:6px;border:1px solid #2a2d3e;background:#13151f;color:#60a5fa;cursor:pointer">← Voltar à venda</button>
      </div>
      <div style="background:#13151f;border:1px solid #2a2d3e;border-radius:10px;padding:30px;text-align:center;color:#888">
        Lista de cupons, reimpressão e cancelamento entram na próxima fase.
      </div>
    </div>`;
});
