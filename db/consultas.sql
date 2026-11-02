/* ============================================================================
   BD VACINAS UBS  |  ETAPA 03  |  CONSULTAS SQL DA APLICAÇÃO
   As 10 perguntas do minimundo (seção 1.3) e as consultas 11 a 14 (anti join,
   full outer join e subconsultas), com o mesmo SQL de ConsultaDao.java.
   Nas consultas 3 e 6, ajuste o SET antes de executar.
   ============================================================================ */

USE bd_vacinas_ubs;

/* ---------------------------------------------------------------------------
   Consulta 1: Doses atrasadas por UBS
   Pergunta: Quais pacientes estão com doses atrasadas (data prevista vencida e status pendente), por UBS?
   Recursos: INNER JOIN (4 tabelas), WHERE, ORDER BY, DATEDIFF
   --------------------------------------------------------------------------- */
SELECT u.nome AS ubs, p.nome AS paciente, v.nome AS vacina,
       r.numero_dose AS dose, r.data_prevista,
       DATEDIFF(CURDATE(), r.data_prevista) AS dias_de_atraso
  FROM Registro_Dose r
  JOIN Paciente p ON p.cns = r.cns
  JOIN UBS u      ON u.cnes = p.cnes
  JOIN Vacina v   ON v.codigo_vacina = r.codigo_vacina
 WHERE r.status = 'PENDENTE'
   AND r.data_prevista < CURDATE()
 ORDER BY u.nome, dias_de_atraso DESC;

/* ---------------------------------------------------------------------------
   Consulta 2: Cobertura vacinal por vacina e UBS
   Pergunta: Qual a cobertura vacinal (percentual de pacientes com o esquema completo) por vacina e por UBS? Considera as doses já devidas até hoje (aplicadas ou com data prevista vencida); doses futuras não contam contra o paciente.
   Recursos: Subconsulta na cláusula FROM com HAVING, agregação (SUM, COUNT), GROUP BY, JOIN, percentual
   --------------------------------------------------------------------------- */
SELECT v.nome AS vacina, u.nome AS ubs,
       COUNT(*) AS pacientes_com_doses_devidas,
       SUM(t.completo) AS esquema_completo,
       ROUND(100 * SUM(t.completo) / COUNT(*), 1) AS cobertura_pct
  FROM (SELECT r.cns, r.codigo_vacina,
               (SUM(r.status <> 'APLICADA' AND r.data_prevista <= CURDATE()) = 0) AS completo
          FROM Registro_Dose r
         GROUP BY r.cns, r.codigo_vacina
        HAVING SUM(r.status = 'APLICADA' OR r.data_prevista <= CURDATE()) > 0) t
  JOIN Paciente p ON p.cns = t.cns
  JOIN UBS u      ON u.cnes = p.cnes
  JOIN Vacina v   ON v.codigo_vacina = t.codigo_vacina
 GROUP BY v.codigo_vacina, v.nome, u.cnes, u.nome
 ORDER BY v.nome, u.nome;

/* ---------------------------------------------------------------------------
   Consulta 3: Carteira de vacinação de um paciente
   Pergunta: Qual a carteira de vacinação completa de um paciente?
   Recursos: LEFT JOIN (doses pendentes não têm lote/profissional/UBS), parâmetro, ORDER BY
   --------------------------------------------------------------------------- */
SET @cns = '107939763812637';
SELECT v.nome AS vacina, r.numero_dose AS dose, r.status,
       r.data_prevista, r.data_aplicacao,
       l.numero_lote AS lote, l.fabricante,
       pr.nome AS profissional, u.nome AS ubs_aplicacao, r.local_anatomico
  FROM Registro_Dose r
  JOIN Vacina v             ON v.codigo_vacina = r.codigo_vacina
  LEFT JOIN Lote l          ON l.id_lote = r.id_lote
  LEFT JOIN Profissional pr ON pr.id_profissional = r.id_profissional
  LEFT JOIN UBS u           ON u.cnes = r.cnes
 WHERE r.cns = @cns
 ORDER BY v.nome, r.numero_dose;

