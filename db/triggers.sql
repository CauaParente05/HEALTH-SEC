/* ============================================================================
   BD VACINAS UBS  |  ETAPA 05  |  SCRIPT 3 DE 3: TRIGGERS
   ----------------------------------------------------------------------------
   Projeto     : Banco de Dados para um sistema de gerenciamento de vacinas
                 de uma UBS (sala de vacina)
   SGBD alvo   : MySQL 8.0+
   ============================================================================ */

USE bd_vacinas_ubs;

/* ---------------------------------------------------------------------------- 
   1. TABELA DE LOG E TRIGGER DE AUDITORIA (Log de atualizações)
   Justificativa semântica: Rastreabilidade. Em um ambiente SUS, alterar o 
   status de uma dose (ex: de PENDENTE para APLICADA ou CANCELADA) é um evento
   crítico. O trigger registra automaticamente o histórico da mudança, quem a 
   fez e quando, protegendo a integridade do prontuário do paciente.
   ---------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS Log_Status_Dose (
    id_log          INT AUTO_INCREMENT PRIMARY KEY,
    cns_paciente    CHAR(15)     NOT NULL,
    codigo_vacina   INT          NOT NULL,
    numero_dose     SMALLINT     NOT NULL,
    status_anterior VARCHAR(10)  NOT NULL,
    status_novo     VARCHAR(10)  NOT NULL,
    data_alteracao  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    usuario_banco   VARCHAR(50)  DEFAULT (CURRENT_USER())
) ENGINE=InnoDB;

DROP TRIGGER IF EXISTS trg_auditoria_status_dose;

DELIMITER $$

CREATE TRIGGER trg_auditoria_status_dose
AFTER UPDATE ON Registro_Dose
FOR EACH ROW
BEGIN
    IF (OLD.status <> NEW.status) THEN
        INSERT INTO Log_Status_Dose (
            cns_paciente, 
            codigo_vacina, 
            numero_dose, 
            status_anterior, 
            status_novo
        ) VALUES (
            NEW.cns, 
            NEW.codigo_vacina, 
            NEW.numero_dose, 
            OLD.status, 
            NEW.status
        );
    END IF;
END$$

/* ---------------------------------------------------------------------------- 
   2. TRIGGER DE REGRA DE NEGÓCIO (Validação Semântica)
   Justificativa semântica: Barreira sanitária. Evita que o almoxarifado ou a
   coordenação da UBS cadastre no sistema um lote recebido que já chegou 
   vencido da central de distribuição, bloqueando o erro na raiz (inserção).
   ---------------------------------------------------------------------------- */
DROP TRIGGER IF EXISTS trg_bloqueia_lote_vencido_entrada$$

CREATE TRIGGER trg_bloqueia_lote_vencido_entrada
BEFORE INSERT ON Lote
FOR EACH ROW
BEGIN
    IF (NEW.data_validade < CURDATE()) THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Bloqueio de Segurança Sanitária: Não é permitido cadastrar um lote de vacina com data de validade já expirada.';
    END IF;
END$$

DELIMITER ;