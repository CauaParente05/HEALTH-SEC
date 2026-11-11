USE bd_vacinas_ubs;

DROP FUNCTION IF EXISTS fn_situacao_dose;
DROP FUNCTION IF EXISTS fn_saldo_aplicavel;

DELIMITER $$

CREATE FUNCTION fn_situacao_dose(p_status        VARCHAR(10),
                                 p_data_prevista DATE)
RETURNS VARCHAR(10)
NOT DETERMINISTIC
NO SQL
BEGIN
    IF p_status IS NULL OR p_data_prevista IS NULL THEN
        RETURN NULL;
    ELSEIF p_status <> 'PENDENTE' THEN
        RETURN p_status;
    ELSEIF p_data_prevista < CURDATE() THEN
        RETURN 'ATRASADA';
    ELSE
        RETURN 'PENDENTE';
    END IF;
END$$

CREATE FUNCTION fn_saldo_aplicavel(p_cnes          CHAR(7),
                                   p_codigo_vacina INT)
RETURNS INT
NOT DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_saldo INT;

    SELECT COALESCE(SUM(e.quantidade_disponivel), 0)
      INTO v_saldo
      FROM Estoque_UBS e
      JOIN Lote l ON l.id_lote = e.id_lote
     WHERE e.cnes          = p_cnes
       AND l.codigo_vacina = p_codigo_vacina
       AND l.data_validade >= CURDATE();

    RETURN v_saldo;
END$$

DELIMITER ;

SHOW FUNCTION STATUS WHERE Db = 'bd_vacinas_ubs';

SELECT fn_situacao_dose('APLICADA',  '2020-01-01') AS aplicada,
       fn_situacao_dose('CANCELADA', '2020-01-01') AS cancelada,
       fn_situacao_dose('PENDENTE',  DATE_SUB(CURDATE(), INTERVAL 1 DAY)) AS atrasada,
       fn_situacao_dose('PENDENTE',  DATE_ADD(CURDATE(), INTERVAL 1 DAY)) AS pendente,
       fn_situacao_dose(NULL,        CURDATE()) AS nula;

SELECT fn_situacao_dose(status, data_prevista) AS situacao, COUNT(*) AS doses
  FROM Registro_Dose
 GROUP BY situacao
 ORDER BY doses DESC;

SELECT COUNT(*) AS divergencias
  FROM vw_carteira_vacinacao
 WHERE situacao <> fn_situacao_dose(status, data_prevista);

SELECT u.nome AS ubs, v.nome AS vacina,
       fn_saldo_aplicavel(u.cnes, v.codigo_vacina) AS saldo_aplicavel
  FROM UBS u
 CROSS JOIN Vacina v
HAVING saldo_aplicavel > 0
 ORDER BY ubs, vacina;

SELECT p.cnes, p.codigo_vacina, SUM(p.saldo) AS saldo_view,
       fn_saldo_aplicavel(p.cnes, p.codigo_vacina) AS saldo_funcao
  FROM vw_posicao_estoque p
 WHERE p.situacao_validade <> 'VENCIDO'
 GROUP BY p.cnes, p.codigo_vacina
HAVING saldo_view <> saldo_funcao;

SELECT u.nome AS ubs, v.nome AS vacina,
       COUNT(*) AS doses_atrasadas,
       fn_saldo_aplicavel(u.cnes, v.codigo_vacina) AS saldo_aplicavel
  FROM Registro_Dose r
  JOIN Paciente p ON p.cns = r.cns
  JOIN UBS u      ON u.cnes = p.cnes
  JOIN Vacina v   ON v.codigo_vacina = r.codigo_vacina
 WHERE fn_situacao_dose(r.status, r.data_prevista) = 'ATRASADA'
 GROUP BY u.cnes, u.nome, v.codigo_vacina, v.nome
HAVING saldo_aplicavel < doses_atrasadas
 ORDER BY doses_atrasadas DESC, ubs;