/* ---------------------------------------------------------------------------
   Consulta 4: Lotes vencidos ou a vencer em 30 dias
   Pergunta: Quais lotes estão vencidos ou vencem em 30 dias, e quanto resta em cada UBS?
   Recursos: JOIN (4 tabelas), CASE, DATE_ADD, WHERE com filtro de saldo
   --------------------------------------------------------------------------- */
SELECT l.numero_lote AS lote, v.nome AS vacina, l.data_validade,
       CASE WHEN l.data_validade < CURDATE() THEN 'VENCIDO'
            ELSE 'VENCE EM ATÉ 30 DIAS' END AS situacao,
       u.nome AS ubs, e.quantidade_disponivel AS saldo
  FROM Lote l
  JOIN Vacina v      ON v.codigo_vacina = l.codigo_vacina
  JOIN Estoque_UBS e ON e.id_lote = l.id_lote
  JOIN UBS u         ON u.cnes = e.cnes
 WHERE l.data_validade <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
   AND e.quantidade_disponivel > 0
 ORDER BY l.data_validade, u.nome;

/* ---------------------------------------------------------------------------
   Consulta 5: Estoque atual por vacina e UBS
   Pergunta: Qual o estoque atual de cada vacina em cada UBS (só lotes dentro da validade)?
   Recursos: JOIN (4 tabelas), SUM, GROUP BY, HAVING
   --------------------------------------------------------------------------- */
SELECT v.nome AS vacina, u.nome AS ubs,
       SUM(e.quantidade_disponivel) AS doses_disponiveis
  FROM Estoque_UBS e
  JOIN Lote l   ON l.id_lote = e.id_lote
  JOIN Vacina v ON v.codigo_vacina = l.codigo_vacina
  JOIN UBS u    ON u.cnes = e.cnes
 WHERE l.data_validade >= CURDATE()
 GROUP BY v.codigo_vacina, v.nome, u.cnes, u.nome
HAVING SUM(e.quantidade_disponivel) > 0
 ORDER BY v.nome, u.nome;

/* ---------------------------------------------------------------------------
   Consulta 6: Rastreabilidade de um lote
   Pergunta: Quais pacientes receberam doses de um determinado lote (do fabricante até o paciente)?
   Recursos: JOIN (5 tabelas), parâmetro, ORDER BY
   --------------------------------------------------------------------------- */
SET @id_lote = 1;                -- troque pelo id do lote desejado
SELECT l.fabricante, l.numero_lote AS lote, v.nome AS vacina,
       p.nome AS paciente, p.cns, r.data_aplicacao,
       pr.nome AS profissional, u.nome AS ubs_aplicacao
  FROM Lote l
  JOIN Vacina v         ON v.codigo_vacina = l.codigo_vacina
  JOIN Registro_Dose r  ON r.id_lote = l.id_lote
  JOIN Paciente p       ON p.cns = r.cns
  JOIN Profissional pr  ON pr.id_profissional = r.id_profissional
  JOIN UBS u            ON u.cnes = r.cnes
 WHERE l.id_lote = @id_lote
 ORDER BY r.data_aplicacao, p.nome;

/* ---------------------------------------------------------------------------
   Consulta 7: Doses aplicadas por profissional por mês
   Pergunta: Quantas doses cada profissional aplicou por mês?
   Recursos: JOIN, DATE_FORMAT, COUNT, GROUP BY com duas colunas
   --------------------------------------------------------------------------- */
SELECT DATE_FORMAT(r.data_aplicacao, '%Y-%m') AS mes,
       pr.nome AS profissional, pr.cargo,
       COUNT(*) AS doses_aplicadas
  FROM Registro_Dose r
  JOIN Profissional pr ON pr.id_profissional = r.id_profissional
 WHERE r.status = 'APLICADA'
 GROUP BY mes, pr.id_profissional, pr.nome, pr.cargo
 ORDER BY mes DESC, doses_aplicadas DESC;

