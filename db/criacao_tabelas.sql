/* ============================================================================
   BD VACINAS UBS  |  ETAPA 02  |  SCRIPT 1 DE 2: CRIAÇÃO DAS TABELAS
   ----------------------------------------------------------------------------
   Projeto     : Banco de Dados para um sistema de gerenciamento de vacinas
                 de uma UBS (sala de vacina)
   SGBD alvo   : MySQL 8.0.16 ou superior (necessário para CHECK aplicado)
   Versão      : 1.0
   Criado em   : 2026-09-20
   Base        : "BD Vacinas UBS — Minimundo, Decisões e Dicionário de Dados"
                 (esquema relacional com 12 tabelas)

   COMO EXECUTAR: de uma só vez, sem intervenção manual.
     mysql -u root -p < criacao_tabelas.sql
   (No PowerShell do Windows o "<" não funciona; use:
     cmd /c "mysql -u root -p --default-character-set=utf8mb4 < db\criacao_tabelas.sql")
   (No MySQL Workbench: abrir o arquivo e executar tudo. O script usa
   DELIMITER apenas na seção final, dos triggers.)

   ORGANIZAÇÃO
     0. Banco de dados e preparação
     1. Tabelas de entidades independentes  (UBS, Vacina)
     2. Tabelas que dependem de UBS         (telefones, Paciente, Profissional...)
     3. Tabelas que dependem de Vacina      (doenças-alvo, Dose_Esquema, Lote)
     4. Tabelas associativas                (Estoque_UBS, Registro_Dose)
     5. Triggers (regras que o CHECK do MySQL não consegue expressar)

   ADAPTAÇÕES POSTGRESQL -> MYSQL (todas justificadas)
     a) SEQUENCE / SERIAL  -> AUTO_INCREMENT.
     b) DEFAULT CURRENT_DATE (PostgreSQL): o MySQL só aceita default de DATA
        como expressão entre parênteses, DEFAULT (CURRENT_DATE), sintaxe que
        exige 8.0.13+ e que alguns editores/extensões marcam como erro. Para
        rodar em qualquer MySQL 8 e sem avisos, data_abertura (Prontuario) e
        data_atualizacao (Estoque_UBS) não têm mais DEFAULT: um trigger
        BEFORE INSERT (seção 5) grava a data de hoje quando ela não é informada.
        O efeito para quem insere é o mesmo do DEFAULT.
     c) BOOLEAN            -> BOOLEAN (sinônimo de TINYINT(1)).
     d) CHECK com data futura (data_nascimento, data_aplicacao <= hoje):
        o MySQL PROÍBE funções não determinísticas (CURDATE, NOW) dentro de
        CHECK (erro 3814). Essas duas validações foram movidas para triggers
        (seção 5), com o mesmo efeito.
     e) CHECK "não é o próprio paciente/supervisor": o MySQL PROÍBE usar em CHECK
        uma coluna que participa de FK com ação referencial CASCADE/SET NULL
        (erro 3823). Como cns_responsavel e id_supervisor usam ON DELETE
        SET NULL (exigido pelo projeto), essa checagem também virou trigger.
     f) Pelo mesmo motivo (3823), as FKs de Registro_Dose para UBS, Lote e
        Profissional NÃO usam CASCADE/SET NULL: essas colunas aparecem no
        CHECK de coerência da tabela, que é obrigatório.
   ============================================================================ */


/* ----------------------------------------------------------------------------
   0. BANCO DE DADOS E PREPARAÇÃO
   ---------------------------------------------------------------------------- */

CREATE DATABASE IF NOT EXISTS bd_vacinas_ubs
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE bd_vacinas_ubs;

