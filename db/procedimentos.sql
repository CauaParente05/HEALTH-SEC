/* ============================================================================
   BD VACINAS UBS  |  ETAPA 05  |  SCRIPT 2 DE 3: PROCEDIMENTOS
   ----------------------------------------------------------------------------
   Projeto     : Banco de Dados para um sistema de gerenciamento de vacinas
                 de uma UBS (sala de vacina)
   SGBD alvo   : MySQL 8.0+
   ============================================================================ */

USE bd_vacinas_ubs;

DROP PROCEDURE IF EXISTS pr_registrar_aplicacao_dose;
DROP PROCEDURE IF EXISTS pr_baixa_estoque_fifo;

DELIMITER $$

/* ---------------------------------------------------------------------------- 
   1. PROCEDIMENTO DE ATUALIZAÇÃO DE DADOS
   ---------------------------------------------------------------------------- */
CREATE PROCEDURE pr_registrar_aplicacao_dose(
    IN p_cns CHAR(15),
    IN p_codigo_vacina INT,
    IN p_numero_dose SMALLINT,
    IN p_id_lote INT,
    IN p_id_profissional INT,
    IN p_cnes CHAR(7),
    IN p_local_anatomico VARCHAR(30)
)
BEGIN
    UPDATE Registro_Dose
       SET data_aplicacao = CURDATE(),
           status = 'APLICADA',
           local_anatomico = p_local_anatomico,
           id_lote = p_id_lote,
           id_profissional = p_id_profissional,
           cnes = p_cnes
     WHERE cns = p_cns
       AND codigo_vacina = p_codigo_vacina
       AND numero_dose = p_numero_dose
       AND status = 'PENDENTE';

    IF ROW_COUNT() > 0 THEN
        UPDATE Estoque_UBS
           SET quantidade_disponivel = quantidade_disponivel - 1,
               data_atualizacao = CURDATE()
         WHERE cnes = p_cnes
           AND id_lote = p_id_lote;
    END IF;
END$$


/* ---------------------------------------------------------------------------- 
   2. PROCEDIMENTO COM USO DE CURSOR (Obrigatório)
   Baixa de lote por validade (FIFO). Não pode ser feito com UPDATE simples, 
   pois a quantidade a abater pode ser fracionada em vários lotes diferentes.
   ---------------------------------------------------------------------------- */
CREATE PROCEDURE pr_baixa_estoque_fifo(
    IN p_cnes CHAR(7),
    IN p_codigo_vacina INT,
    IN p_qtd_baixar INT
)
BEGIN
    DECLARE v_id_lote INT;
    DECLARE v_qtd_disponivel INT;
    DECLARE v_qtd_restante INT DEFAULT p_qtd_baixar;
    DECLARE v_done INT DEFAULT 0;

    DECLARE cur_estoque CURSOR FOR 
        SELECT e.id_lote, e.quantidade_disponivel
          FROM Estoque_UBS e
          JOIN Lote l ON l.id_lote = e.id_lote
         WHERE e.cnes = p_cnes 
           AND l.codigo_vacina = p_codigo_vacina
           AND e.quantidade_disponivel > 0
         ORDER BY l.data_validade ASC;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

    OPEN cur_estoque;

    read_loop: LOOP
        FETCH cur_estoque INTO v_id_lote, v_qtd_disponivel;

        IF (v_done = 1 OR v_qtd_restante <= 0) THEN
            LEAVE read_loop;
        END IF;

        IF (v_qtd_disponivel <= v_qtd_restante) THEN
            UPDATE Estoque_UBS
               SET quantidade_disponivel = 0,
                   data_atualizacao = CURDATE()
             WHERE cnes = p_cnes 
               AND id_lote = v_id_lote;
            SET v_qtd_restante = v_qtd_restante - v_qtd_disponivel;
        ELSE
            UPDATE Estoque_UBS
               SET quantidade_disponivel = quantidade_disponivel - v_qtd_restante,
                   data_atualizacao = CURDATE()
             WHERE cnes = p_cnes 
               AND id_lote = v_id_lote;
            SET v_qtd_restante = 0;
        END IF;
    END LOOP;

    CLOSE cur_estoque;
END$$

DELIMITER ;