/* ---------------------------------------------------------------------------
   Consulta 8: Crianças menores de 5 anos com esquema incompleto
   Pergunta: Quais crianças menores de 5 anos têm esquema incompleto, e quem são seus responsáveis?
   Recursos: Auto-relacionamento (LEFT JOIN Paciente com Paciente), subconsulta correlacionada no SELECT, GROUP_CONCAT, TIMESTAMPDIFF
   --------------------------------------------------------------------------- */
SELECT p.nome AS crianca,
       TIMESTAMPDIFF(YEAR, p.data_nascimento, CURDATE()) AS idade_anos,
       resp.nome AS responsavel,
       (SELECT GROUP_CONCAT(t.telefone SEPARATOR ' / ')
          FROM Paciente_Telefone t
         WHERE t.cns = resp.cns) AS telefones_do_responsavel,
       COUNT(*) AS doses_nao_aplicadas
  FROM Paciente p
  JOIN Registro_Dose r     ON r.cns = p.cns
  LEFT JOIN Paciente resp  ON resp.cns = p.cns_responsavel
 WHERE p.data_nascimento > DATE_SUB(CURDATE(), INTERVAL 5 YEAR)
   AND r.status = 'PENDENTE'
 GROUP BY p.cns, p.nome, p.data_nascimento, resp.cns, resp.nome
 ORDER BY doses_nao_aplicadas DESC, p.nome;

/* ---------------------------------------------------------------------------
   Consulta 9: Profissionais supervisionados por coordenador
   Pergunta: Quais profissionais são supervisionados por cada coordenador?
   Recursos: Auto-relacionamento (JOIN Profissional com Profissional), JOIN com UBS
   --------------------------------------------------------------------------- */
SELECT sup.nome AS coordenador, sub.nome AS supervisionado,
       sub.cargo, u.nome AS ubs_do_supervisionado
  FROM Profissional sup
  JOIN Profissional sub ON sub.id_supervisor = sup.id_profissional
  JOIN UBS u            ON u.cnes = sub.cnes
 ORDER BY sup.nome, sub.nome;

/* ---------------------------------------------------------------------------
   Consulta 10: Doses aplicadas por faixa etária e sexo
   Pergunta: Quantas doses foram aplicadas por faixa etária (na data da aplicação) e sexo?
   Recursos: Subconsulta na cláusula FROM com CASE, TIMESTAMPDIFF, GROUP BY, COUNT
   --------------------------------------------------------------------------- */
SELECT t.faixa_etaria, t.sexo, COUNT(*) AS doses_aplicadas
  FROM (SELECT p.sexo,
               CASE
                 WHEN TIMESTAMPDIFF(MONTH, p.data_nascimento, r.data_aplicacao) < 12 THEN 1
                 WHEN TIMESTAMPDIFF(MONTH, p.data_nascimento, r.data_aplicacao) < 60 THEN 2
                 WHEN TIMESTAMPDIFF(YEAR,  p.data_nascimento, r.data_aplicacao) < 12 THEN 3
                 WHEN TIMESTAMPDIFF(YEAR,  p.data_nascimento, r.data_aplicacao) < 18 THEN 4
                 WHEN TIMESTAMPDIFF(YEAR,  p.data_nascimento, r.data_aplicacao) < 60 THEN 5
                 ELSE 6 END AS ordem,
               CASE
                 WHEN TIMESTAMPDIFF(MONTH, p.data_nascimento, r.data_aplicacao) < 12 THEN '0 a 11 meses'
                 WHEN TIMESTAMPDIFF(MONTH, p.data_nascimento, r.data_aplicacao) < 60 THEN '1 a 4 anos'
                 WHEN TIMESTAMPDIFF(YEAR,  p.data_nascimento, r.data_aplicacao) < 12 THEN '5 a 11 anos'
                 WHEN TIMESTAMPDIFF(YEAR,  p.data_nascimento, r.data_aplicacao) < 18 THEN '12 a 17 anos'
                 WHEN TIMESTAMPDIFF(YEAR,  p.data_nascimento, r.data_aplicacao) < 60 THEN '18 a 59 anos'
                 ELSE '60 anos ou mais' END AS faixa_etaria
          FROM Registro_Dose r
          JOIN Paciente p ON p.cns = r.cns
         WHERE r.status = 'APLICADA') t
 GROUP BY t.ordem, t.faixa_etaria, t.sexo
 ORDER BY t.ordem, t.sexo;