-- Permite recriar o banco várias vezes: remove as tabelas na ordem inversa
-- das dependências (filhas antes das pais). Os triggers caem junto com as tabelas.
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS Registro_Dose;
DROP TABLE IF EXISTS Estoque_UBS;
DROP TABLE IF EXISTS Lote;
DROP TABLE IF EXISTS Dose_Esquema;
DROP TABLE IF EXISTS Vacina_Doenca_Alvo;
DROP TABLE IF EXISTS Vacina;
DROP TABLE IF EXISTS Profissional;
DROP TABLE IF EXISTS Prontuario;
DROP TABLE IF EXISTS Paciente_Telefone;
DROP TABLE IF EXISTS Paciente;
DROP TABLE IF EXISTS UBS_Telefone;
DROP TABLE IF EXISTS UBS;
SET FOREIGN_KEY_CHECKS = 1;


/* ----------------------------------------------------------------------------
   1. TABELAS DE ENTIDADES INDEPENDENTES
   ---------------------------------------------------------------------------- */

/* UBS -------------------------------------------------------------------------
   Unidade Básica de Saúde: onde os pacientes são cadastrados, os profissionais
   são lotados e os lotes ficam em estoque. Chave natural: código CNES oficial.
   O endereço composto foi decomposto em colunas (logradouro, numero, bairro, cep).
---------------------------------------------------------------------------- */
CREATE TABLE UBS (
    cnes        CHAR(7)      NOT NULL,
    nome        VARCHAR(100) NOT NULL,
    logradouro  VARCHAR(100) NOT NULL,
    numero      VARCHAR(10)  NULL,                 -- aceita 'S/N'
    bairro      VARCHAR(60)  NOT NULL,
    cep         CHAR(8)      NOT NULL,
    CONSTRAINT pk_ubs           PRIMARY KEY (cnes),
    CONSTRAINT ck_ubs_cnes      CHECK (cnes REGEXP '^[0-9]{7}$'),   -- 7 dígitos
    CONSTRAINT ck_ubs_cep       CHECK (cep  REGEXP '^[0-9]{8}$')    -- só dígitos
) ENGINE=InnoDB;

/* Vacina ----------------------------------------------------------------------
   Imunobiológico do calendário de vacinação. Chave substituta AUTO_INCREMENT.
   O atributo derivado total_doses NÃO é coluna: é COUNT(*) em Dose_Esquema.
---------------------------------------------------------------------------- */
CREATE TABLE Vacina (
    codigo_vacina     INT          NOT NULL AUTO_INCREMENT,
    nome              VARCHAR(80)  NOT NULL,
    via_administracao VARCHAR(20)  NOT NULL,
    CONSTRAINT pk_vacina      PRIMARY KEY (codigo_vacina),
    CONSTRAINT uq_vacina_nome UNIQUE (nome),
    CONSTRAINT ck_vacina_via  CHECK (via_administracao IN
        ('INTRAMUSCULAR', 'SUBCUTANEA', 'INTRADERMICA', 'ORAL'))
) ENGINE=InnoDB;


/* ----------------------------------------------------------------------------
   2. TABELAS QUE DEPENDEM DE UBS
   ---------------------------------------------------------------------------- */

/* UBS_Telefone ----------------------------------------------------------------
   Atributo multivalorado "telefone" de UBS (1ª forma normal). PK composta.
   ON DELETE CASCADE: apagar a UBS apaga seus telefones.
---------------------------------------------------------------------------- */
CREATE TABLE UBS_Telefone (
    cnes      CHAR(7)     NOT NULL,
    telefone  VARCHAR(11) NOT NULL,                -- DDD + número, só dígitos
    CONSTRAINT pk_ubs_telefone PRIMARY KEY (cnes, telefone),
    CONSTRAINT fk_ubstel_ubs   FOREIGN KEY (cnes) REFERENCES UBS (cnes)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT ck_ubstel_fone  CHECK (telefone REGEXP '^[0-9]{10,11}$')
) ENGINE=InnoDB;

