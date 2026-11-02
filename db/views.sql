USE bd_vacinas_ubs;

CREATE OR REPLACE VIEW vw_carteira_vacinacao AS
SELECT p.cns,
       p.nome                                              AS paciente,
       p.data_nascimento,
       TIMESTAMPDIFF(YEAR, p.data_nascimento, CURDATE())   AS idade_anos,
       p.sexo,
       ref.cnes                                            AS cnes_referencia,
       ref.nome                                            AS ubs_referencia,
       v.codigo_vacina,
       v.nome                                              AS vacina,
       r.numero_dose                                       AS dose,
       de.idade_recomendada_meses,
       r.data_prevista,
       r.data_aplicacao,
       r.status,
       CASE WHEN r.status = 'PENDENTE' AND r.data_prevista < CURDATE() THEN 'ATRASADA'
            ELSE r.status END                              AS situacao,
       CASE WHEN r.status = 'PENDENTE' AND r.data_prevista < CURDATE()
            THEN DATEDIFF(CURDATE(), r.data_prevista) END  AS dias_de_atraso,
       l.numero_lote                                       AS lote,
       l.fabricante,
       pr.nome                                             AS profissional,
       pr.cargo                                            AS cargo_profissional,
       apl.nome                                            AS ubs_aplicacao,
       r.local_anatomico
  FROM Registro_Dose r
  JOIN Paciente p          ON p.cns = r.cns
  JOIN UBS ref             ON ref.cnes = p.cnes
  JOIN Vacina v            ON v.codigo_vacina = r.codigo_vacina
  JOIN Dose_Esquema de     ON de.codigo_vacina = r.codigo_vacina
                          AND de.numero_dose   = r.numero_dose
  LEFT JOIN Lote l         ON l.id_lote = r.id_lote
  LEFT JOIN Profissional pr ON pr.id_profissional = r.id_profissional
  LEFT JOIN UBS apl        ON apl.cnes = r.cnes;


/* ---------------------------------------------------------------------------
   VIEW 2: vw_posicao_estoque
   ---------------------------------------------------------------------------
   O QUE É: a posição do estoque de cada lote em cada UBS, com a situação da
   validade e quanto daquele lote a UBS já aplicou.

   JUSTIFICATIVA SEMÂNTICA
   - No domínio, a vacina só pode ser aplicada se houver lote DENTRO DA
     VALIDADE e COM SALDO na UBS (regra 4: lote vencido não pode ser usado).
     Estoque_UBS sozinha só tem códigos (cnes, id_lote) e uma quantidade; para
     o enfermeiro que coordena a sala decidir o que aplicar primeiro, o que
     descartar e o que pedir, ele precisa ver a vacina, o fabricante, a
     validade e a UBS juntos.
   - A visão fixa a classificação de validade usada em todo o sistema:
       VENCIDO           -> data_validade < hoje (deve ser descartado)
       VENCE EM 30 DIAS  -> deve ser usado primeiro (fila de prioridade)
       VÁLIDO            -> pode ser aplicado normalmente
     Como depende de hoje, é calculada a cada leitura.
   - Liga o estoque ao consumo: o LEFT JOIN com as doses aplicadas daquele
     lote naquela UBS mostra a saída real, e lotes que nunca foram usados
     aparecem com 0 (com INNER JOIN eles sumiriam, e são justamente os que
     correm mais risco de vencer parados).

   JOINS (4): Lote, Vacina, UBS (INNER) e o consumo agregado de Registro_Dose (LEFT)
   USO: consultas 4, 5, 11, 12 e 14 e a aba Estoque usam estas mesmas regras.
   --------------------------------------------------------------------------- */
CREATE OR REPLACE VIEW vw_posicao_estoque AS
SELECT u.cnes,
       u.nome                                         AS ubs,
       v.codigo_vacina,
       v.nome                                         AS vacina,
       l.id_lote,
       l.numero_lote                                  AS lote,
       l.fabricante,
       l.data_validade,
       DATEDIFF(l.data_validade, CURDATE())           AS dias_para_vencer,
       CASE WHEN l.data_validade < CURDATE() THEN 'VENCIDO'
            WHEN l.data_validade <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'VENCE EM 30 DIAS'
            ELSE 'VÁLIDO' END                         AS situacao_validade,
       e.quantidade_disponivel                        AS saldo,
       COALESCE(c.doses_aplicadas, 0)                 AS doses_aplicadas_na_ubs,
       c.ultima_aplicacao,
       e.data_atualizacao
  FROM Estoque_UBS e
  JOIN Lote l    ON l.id_lote = e.id_lote
  JOIN Vacina v  ON v.codigo_vacina = l.codigo_vacina
  JOIN UBS u     ON u.cnes = e.cnes
  LEFT JOIN (SELECT r.cnes, r.id_lote,
                    COUNT(*)              AS doses_aplicadas,
                    MAX(r.data_aplicacao) AS ultima_aplicacao
               FROM Registro_Dose r
              WHERE r.status = 'APLICADA'
              GROUP BY r.cnes, r.id_lote) c
         ON c.cnes = e.cnes
        AND c.id_lote = e.id_lote;



SHOW FULL TABLES WHERE Table_type = 'VIEW';

SELECT vacina, dose, situacao, data_prevista, data_aplicacao, lote, profissional, ubs_aplicacao
  FROM vw_carteira_vacinacao
 WHERE cns = '107939763812637'
 ORDER BY vacina, dose;

SELECT ubs_referencia, paciente, vacina, dose, data_prevista, dias_de_atraso
  FROM vw_carteira_vacinacao
 WHERE situacao = 'ATRASADA'
 ORDER BY ubs_referencia, dias_de_atraso DESC;

SELECT situacao, COUNT(*) AS doses
  FROM vw_carteira_vacinacao
 GROUP BY situacao
 ORDER BY doses DESC;

SELECT lote, vacina, data_validade, situacao_validade, ubs, saldo
  FROM vw_posicao_estoque
 WHERE situacao_validade <> 'VÁLIDO'
   AND saldo > 0
 ORDER BY data_validade, ubs;

SELECT ubs, vacina, lote, saldo, data_validade, dias_para_vencer
  FROM vw_posicao_estoque
 WHERE saldo > 0
   AND doses_aplicadas_na_ubs = 0
 ORDER BY dias_para_vencer;