/* ============================================================================
   CONSULTAS 11 A 14: anti join, full outer join e subconsultas
   ============================================================================ */

/* ---------------------------------------------------------------------------
   Consulta 11: Doses pendentes sem estoque na UBS do paciente
   Pergunta: Quais doses pendentes não podem ser aplicadas na UBS de referência do paciente, por falta de estoque válido da vacina?
   Recursos: ANTI JOIN (LEFT JOIN ... WHERE chave IS NULL), junção aninhada no LEFT JOIN
   Como funciona: o LEFT JOIN procura, para cada dose pendente, um lote da mesma
   vacina, dentro da validade e com saldo, na UBS do paciente. Quando não acha,
   as colunas de Estoque_UBS vêm nulas, e o WHERE e.id_lote IS NULL fica só com
   essas linhas: as doses que "não casaram" com nenhum estoque.
   --------------------------------------------------------------------------- */
SELECT u.nome AS ubs, p.nome AS paciente, v.nome AS vacina,
       r.numero_dose AS dose, r.data_prevista
  FROM Registro_Dose r
  JOIN Paciente p ON p.cns = r.cns
  JOIN UBS u      ON u.cnes = p.cnes
  JOIN Vacina v   ON v.codigo_vacina = r.codigo_vacina
  LEFT JOIN (Estoque_UBS e
             JOIN Lote l ON l.id_lote = e.id_lote
                        AND l.data_validade >= CURDATE())
         ON e.cnes = p.cnes
        AND l.codigo_vacina = r.codigo_vacina
        AND e.quantidade_disponivel > 0
 WHERE r.status = 'PENDENTE'
   AND e.id_lote IS NULL
 ORDER BY u.nome, p.nome, v.nome, r.numero_dose;

/* ---------------------------------------------------------------------------
   Consulta 12: Estoque válido x doses aplicadas, por UBS e vacina
   Pergunta: Para cada UBS e vacina, quanto há em estoque válido e quantas doses já foram aplicadas, incluindo as combinações que só têm um dos dois?
   Recursos: FULL OUTER JOIN (emulado com LEFT JOIN UNION ALL RIGHT JOIN), CTE (WITH), COALESCE, CASE
   Como funciona: o MySQL não tem FULL OUTER JOIN. A emulação padrão é:
     A LEFT JOIN B                       -> tudo de A, com ou sem par em B
     UNION ALL
     A RIGHT JOIN B WHERE A.chave IS NULL -> o que só existe em B
   Assim nenhuma linha se repete e nenhuma se perde dos dois lados.
   --------------------------------------------------------------------------- */
WITH estoque AS (
    SELECT e.cnes, l.codigo_vacina, SUM(e.quantidade_disponivel) AS estoque_valido
      FROM Estoque_UBS e
      JOIN Lote l ON l.id_lote = e.id_lote
     WHERE l.data_validade >= CURDATE()
     GROUP BY e.cnes, l.codigo_vacina
), aplicadas AS (
    SELECT r.cnes, r.codigo_vacina, COUNT(*) AS doses_aplicadas
      FROM Registro_Dose r
     WHERE r.status = 'APLICADA'
     GROUP BY r.cnes, r.codigo_vacina
)
SELECT u.nome AS ubs, v.nome AS vacina,
       COALESCE(f.estoque_valido, 0)  AS estoque_valido,
       COALESCE(f.doses_aplicadas, 0) AS doses_aplicadas,
       CASE WHEN f.doses_aplicadas IS NULL THEN 'SÓ ESTOQUE'
            WHEN f.estoque_valido  IS NULL THEN 'SÓ APLICAÇÕES'
            ELSE 'ESTOQUE E APLICAÇÕES' END AS situacao
  FROM (SELECT es.cnes, es.codigo_vacina, es.estoque_valido, ap.doses_aplicadas
          FROM estoque es
          LEFT JOIN aplicadas ap ON ap.cnes = es.cnes
                                AND ap.codigo_vacina = es.codigo_vacina
        UNION ALL
        SELECT ap.cnes, ap.codigo_vacina, es.estoque_valido, ap.doses_aplicadas
          FROM estoque es
         RIGHT JOIN aplicadas ap ON ap.cnes = es.cnes
                                AND ap.codigo_vacina = es.codigo_vacina
         WHERE es.cnes IS NULL) f
  JOIN UBS u    ON u.cnes = f.cnes
  JOIN Vacina v ON v.codigo_vacina = f.codigo_vacina
 ORDER BY u.nome, v.nome;