/* Paciente --------------------------------------------------------------------
   Pessoa cadastrada em UMA UBS de referência (regra 1). Chave natural: CNS.
   - cns_responsavel: auto-relacionamento (0,1). Adultos não têm responsável.
     ON DELETE SET NULL: excluir o responsável não exclui o dependente.
   - cnes: ON UPDATE CASCADE, o novo código CNES da UBS se propaga.
   - idade é atributo derivado (regra 8): calculada por consulta, não armazenada.
   - "Data de nascimento não futura" e "não ser responsável de si mesmo":
     ver triggers (seção 5), pelos motivos d) e e) do cabeçalho.
---------------------------------------------------------------------------- */
CREATE TABLE Paciente (
    cns              CHAR(15)     NOT NULL,
    cpf              CHAR(11)     NULL,            -- opcional: crianças podem não ter
    nome             VARCHAR(100) NOT NULL,
    data_nascimento  DATE         NOT NULL,
    sexo             CHAR(1)      NOT NULL,
    nome_mae         VARCHAR(100) NOT NULL,
    logradouro       VARCHAR(100) NOT NULL,
    numero           VARCHAR(10)  NULL,
    bairro           VARCHAR(60)  NOT NULL,
    cep              CHAR(8)      NOT NULL,
    cnes             CHAR(7)      NOT NULL,
    cns_responsavel  CHAR(15)     NULL,
    CONSTRAINT pk_paciente      PRIMARY KEY (cns),
    CONSTRAINT uq_paciente_cpf  UNIQUE (cpf),      -- vários NULL são permitidos
    CONSTRAINT ck_paciente_cns  CHECK (cns REGEXP '^[0-9]{15}$'),
    CONSTRAINT ck_paciente_cpf  CHECK (cpf IS NULL OR cpf REGEXP '^[0-9]{11}$'),
    CONSTRAINT ck_paciente_sexo CHECK (sexo IN ('F', 'M')),
    CONSTRAINT ck_paciente_cep  CHECK (cep REGEXP '^[0-9]{8}$'),
    CONSTRAINT fk_paciente_ubs  FOREIGN KEY (cnes) REFERENCES UBS (cnes)
        ON UPDATE CASCADE,                          -- ON DELETE padrão: RESTRICT
    CONSTRAINT fk_paciente_resp FOREIGN KEY (cns_responsavel) REFERENCES Paciente (cns)
        ON DELETE SET NULL
) ENGINE=InnoDB;

/* Paciente_Telefone -----------------------------------------------------------
   Atributo multivalorado "telefone" de Paciente. PK composta.
---------------------------------------------------------------------------- */
CREATE TABLE Paciente_Telefone (
    cns       CHAR(15)    NOT NULL,
    telefone  VARCHAR(11) NOT NULL,
    CONSTRAINT pk_paciente_telefone PRIMARY KEY (cns, telefone),
    CONSTRAINT fk_pactel_paciente   FOREIGN KEY (cns) REFERENCES Paciente (cns)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT ck_pactel_fone       CHECK (telefone REGEXP '^[0-9]{10,11}$')
) ENGINE=InnoDB;

