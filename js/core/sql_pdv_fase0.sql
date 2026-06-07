-- ============================================================
-- octano-pdv  -  Tabelas (Fase 0/1)
-- Rodar no SQL Editor do Supabase. Compartilha o mesmo banco do retaguarda.
-- ============================================================

-- TURNOS de caixa
create table if not exists oct_pdv_turnos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references oct_empresas(id),
  numero          integer not null,
  operador        text,
  valor_abertura  numeric(12,2) default 0,
  status          text not null default 'aberto',  -- aberto | fechado
  aberto_em       timestamptz default now(),
  fechado_em      timestamptz,
  created_at      timestamptz default now()
);
create index if not exists idx_pdv_turnos_empresa on oct_pdv_turnos(empresa_id, status);

-- VENDAS do PDV (cabecalho). Os itens vao em jsonb por simplicidade na Fase 1.
create table if not exists oct_pdv_vendas (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references oct_empresas(id),
  turno_id         uuid references oct_pdv_turnos(id),
  numero           integer,
  operador         text,
  vendedor         text,
  cliente_id       uuid,
  cliente_nome     text,
  cliente_cpf      text,
  itens            jsonb default '[]'::jsonb,
  pagamentos       jsonb default '[]'::jsonb,
  valor_total      numeric(12,2) default 0,
  status           text not null default 'aberta',  -- aberta | concluida | cancelada
  -- vinculo com a NFC-e (quando emitida)
  nfce_id          uuid,
  nfce_chave       text,
  nfce_protocolo   text,
  nfce_status      text,        -- autorizada | cancelada | nao_emitida
  data_venda       timestamptz default now(),
  created_at       timestamptz default now()
);
create index if not exists idx_pdv_vendas_empresa on oct_pdv_vendas(empresa_id, data_venda desc);
create index if not exists idx_pdv_vendas_turno on oct_pdv_vendas(turno_id);

-- ABASTECIMENTOS (alimentado manualmente/importacao agora; pela bomba na Fase 6)
create table if not exists oct_pdv_abastecimentos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references oct_empresas(id),
  turno_id      uuid references oct_pdv_turnos(id),
  bico          integer,
  bomba         integer,
  tanque        integer,
  produto_id    uuid references oct_produtos(id),
  produto_nome  text,
  litros        numeric(12,3),
  preco_litro   numeric(12,3),
  valor_total   numeric(12,2),
  venc_ini      numeric(14,3),
  venc_fin      numeric(14,3),
  vendedor      text,
  status        text default 'pendente',  -- pendente | vendido | aferido
  venda_id      uuid references oct_pdv_vendas(id),
  data_abast    timestamptz default now(),
  created_at    timestamptz default now()
);
create index if not exists idx_pdv_abast_empresa on oct_pdv_abastecimentos(empresa_id, status);
create index if not exists idx_pdv_abast_turno on oct_pdv_abastecimentos(turno_id);