/* ---------------------------------------------------------------------------
   Consulta 13: UBS que aplicaram mais doses que a média
   Pergunta: Quais UBS aplicaram mais doses do que a média de doses aplicadas por UBS?
   Recursos: Subconsulta no HAVING com subconsulta aninhada no FROM (média de contagens), subconsulta escalar no SELECT
   Como funciona: a subconsulta interna conta as doses de cada UBS; a externa
   tira a média dessas contagens. O HAVING compara o total de cada UBS com ela.
   --------------------------------------------------------------------------- */
SELECT u.nome AS ubs, COUNT(*) AS doses_aplicadas,
       (SELECT ROUND(AVG(m.qtd), 1)
          FROM (SELECT COUNT(*) AS qtd
                  FROM Registro_Dose
                 WHERE status = 'APLICADA'
                 GROUP BY cnes) m) AS media_por_ubs
  FROM Registro_Dose r
  JOIN UBS u ON u.cnes = r.cnes
 WHERE r.status = 'APLICADA'
 GROUP BY u.cnes, u.nome
HAVING COUNT(*) > (SELECT AVG(m.qtd)
                     FROM (SELECT COUNT(*) AS qtd
                             FROM Registro_Dose
                            WHERE status = 'APLICADA'
                            GROUP BY cnes) m)
 ORDER BY doses_aplicadas DESC;

/* ---------------------------------------------------------------------------
   Consulta 14: Doses atrasadas que já podem ser aplicadas
   Pergunta: Quais doses atrasadas têm estoque válido da vacina na UBS de referência do paciente (busca ativa imediata)?
   Recursos: Subconsulta correlacionada com EXISTS no WHERE, subconsulta escalar correlacionada no SELECT
   Como funciona: para cada dose atrasada, o EXISTS verifica se a UBS do
   paciente tem algum lote da vacina dentro da validade e com saldo. A
   subconsulta do SELECT soma esse saldo. É o complemento da consulta 11.
   --------------------------------------------------------------------------- */
SELECT u.nome AS ubs, p.nome AS paciente, v.nome AS vacina,
       r.numero_dose AS dose, r.data_prevista,
       DATEDIFF(CURDATE(), r.data_prevista) AS dias_de_atraso,
       (SELECT SUM(e.quantidade_disponivel)
          FROM Estoque_UBS e
          JOIN Lote l ON l.id_lote = e.id_lote
         WHERE e.cnes = p.cnes
           AND l.codigo_vacina = r.codigo_vacina
           AND l.data_validade >= CURDATE()) AS doses_em_estoque
  FROM Registro_Dose r
  JOIN Paciente p ON p.cns = r.cns
  JOIN UBS u      ON u.cnes = p.cnes
  JOIN Vacina v   ON v.codigo_vacina = r.codigo_vacina
 WHERE r.status = 'PENDENTE'
   AND r.data_prevista < CURDATE()
   AND EXISTS (SELECT 1
                 FROM Estoque_UBS e
                 JOIN Lote l ON l.id_lote = e.id_lote
                WHERE e.cnes = p.cnes
                  AND l.codigo_vacina = r.codigo_vacina
                  AND l.data_validade >= CURDATE()
                  AND e.quantidade_disponivel > 0)
 ORDER BY u.nome, dias_de_atraso DESC;