/* Prontuario ------------------------------------------------------------------
   Registro clínico único do paciente (relação 1:1, regra 1). A FK fica aqui, no
   lado dependente; UNIQUE + NOT NULL em cns garante "exatamente um" prontuário.
   Decisão adicional: ON DELETE CASCADE, pois o prontuário não existe sem o
   paciente (o documento não especifica a ação; esta é a coerente com o 1:1).
---------------------------------------------------------------------------- */
CREATE TABLE Prontuario (
    numero_prontuario  INT          NOT NULL AUTO_INCREMENT,
    cns                CHAR(15)     NOT NULL,
    data_abertura      DATE         NOT NULL,   -- padrão = hoje, via trigger trg_prontuario_bi
    observacoes        VARCHAR(500) NULL,
    CONSTRAINT pk_prontuario      PRIMARY KEY (numero_prontuario),
    CONSTRAINT uq_prontuario_cns  UNIQUE (cns),   -- um prontuário por paciente
    CONSTRAINT fk_prontuario_pac  FOREIGN KEY (cns) REFERENCES Paciente (cns)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

/* Profissional ----------------------------------------------------------------
   Supertipo da especialização TOTAL e DISJUNTA (regra 7), implementada em
   tabela única com o discriminador "cargo". As colunas específicas de cada
   subtipo aceitam NULL, e o CHECK ck_prof_subtipo garante a coerência:
     ENFERMEIRO          -> só coordena_sala_vacina pode ser preenchida
     MEDICO              -> só especialidade pode ser preenchida
     TECNICO_ENFERMAGEM  -> só data_ultima_capacitacao pode ser preenchida
   - id_supervisor: auto-relacionamento (0,1), ON DELETE SET NULL (regra 6:
     no máximo um supervisor). O CHECK "não supervisiona a si mesmo" está no
     trigger (seção 5).
   - cnes: lotação em uma única UBS (regra 6).
---------------------------------------------------------------------------- */
CREATE TABLE Profissional (
    id_profissional          INT          NOT NULL AUTO_INCREMENT,
    nome                     VARCHAR(100) NOT NULL,
    cargo                    VARCHAR(20)  NOT NULL,
    registro_conselho        VARCHAR(20)  NOT NULL,   -- COREN ou CRM
    cnes                     CHAR(7)      NOT NULL,
    id_supervisor            INT          NULL,
    coordena_sala_vacina     BOOLEAN      NULL,       -- subtipo Enfermeiro
    especialidade            VARCHAR(60)  NULL,       -- subtipo Médico
    data_ultima_capacitacao  DATE         NULL,       -- subtipo Técnico de Enfermagem
    CONSTRAINT pk_profissional       PRIMARY KEY (id_profissional),
    CONSTRAINT uq_prof_registro      UNIQUE (registro_conselho),
    CONSTRAINT ck_prof_cargo         CHECK (cargo IN
        ('ENFERMEIRO', 'TECNICO_ENFERMAGEM', 'MEDICO')),
    -- Coerência do discriminador: colunas de outros subtipos devem ser NULL.
    CONSTRAINT ck_prof_subtipo       CHECK (
           (cargo = 'ENFERMEIRO'         AND especialidade IS NULL
                                         AND data_ultima_capacitacao IS NULL)
        OR (cargo = 'MEDICO'             AND coordena_sala_vacina IS NULL
                                         AND data_ultima_capacitacao IS NULL)
        OR (cargo = 'TECNICO_ENFERMAGEM' AND coordena_sala_vacina IS NULL
                                         AND especialidade IS NULL)
    ),
    CONSTRAINT fk_prof_ubs           FOREIGN KEY (cnes) REFERENCES UBS (cnes)
        ON UPDATE CASCADE,
    CONSTRAINT fk_prof_supervisor    FOREIGN KEY (id_supervisor)
        REFERENCES Profissional (id_profissional)
        ON DELETE SET NULL
) ENGINE=InnoDB;


/* ----------------------------------------------------------------------------
   3. TABELAS QUE DEPENDEM DE VACINA
   ---------------------------------------------------------------------------- */

/* Vacina_Doenca_Alvo ----------------------------------------------------------
   Atributo multivalorado "doenca_alvo" de Vacina. PK composta.
---------------------------------------------------------------------------- */
CREATE TABLE Vacina_Doenca_Alvo (
    codigo_vacina  INT         NOT NULL,
    doenca_alvo    VARCHAR(60) NOT NULL,
    CONSTRAINT pk_vacina_doenca PRIMARY KEY (codigo_vacina, doenca_alvo),
    CONSTRAINT fk_vacdoenca_vac FOREIGN KEY (codigo_vacina) REFERENCES Vacina (codigo_vacina)
        ON DELETE CASCADE
) ENGINE=InnoDB;

/* Dose_Esquema (ENTIDADE FRACA) -----------------------------------------------
   Cada dose prevista no esquema de uma vacina. Só existe dentro de uma vacina e
   "dose 1" se repete em várias vacinas, por isso a PK é composta
   (codigo_vacina, numero_dose), e codigo_vacina também é FK para Vacina.
   ON DELETE CASCADE: excluir a vacina exclui as doses do seu esquema.
---------------------------------------------------------------------------- */
CREATE TABLE Dose_Esquema (
    codigo_vacina            INT      NOT NULL,
    numero_dose              SMALLINT NOT NULL,
    idade_recomendada_meses  INT      NOT NULL,
    intervalo_minimo_dias    INT      NOT NULL DEFAULT 0,  -- dias desde a dose anterior
    CONSTRAINT pk_dose_esquema  PRIMARY KEY (codigo_vacina, numero_dose),
    CONSTRAINT fk_dose_vacina   FOREIGN KEY (codigo_vacina) REFERENCES Vacina (codigo_vacina)
        ON DELETE CASCADE,
    CONSTRAINT ck_dose_numero   CHECK (numero_dose > 0),
    CONSTRAINT ck_dose_idade    CHECK (idade_recomendada_meses >= 0),
    CONSTRAINT ck_dose_interv   CHECK (intervalo_minimo_dias >= 0)
) ENGINE=InnoDB;

/* Lote ------------------------------------------------------------------------
   Remessa de UMA vacina, de um fabricante (regra 3).
   - UNIQUE (fabricante, numero_lote): o número impresso só é único por fabricante.
   - UNIQUE (id_lote, codigo_vacina): redundante como unicidade (id_lote já é PK),
     mas necessário para que Registro_Dose possa ter FK composta
     (id_lote, codigo_vacina) -> Lote. Assim o PRÓPRIO BANCO impede aplicar um
     lote de outra vacina, sem trigger.
   - quantidade_total: doses recebidas do fabricante (não é o estoque por UBS).
---------------------------------------------------------------------------- */
CREATE TABLE Lote (
    id_lote           INT         NOT NULL AUTO_INCREMENT,
    codigo_vacina     INT         NOT NULL,
    numero_lote       VARCHAR(30) NOT NULL,
    fabricante        VARCHAR(80) NOT NULL,
    data_validade     DATE        NOT NULL,
    quantidade_total  INT         NOT NULL,
    CONSTRAINT pk_lote            PRIMARY KEY (id_lote),
    CONSTRAINT uq_lote_fabnum     UNIQUE (fabricante, numero_lote),
    CONSTRAINT uq_lote_id_vacina  UNIQUE (id_lote, codigo_vacina),
    CONSTRAINT fk_lote_vacina     FOREIGN KEY (codigo_vacina) REFERENCES Vacina (codigo_vacina),
    CONSTRAINT ck_lote_qtd        CHECK (quantidade_total > 0)
) ENGINE=InnoDB;


/* ----------------------------------------------------------------------------
   4. TABELAS ASSOCIATIVAS
   ---------------------------------------------------------------------------- */

/* Estoque_UBS (ENTIDADE ASSOCIATIVA UBS x Lote, N:N) --------------------------
   Doses de um lote disponíveis em uma UBS. PK composta (cnes, id_lote).
   ON UPDATE CASCADE nas duas FKs: mudar o CNES da UBS ou o id do lote se
   propaga ao estoque.
---------------------------------------------------------------------------- */
CREATE TABLE Estoque_UBS (
    cnes                   CHAR(7) NOT NULL,
    id_lote                INT     NOT NULL,
    quantidade_disponivel  INT     NOT NULL,
    data_atualizacao       DATE    NOT NULL,   -- padrão = hoje, via trigger trg_estoque_ubs_bi
    CONSTRAINT pk_estoque_ubs   PRIMARY KEY (cnes, id_lote),
    CONSTRAINT fk_estoque_ubs   FOREIGN KEY (cnes) REFERENCES UBS (cnes)
        ON UPDATE CASCADE,
    CONSTRAINT fk_estoque_lote  FOREIGN KEY (id_lote) REFERENCES Lote (id_lote)
        ON UPDATE CASCADE,
    CONSTRAINT ck_estoque_qtd   CHECK (quantidade_disponivel >= 0)
) ENGINE=InnoDB;

/* Registro_Dose (ENTIDADE ASSOCIATIVA Paciente x Dose_Esquema, N:N) -----------
   Uma dose PREVISTA ou APLICADA a um paciente, na mesma tabela.
   PK (cns, codigo_vacina, numero_dose): garante a regra 2 (cada dose de cada
   vacina no máximo uma vez por paciente).

   FKs:
     - (codigo_vacina, numero_dose) -> Dose_Esquema
     - (id_lote, codigo_vacina)     -> Lote  (garante lote da MESMA vacina, regra 3).
       Com id_lote NULL (dose pendente) o MySQL ignora a FK composta (MATCH SIMPLE).
     - id_profissional -> Profissional ; cnes -> UBS (UBS onde foi aplicada)
   ON DELETE CASCADE só em cns: excluir o paciente exclui seu histórico vacinal
   (decisão do grupo; o documento não especifica).

   CHECK ck_registro_coerencia (regra 5), lê-se assim:
     APLICADA  -> data_aplicacao, id_lote, id_profissional e cnes TODOS preenchidos
     PENDENTE  -> data_aplicacao, id_lote, id_profissional e cnes TODOS nulos
                  (a dose ainda não foi aplicada; o documento exige data nula
                  e a regra 5 diz que a pendente não tem lote/profissional/UBS)
     CANCELADA -> sem restrição adicional
   Regra 4 (lote vencido) e "data_aplicacao não futura": ver triggers.
---------------------------------------------------------------------------- */
CREATE TABLE Registro_Dose (
    cns               CHAR(15)    NOT NULL,
    codigo_vacina     INT         NOT NULL,
    numero_dose       SMALLINT    NOT NULL,
    data_prevista     DATE        NOT NULL,
    data_aplicacao    DATE        NULL,
    status            VARCHAR(10) NOT NULL DEFAULT 'PENDENTE',
    local_anatomico   VARCHAR(30) NULL,
    id_lote           INT         NULL,
    id_profissional   INT         NULL,
    cnes              CHAR(7)     NULL,
    CONSTRAINT pk_registro_dose  PRIMARY KEY (cns, codigo_vacina, numero_dose),
    CONSTRAINT fk_regdose_pac    FOREIGN KEY (cns) REFERENCES Paciente (cns)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_regdose_dose   FOREIGN KEY (codigo_vacina, numero_dose)
        REFERENCES Dose_Esquema (codigo_vacina, numero_dose),
    CONSTRAINT fk_regdose_lote   FOREIGN KEY (id_lote, codigo_vacina)
        REFERENCES Lote (id_lote, codigo_vacina),
    CONSTRAINT fk_regdose_prof   FOREIGN KEY (id_profissional)
        REFERENCES Profissional (id_profissional),
    CONSTRAINT fk_regdose_ubs    FOREIGN KEY (cnes) REFERENCES UBS (cnes),
    CONSTRAINT ck_regdose_status CHECK (status IN ('PENDENTE', 'APLICADA', 'CANCELADA')),
    CONSTRAINT ck_registro_coerencia CHECK (
           (status = 'APLICADA'
                AND data_aplicacao  IS NOT NULL
                AND id_lote         IS NOT NULL
                AND id_profissional IS NOT NULL
                AND cnes            IS NOT NULL)
        OR (status = 'PENDENTE'
                AND data_aplicacao  IS NULL
                AND id_lote         IS NULL
                AND id_profissional IS NULL
                AND cnes            IS NULL)
        OR  status = 'CANCELADA'
    )
) ENGINE=InnoDB;


/* ----------------------------------------------------------------------------
   5. TRIGGERS
   Regras de integridade que o CHECK do MySQL não permite (ver cabeçalho, d/e).
   Todas usam SIGNAL SQLSTATE '45000', que aborta o comando com mensagem clara.
   ---------------------------------------------------------------------------- */
DELIMITER $$

-- Substituem o DEFAULT (CURRENT_DATE): se a data não vier no INSERT (ou vier NULL), usa a de hoje
CREATE TRIGGER trg_prontuario_bi BEFORE INSERT ON Prontuario
FOR EACH ROW
BEGIN
    IF NEW.data_abertura IS NULL THEN
        SET NEW.data_abertura = CURDATE();
    END IF;
END$$

CREATE TRIGGER trg_estoque_ubs_bi BEFORE INSERT ON Estoque_UBS
FOR EACH ROW
BEGIN
    IF NEW.data_atualizacao IS NULL THEN
        SET NEW.data_atualizacao = CURDATE();
    END IF;
END$$

-- Paciente: data de nascimento não futura + paciente não é responsável de si mesmo
CREATE TRIGGER trg_paciente_bi BEFORE INSERT ON Paciente
FOR EACH ROW
BEGIN
    IF NEW.data_nascimento > CURDATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Paciente: data_nascimento não pode ser futura';
    END IF;
    IF NEW.cns_responsavel IS NOT NULL AND NEW.cns_responsavel = NEW.cns THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Paciente: não pode ser responsável de si mesmo';
    END IF;
END$$

CREATE TRIGGER trg_paciente_bu BEFORE UPDATE ON Paciente
FOR EACH ROW
BEGIN
    IF NEW.data_nascimento > CURDATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Paciente: data_nascimento não pode ser futura';
    END IF;
    IF NEW.cns_responsavel IS NOT NULL AND NEW.cns_responsavel = NEW.cns THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Paciente: não pode ser responsável de si mesmo';
    END IF;
END$$

-- Profissional: não pode ser supervisor de si mesmo (só na alteração, pois no
-- INSERT o id ainda não existe e uma FK para linha inexistente já é rejeitada)
CREATE TRIGGER trg_profissional_bu BEFORE UPDATE ON Profissional
FOR EACH ROW
BEGIN
    IF NEW.id_supervisor IS NOT NULL AND NEW.id_supervisor = NEW.id_profissional THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Profissional: não pode supervisionar a si mesmo';
    END IF;
END$$

-- Registro_Dose: aplicação não futura + regra 4 (lote vencido não pode ser usado)
CREATE TRIGGER trg_registro_dose_bi BEFORE INSERT ON Registro_Dose
FOR EACH ROW
BEGIN
    DECLARE v_validade DATE;
    IF NEW.data_aplicacao IS NOT NULL AND NEW.data_aplicacao > CURDATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Registro_Dose: data_aplicacao não pode ser futura';
    END IF;
    IF NEW.status = 'APLICADA' AND NEW.id_lote IS NOT NULL THEN
        SELECT data_validade INTO v_validade FROM Lote WHERE id_lote = NEW.id_lote;
        IF v_validade < NEW.data_aplicacao THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Registro_Dose: lote vencido na data da aplicação';
        END IF;
    END IF;
END$$

CREATE TRIGGER trg_registro_dose_bu BEFORE UPDATE ON Registro_Dose
FOR EACH ROW
BEGIN
    DECLARE v_validade DATE;
    IF NEW.data_aplicacao IS NOT NULL AND NEW.data_aplicacao > CURDATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Registro_Dose: data_aplicacao não pode ser futura';
    END IF;
    IF NEW.status = 'APLICADA' AND NEW.id_lote IS NOT NULL THEN
        SELECT data_validade INTO v_validade FROM Lote WHERE id_lote = NEW.id_lote;
        IF v_validade < NEW.data_aplicacao THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Registro_Dose: lote vencido na data da aplicação';
        END IF;
    END IF;
END$$

DELIMITER ;

/* FIM DO SCRIPT 1. Próximo passo: executar insercao_tabelas.sql */
