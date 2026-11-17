# HEALTH-SEC · Sala de Vacina (UBS)

Aplicação de gestão da sala de vacina de UBS, integrada ao banco **`bd_vacinas_ubs`**: CRUD, funções,
procedimentos e triggers, consultas e views, e um dashboard estatístico. **Todos os números vêm do banco.**

| Camada | Tecnologia |
|---|---|
| Banco | MySQL **8.0.16+**, testado também no **26.7** (MariaDB/XAMPP **não** serve: o projeto depende de CHECK e triggers do MySQL) |
| Backend | Java **21+** puro, servidor HTTP do JDK (`com.sun.net.httpserver`), JDBC puro, sem frameworks |
| Frontend | HTML + CSS + JavaScript vanilla, gráficos SVG desenhados à mão |
| Dependência externa | apenas o driver MySQL Connector/J **9.7.0** (`lib/`) |

- **O que a aplicação faz, aba por aba:** [próxima seção](#o-que-a-aplicação-entrega).
- **Preparar o ambiente (primeira vez):** passos 1 a 6 abaixo.
- **Compilar e rodar:** [passo 7](#passo-7--compilar-e-rodar).
- **Como o código está organizado e como acrescentar uma rota:** [seção própria](#como-o-código-está-organizado).

## O que a aplicação entrega

| Aba | O que faz | Requisito da entrega |
|---|---|---|
| **Dashboard** | 8 indicadores e 8 gráficos com filtros de UBS, período, vacina e sexo (detalhes abaixo) | Dashboard estatístico integrado |
| **Consultas** | as 14 consultas (Etapa 03) e as 2 views (Etapa 04), cada uma com indicadores, 1 ou 2 gráficos, filtros na tela (busca e por coluna) e tabela ordenável; parâmetros enviados ao banco (paciente, lote; nas views: UBS, vacina, situação, validade) | Consultas e views |
| **Pacientes** | CRUD de `Paciente` (grava junto `Prontuario` e `Paciente_Telefone`) | CRUD (1/4) |
| **Estoque** | CRUD de `Estoque_UBS` (entrada, ajuste, remoção), com checagem da quantidade total do lote | CRUD (2/4) |
| **Lotes** | CRUD de `Lote`, com situação da validade, total em estoque e doses aplicadas | CRUD (3/4) |
| **Profissionais** | CRUD de `Profissional` (especialização disjunta: só o campo do cargo é gravado) | CRUD (4/4) |
| **Rotinas do banco** | executa e mostra o efeito de cada objeto da Etapa 05 (tabela abaixo) | Funções, procedimentos e triggers |

**Etapa 05 na interface** (aba Rotinas do banco, salvo indicação):

| Objeto | Como aparece |
|---|---|
| `fn_situacao_dose` | execução avulsa (status + data) e aplicada a todas as doses, com gráfico; também usada no dashboard (situação, atrasadas, dias de atraso) |
| `fn_saldo_aplicavel` | saldo aplicável × saldo total por vacina na UBS, com indicadores e gráfico; também filtra as doses que podem ser aplicadas |
| `pr_registrar_aplicacao_dose` | aplica uma dose pendente e mostra **antes/depois** da dose e do estoque do lote. Roda em transação: se a baixa do estoque falhar, a aplicação também é desfeita |
| `pr_baixa_estoque_fifo` (cursor) | baixa uma quantidade e mostra, lote a lote, antes/baixado/depois, com gráfico |
| `trg_auditoria_status_dose` | tabela do `Log_Status_Dose`; aplicar ou cancelar uma dose mostra a linha que o trigger gravou |
| `trg_bloqueia_lote_vencido_entrada` | botão de teste (INSERT real com ROLLBACK) e no cadastro da aba Lotes |
| `trg_profissional_bu`, CHECKs e FKs | aparecem como mensagens de erro em português nos CRUDs (ex.: supervisor de si mesmo, excluir lote em uso) |

**Dashboard**:

- **Indicadores:** pacientes cadastrados, doses aplicadas no período (com variação % em relação ao período
  anterior de mesmo tamanho), média mensal, % de doses em dia, doses atrasadas, estoque válido, estoque vencido
  (% do total) e vacina mais aplicada.
- **Gráficos:**

  | # | Gráfico | Conceito de Estatística |
  |---|---|---|
  | 1 | Linha: doses por mês + reta de mínimos quadrados | tendência temporal |
  | 2 | Pizza (rosca): situação das doses | frequência absoluta e relativa |
  | 3 | Barras: vacinas mais aplicadas | distribuição de frequência, moda |
  | 4 | Barras agrupadas: faixa etária × sexo | comparativo de frequências |
  | 5 | Histograma: idade dos pacientes | média, mediana, moda, variância, desvio padrão, coef. de variação |
  | 6 | Histograma: dias de atraso | as mesmas medidas, mais assimetria (média × mediana) |
  | 7 | Radar: doses por dia da semana | distribuição em variável cíclica |
  | 8 | Dispersão: pacientes × doses por UBS | correlação de Pearson (r, r²) e reta de regressão |

- Média, mediana, moda, variância, desvio padrão e Pearson são **calculados no SQL** (`VAR_SAMP`, `STDDEV_SAMP`,
  funções de janela, CTE). A reta de tendência mensal é calculada no front, sobre a série que o banco devolve.
- Cada gráfico informa a quais filtros responde e tem uma tabela "Ver dados".

## Estrutura atual

```
HEALTH-SEC/
├── config/app.properties.example   modelo de configuração (copie para app.properties)
├── db/00_usuario_app.sql.example   cria o usuário da aplicação (copie e ponha sua senha)
├── db/criacao_tabelas.sql          Etapa 02: banco, 12 tabelas, 7 triggers de integridade
├── db/insercao_tabelas.sql         Etapa 02: dados de teste (reexecutável)
├── db/consultas.sql                Etapa 03: as 14 consultas (mesmo SQL do ConsultaDao)
├── db/indices.sql                  Etapa 04: índices para as consultas e o dashboard
├── db/views.sql                    Etapa 04: vw_carteira_vacinacao e vw_posicao_estoque
├── db/funcoes.sql                  Etapa 05: fn_situacao_dose e fn_saldo_aplicavel
├── db/procedimentos.sql            Etapa 05: pr_registrar_aplicacao_dose e pr_baixa_estoque_fifo (cursor)
├── db/triggers.sql                 Etapa 05: Log_Status_Dose + 2 triggers (auditoria e lote vencido)
├── lib/                            driver JDBC (local, não versionado; crie a pasta, veja o passo 6)
├── scripts/                        build.bat (compila) e run.bat (sobe o servidor)
├── src/br/cesar/vacinas/
│   ├── App.java                    main: carrega a configuração, registra as rotas e sobe o servidor
│   ├── config/AppConfig.java       lê config/app.properties (DB_PASSWORD do ambiente tem prioridade)
│   ├── db/Database.java            conexão JDBC, query/update e transação (emTransacao)
│   ├── db/SqlErros.java            traduz erros do MySQL (CHECK, FK, UNIQUE, triggers) para português
│   ├── http/                       Router, Request, Json, StaticFiles, HttpError
│   ├── api/Routes.java             todos os endpoints: MÉTODO + caminho -> método do DAO
│   └── dao/                        *** todo o SQL da aplicação *** (um DAO por funcionalidade)
│       ├── DashboardDao.java       indicadores e estatísticas do dashboard (filtros comuns em Filtro)
│       ├── ConsultaDao.java        as 14 consultas (aba Consultas)
│       ├── ViewDao.java            as views da Etapa 04, com filtros (aba Consultas)
│       ├── RotinaDao.java          funções, procedimentos e triggers da Etapa 05 (aba Rotinas do banco)
│       ├── PacienteDao, EstoqueDao, LoteDao, ProfissionalDao   os 4 CRUDs
│       └── CatalogoDao.java        listas para selects (pacientes, vacinas)
└── web/                            front servido pelo próprio Java em http://localhost:8080
    ├── index.html                  página única, uma <section> por aba
    ├── css/style.css
    └── js/
        ├── api.js                  fetch, tratamento de erros e utilitários de tela (ui)
        ├── app.js                  troca de abas
        ├── charts.js               gráficos SVG: barras, barras agrupadas, linha, histograma, pizza, radar, dispersão
        ├── dashboard.js            aba Dashboard: filtros, indicadores e os 8 gráficos
        ├── consultas.js            aba Consultas: consultas e views, com parâmetros, indicadores, gráficos e filtros (VISUAL)
        ├── rotinas.js              aba Rotinas do banco
        └── pacientes.js, estoque.js, lotes.js, profissionais.js   os 4 CRUDs, uma aba cada
```

---

## Preparar o ambiente no Windows 10/11

Cada dev roda **o próprio MySQL local**. O que é igual para o time está no repositório;
senhas ficam só na sua máquina.

| Igual para todos (versionado) | Individual (nunca vai para o Git) |
|---|---|
| Banco `bd_vacinas_ubs` · `utf8mb4` / `utf8mb4_0900_ai_ci` | senha do `root` |
| Usuário `ubs_vacinas_app@localhost` (só SELECT/INSERT/UPDATE/DELETE/EXECUTE) | senha do `ubs_vacinas_app` |
| MySQL 8.0.16+ na porta 3306, escutando só em `127.0.0.1` | `config/app.properties` |
| Scripts em `db/` (fonte única da estrutura e dos dados) | `db/00_usuario_app.sql` |
| Versão do driver: Connector/J 9.7.0 | o arquivo `.jar` |

### Pré-requisitos

| Item | Conferir no PowerShell |
|---|---|
| MySQL Server 8.0.16+ (serviço `MySQL80`; em versões novas o nome muda, ex. `MySQL267` no 26.7) | `mysql --version` → `MySQL Community Server`, **não** `MariaDB` |
| JDK 21 ou mais novo | `javac -version` → `21.x` ou maior |

> **`mysql` não reconhecido?** O instalador nem sempre põe o cliente no PATH. Para a sessão atual do terminal
> (ajuste a pasta para a sua versão):
> `$env:Path += ";C:\Program Files\MySQL\MySQL Server 8.0\bin"`
>
> Nos passos abaixo, onde aparece `MySQL80` use o nome do **seu** serviço (o primeiro comando do passo 1 mostra).
| Git | `git --version` |
| VSCode + *Extension Pack for Java* | — |
| DBeaver (opcional, só para visualizar o banco) | — |

> O DBeaver e o VSCode **não** precisam ser conectados entre si. Cada ferramenta conversa só com o MySQL;
> a aplicação Java se conecta sozinha, via JDBC.

Todos os comandos abaixo são rodados **na pasta do projeto** (`cd <caminho>\HEALTH-SEC`), exceto quando indicado.

### Passo 1 · MySQL rodando

```powershell
Get-Service | Where-Object { $_.Name -match 'mysql|maria' }   # esperado: MySQL80 Running
```

Se estiver **Stopped**: PowerShell **como Administrador** (Win+X → Terminal (Admin)) → `Start-Service MySQL80`.

> ⚠️ `Não é possível abrir o serviço` = PowerShell sem permissão de administrador, não é defeito do MySQL.
> ⚠️ Se falhar mesmo como admin, **não reinstale**: veja o log primeiro:
> `Get-ChildItem "C:\ProgramData\MySQL\MySQL Server 8.0\Data\*.err" | % { Get-Content $_ -Tail 30 }`

### Passo 2 · Restringir o MySQL à sua máquina (segurança)

O instalador deixa o MySQL aceitando conexões de **qualquer máquina da rede** (`::`). Em Wi-Fi compartilhado
(faculdade), qualquer um poderia tentar a senha do `root`. O ajuste abaixo não muda nada para você:
DBeaver, terminal e Java rodam na sua máquina.

PowerShell **como Administrador**:

1. Descobrir o `my.ini` em uso (caminho depois de `--defaults-file=`):
   `(Get-CimInstance Win32_Service -Filter "Name='MySQL80'").PathName`
2. Backup: `Copy-Item "C:\ProgramData\MySQL\MySQL Server 8.0\my.ini" "C:\ProgramData\MySQL\MySQL Server 8.0\my.ini.bak"`
3. `notepad "C:\ProgramData\MySQL\MySQL Server 8.0\my.ini"` → logo abaixo de `[mysqld]` (ou editando, se já existir):
   ```ini
   bind-address=127.0.0.1
   mysqlx-bind-address=127.0.0.1
   ```
   Salve com Ctrl+S. **Nunca** "UTF-8 com BOM" (o serviço deixa de subir).
4. `Restart-Service MySQL80`

**Verificar:** `Get-NetTCPConnection -LocalPort 3306,33060 -State Listen` → `LocalAddress` = `127.0.0.1` nas duas.
Se o serviço não subir: `Copy-Item "...\my.ini.bak" "...\my.ini" -Force` e `Start-Service MySQL80`.

### Passo 3 · Banco e usuário da aplicação

1. `Copy-Item db\00_usuario_app.sql.example db\00_usuario_app.sql`
2. `notepad db\00_usuario_app.sql` → troque as **duas** ocorrências de `<SENHA>` e salve.
3. Rode como root:
   ```powershell
   cmd /c "mysql -u root -p --default-character-set=utf8mb4 --skip-comments < db\00_usuario_app.sql"
   ```

**Verificar:** a saída termina com `GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON bd_vacinas_ubs.* TO ubs_vacinas_app@localhost`.

> `EXECUTE` é necessário para a aba **Rotinas do banco** chamar as funções e os procedimentos.
> Se o seu `00_usuario_app.sql` é anterior a isso, acrescente `EXECUTE` na linha do `GRANT` e rode-o de novo.

> O nome do usuário diferencia maiúsculas: sempre `ubs_vacinas_app`.
> Esqueceu a senha do `ubs_vacinas_app`? Rode este script de novo com uma senha nova: ele redefine.

### Passo 4 · Criar as tabelas, carregar os dados e criar os objetos do banco

O PowerShell **não** aceita `<` como redirecionamento; por isso o `cmd /c`. Rode **todos, nesta ordem**
(cada um pede a senha do root):

```powershell
cmd /c "mysql -u root -p --default-character-set=utf8mb4 --skip-comments < db\criacao_tabelas.sql"
cmd /c "mysql -u root -p --default-character-set=utf8mb4 --skip-comments < db\insercao_tabelas.sql"
cmd /c "mysql -u root -p --default-character-set=utf8mb4 --skip-comments < db\indices.sql"
cmd /c "mysql -u root -p --default-character-set=utf8mb4 --skip-comments < db\views.sql"
cmd /c "mysql -u root -p --default-character-set=utf8mb4 --skip-comments < db\funcoes.sql"
cmd /c "mysql -u root -p --default-character-set=utf8mb4 --skip-comments < db\procedimentos.sql"
cmd /c "mysql -u root -p --default-character-set=utf8mb4 --skip-comments < db\triggers.sql"
```

Vários scripts imprimem tabelas de conferência (contagens, testes, demonstrações que terminam em `ROLLBACK`): é normal.

Por que a ordem importa:

| Script | Precisa vir depois de | Motivo |
|---|---|---|
| `insercao_tabelas.sql` | `criacao_tabelas.sql` | as tabelas precisam existir |
| `funcoes.sql` | `views.sql` | as consultas de conferência no fim do script usam `vw_carteira_vacinacao` |
| `triggers.sql` | `insercao_tabelas.sql` | o trigger de lote vencido recusaria os lotes vencidos dos dados de teste |

> **Por que `--skip-comments`:** em versões novas do cliente `mysql` (confirmado no 26.7: `mysql --help` mostra
> `comments TRUE`), os comentários vão ao servidor por padrão. Um comentário logo antes de `DELIMITER $$` faz o cliente não reconhecer o comando, e o script
> para com `ERROR 1064 ... near 'DELIMITER $$'`. A opção devolve o comportamento do 8.0 e não muda nada nele.

> Rode os scripts **pelo terminal**, não pelo DBeaver: vários usam `DELIMITER`, comando do cliente `mysql`.
> Os scripts são **reexecutáveis**: rode de novo sempre que alguém mudar algo em `db/`
> (o `criacao_tabelas.sql` também recria o banco, se ele tiver sido apagado).
> **Rodou de novo o `criacao_tabelas.sql`? Rode também todos os seguintes**: recriar as tabelas apaga os triggers
> delas, inclusive os do `triggers.sql`. A tabela `Log_Status_Dose` não é apagada, então o histórico de auditoria continua.

**Verificar** (login como a aplicação, senha do passo 3):

```powershell
mysql -h 127.0.0.1 -u ubs_vacinas_app -p bd_vacinas_ubs -e "SELECT CURRENT_USER(), (SELECT COUNT(*) FROM UBS) ubs, (SELECT COUNT(*) FROM Registro_Dose) doses, fn_situacao_dose('PENDENTE', '2020-01-01') funcao;"
```

Esperado: `ubs_vacinas_app@localhost`, `31` UBS, `657` doses e `ATRASADA` (prova que as funções existem e que o
usuário tem `EXECUTE`). Como root, `SHOW TRIGGERS FROM bd_vacinas_ubs;` lista **9** triggers
(7 do `criacao_tabelas.sql` + 2 do `triggers.sql`).

### Passo 5 · Acentos e charset

```powershell
chcp 65001
mysql -h 127.0.0.1 -u ubs_vacinas_app -p bd_vacinas_ubs --default-character-set=utf8mb4 -e "SELECT nome FROM UBS WHERE nome LIKE '%Varzea%'; SELECT nome FROM Vacina WHERE codigo_vacina IN (6, 10);"
```

Esperado: `UBS Várzea`, `Rotavírus Humano` e `Tríplice Viral (SCR)` com acentos corretos
(a collation `_ai_ci` ignora acento na busca: `Varzea` encontra `Várzea`).

| Aparece | Significa |
|---|---|
| `VÃ¡rzea` | banco certo, console sem `chcp 65001` |
| `V?rzea` | dado gravado errado: recarregue o passo 4 com `--default-character-set=utf8mb4` |

### Passo 6 · Configuração da aplicação e driver JDBC

```powershell
Copy-Item config\app.properties.example config\app.properties
notepad config\app.properties     # troque TROQUE_PELA_SUA_SENHA_LOCAL pela senha do passo 3
```

Baixe o driver **Connector/J 9.7.0** e deixe **só o `.jar`** em `lib\` (crie a pasta se não existir: `mkdir lib`):

- oficial: https://downloads.mysql.com/archives/c-j/ → *Product Version* **9.7.0** · *Operating System* **Platform Independent** → ZIP;
  extraia **fora do projeto** e copie só o `mysql-connector-j-9.7.0.jar`;
- ou o `.jar` direto: https://repo1.maven.org/maven2/com/mysql/mysql-connector-j/9.7.0/mysql-connector-j-9.7.0.jar

> ⚠️ Não use a versão da página principal de downloads (26.x): ela só suporta MySQL 8.4+, e o projeto usa 8.0.

**Verificar:**

```powershell
dir lib\*.jar                  # exatamente: mysql-connector-j-9.7.0.jar
git status --ignored --short   # app.properties, 00_usuario_app.sql e o .jar aparecem com "!!" (ignorados)
```

> O `Get-Content` do PowerShell 5 pode mostrar acentos como `Ã¡` em arquivos UTF-8. É só exibição.

---

### Passo 7 · Compilar e rodar

Sempre **da raiz do projeto**: o servidor procura `config/` e `web/` a partir dela.

```powershell
scripts\build.bat      # compila (equivale a: javac -encoding UTF-8 -d out -sourcepath src src\br\cesar\vacinas\App.java)
scripts\run.bat        # sobe o servidor (equivale a: java -cp "out;lib/*" br.cesar.vacinas.App)
```

O terminal mostra `Sala de Vacina no ar: http://localhost:8080` e fica parado: é o servidor rodando.
Para testar a API, abra **outro terminal**. Para parar o servidor, **Ctrl+C**.

**Verificar:**

```powershell
curl.exe http://localhost:8080/api/health   # {"versao":"8.0.x","banco":"bd_vacinas_ubs"}
```

E `http://localhost:8080` no navegador abre a página com as abas.

- No PowerShell use `curl.exe`: o `curl` sozinho é outro comando no PowerShell 5.
- Mudou só `web/`? Basta recarregar o navegador (Ctrl+F5). Mudou `.java`? Rode `scripts\build.bat` e reinicie o servidor.
- Compilação "do zero" (antes de abrir PR): `Remove-Item out -Recurse` e depois `scripts\build.bat`.

---

## Como o código está organizado

Toda requisição segue o mesmo caminho:

```
navegador (web/js/api.js)  ->  App (HttpServer em 127.0.0.1:8080)
   /api/...  ->  Router -> handler registrado em Routes -> DAO -> Database (JDBC) -> MySQL
   resto     ->  StaticFiles (arquivos de web/)
resposta: sempre JSON UTF-8; erro = {"erro": "mensagem"} com status 400, 404, 409 ou 500
```

- O front envia **formulário** (`chave=valor`, via `URLSearchParams`), não JSON; o Java só escreve JSON.
- Todo SQL fica nos DAOs, escrito à mão, sempre com `PreparedStatement` e `?`.
- Quem valida é o banco (CHECK, FK, triggers). O `SqlErros` só traduz a mensagem; o `api.js` mostra num aviso vermelho.

### Acrescentar uma funcionalidade (3 passos)

1. **SQL no DAO** (`src/br/cesar/vacinas/dao/`): um método por comando.
   ```java
   public static List<Map<String, Object>> listar(String cnes) throws SQLException {
       return Database.query("SELECT * FROM Estoque_UBS WHERE (? IS NULL OR cnes = ?)", cnes, cnes);
   }
   ```
2. **Rota** no **seu bloco** de `api/Routes.java` (acrescente; não reorganize os blocos dos colegas):
   ```java
   r.get("/api/estoque", req -> EstoqueDao.listar(req.str("cnes")));
   ```
3. **Tela** no JS da sua aba (`web/js/<aba>.js`):
   ```js
   const linhas = await api.get('/api/estoque');
   document.getElementById('aba-estoque').innerHTML = ui.tabela(linhas);
   ```

Regras rápidas:

| Preciso de... | Use |
|---|---|
| campo obrigatório / opcional | `req.reqStr("x")`, `req.reqInt("x")` (respondem 400 sozinhos) / `req.str("x")` (vazio vira `NULL`) |
| variável no caminho, ex. `/api/pacientes/{cns}` | `req.path("cns")` |
| vários comandos que gravam juntos | `Database.emTransacao(conn -> { Database.update(conn, ...); ...; return null; })` |
| registro não encontrado | `throw new HttpError(404, "...")` (erro do banco não precisa de try/catch) |
| texto do banco dentro do HTML | `ui.esc(valor)` ou `ui.tabela(linhas)` |

## Endpoints

| Método | Caminho | Resposta |
|---|---|---|
| GET | `/api/health` | versão do MySQL e nome do banco (teste de conexão) |
| GET | `/api/dashboard/ubs` | `[{cnes, nome}]` para o filtro de UBS do dashboard |
| GET | `/api/dashboard/indicadores` | pacientes, doses aplicadas (e variação vs. período anterior), média mensal, % em dia, atrasadas, estoque válido/vencido, vacina mais aplicada |
| GET | `/api/dashboard/estatistica/doses-por-mes` | doses aplicadas por mês no período: `{primeiro, ultimo, meses: [{mes, doses}]}` |
| GET | `/api/dashboard/estatistica/situacao-doses` | doses por `fn_situacao_dose`: `[{situacao, doses, percentual}]` |
| GET | `/api/dashboard/estatistica/top-vacinas` | doses aplicadas por vacina: `[{vacina, doses, percentual}]` |
| GET | `/api/dashboard/estatistica/faixa-etaria-sexo` | doses aplicadas por faixa etária (idade na aplicação) e sexo: `[{ordem, faixa, sexo, doses}]` |
| GET | `/api/dashboard/estatistica/idade-pacientes` | idade dos pacientes: `{largura, classes: [{inicio, n}], resumo}` |
| GET | `/api/dashboard/estatistica/atrasos` | dias de atraso das doses atrasadas: `{largura, classes: [{inicio, n}], resumo}` |
| GET | `/api/dashboard/estatistica/dia-semana` | doses aplicadas por dia da semana (1 = domingo): `[{dia, doses}]` |
| GET | `/api/dashboard/estatistica/correlacao-ubs` | por UBS, pacientes (x) × doses aplicadas (y): `{pontos: [{cnes, nome, x, y}], estatistica: {n, pearson, inclinacao, intercepto}}` |
| GET | `/api/consultas` | as 14 consultas: id, título, pergunta, recursos, SQL e parâmetro |
| GET | `/api/consultas/{n}` | `{"colunas": [...], "linhas": [[...], ...]}`; a 3 exige `?cns=` (15 dígitos) e a 6 exige `?id_lote=` |
| GET | `/api/views` | as views da Etapa 04: id, nome, título, pergunta, SQL e filtros |
| GET | `/api/views/carteira?cns=&cnes=&codigo_vacina=&situacao=` | `vw_carteira_vacinacao` filtrada (todos os filtros opcionais), no formato `{colunas, linhas}` |
| GET | `/api/views/estoque?cnes=&codigo_vacina=&situacao_validade=&com_saldo=1` | `vw_posicao_estoque` filtrada (todos os filtros opcionais), no formato `{colunas, linhas}` |
| GET | `/api/pacientes` | `[{cns, nome}]` para o select da consulta 3 |
| GET | `/api/pacientes/{cns}` | dados do paciente para alteração |
| POST | `/api/pacientes` | cadastra paciente, prontuário e telefone |
| PUT | `/api/pacientes/{cns}` | altera os dados e a UBS de referência |
| DELETE | `/api/pacientes/{cns}` | exclui se o paciente não tiver dose APLICADA |
| GET | `/api/vacinas` | `[{codigo_vacina, nome}]` para selects |
| GET | `/api/estoque?cnes=` | estoque por UBS e lote |
| POST | `/api/estoque` | entrada de doses de um lote em uma UBS |
| PUT | `/api/estoque/{cnes}/{id_lote}` | ajusta a quantidade disponível |
| DELETE | `/api/estoque/{cnes}/{id_lote}` | remove o lote do estoque da UBS |
| GET | `/api/lotes?codigo_vacina=` | lotes com vacina, situação da validade, total em estoque e doses aplicadas (também alimenta os selects de lote) |
| GET | `/api/lotes/{id}` | dados do lote para alteração |
| POST | `/api/lotes` | cadastra lote (lote vencido é barrado pelo trigger `trg_bloqueia_lote_vencido_entrada`) |
| PUT | `/api/lotes/{id}` | altera número, fabricante, validade e quantidade total (a vacina não muda) |
| DELETE | `/api/lotes/{id}` | exclui se o lote não estiver em estoque nem aplicado |
| GET | `/api/profissionais?cnes=` | profissionais com UBS, supervisor, campo do subtipo e doses aplicadas |
| GET | `/api/profissionais/{id}` | dados do profissional para alteração |
| POST | `/api/profissionais` | cadastra profissional (só o campo do subtipo do cargo é gravado) |
| PUT | `/api/profissionais/{id}` | altera (supervisor de si mesmo é barrado pelo trigger `trg_profissional_bu`) |
| DELETE | `/api/profissionais/{id}` | exclui se não tiver dose aplicada; supervisionados ficam sem supervisor |
| GET | `/api/rotinas/fn-situacao-dose?status=&data_prevista=` | `{situacao}` calculada por `fn_situacao_dose` |
| GET | `/api/rotinas/fn-situacao-dose/registradas?cnes=` | doses registradas agrupadas por `fn_situacao_dose`: `[{situacao, doses, percentual}]` |
| GET | `/api/rotinas/fn-saldo-aplicavel?cnes=` | por vacina: `fn_saldo_aplicavel` (lotes válidos) e saldo total da UBS |
| GET | `/api/rotinas/doses-aplicaveis?cnes=` | doses pendentes de pacientes da UBS com saldo aplicável (até 200) |
| GET | `/api/rotinas/lotes-aplicaveis?cnes=&codigo_vacina=` | lotes válidos com saldo na UBS |
| POST | `/api/rotinas/pr-registrar-aplicacao-dose` | `CALL pr_registrar_aplicacao_dose` em transação: `{antes, depois, log}` |
| POST | `/api/rotinas/cancelar-dose` | cancela dose pendente (dispara `trg_auditoria_status_dose`): `{antes, depois, log}` |
| POST | `/api/rotinas/pr-baixa-estoque-fifo` | `CALL pr_baixa_estoque_fifo`: `{solicitado, baixado, nao_atendido, lotes: [{antes, baixado, depois}]}` |
| GET | `/api/rotinas/log-status-dose?cns=` | últimas 100 linhas de `Log_Status_Dose` |
| POST | `/api/rotinas/testar-lote-vencido` | tenta inserir lote e sempre faz ROLLBACK: `{bloqueado, mensagem}` do `trg_bloqueia_lote_vencido_entrada` |

Todas as rotas de `/api/dashboard/indicadores` e `/api/dashboard/estatistica/*` aceitam os mesmos filtros, todos opcionais:
`cnes` (UBS de referência do paciente), `de` e `ate` (período da data de aplicação, `AAAA-MM-DD`), `codigo_vacina` e `sexo` (`F`/`M`).
Cada rota ignora o que não se aplica a ela (ex.: a idade dos pacientes não tem período). Os `resumo` trazem
`{n, media, mediana, moda, variancia, desvio_padrao, minimo, maximo}`, calculados no SQL.

Cada rota nova entra nesta tabela no mesmo PR.

---

## Problemas comuns

| Sintoma | Causa provável / solução |
|---|---|
| `ERROR 1064 ... near 'DELIMITER $$'` ao rodar um script | cliente `mysql` novo enviando comentários: acrescente `--skip-comments` (passo 4) |
| `mysql` não é reconhecido como comando | cliente fora do PATH: veja a nota dos pré-requisitos |
| `Access denied for user 'ubs_vacinas_app'` | senha errada, nome com maiúscula ou `<SENHA>` não trocada no `00_usuario_app.sql` (aí a senha ficou literalmente `<SENHA>`). Corrija o arquivo e rode o passo 3 de novo |
| `execute command denied to user 'ubs_vacinas_app'` na aba Rotinas ou no dashboard | falta `EXECUTE` no `GRANT`: veja a nota do passo 3 |
| `FUNCTION bd_vacinas_ubs.fn_situacao_dose does not exist` ou `Table 'Log_Status_Dose' doesn't exist` | faltou rodar `funcoes.sql` / `procedimentos.sql` / `triggers.sql` (passo 4) |
| Cadastrar lote vencido funciona (deveria ser bloqueado) | o `criacao_tabelas.sql` foi rodado de novo depois do `triggers.sql`: rode o `triggers.sql` outra vez |
| `Access denied for user 'root'` | senha do root errada (se o DBeaver conecta como root, ela está salva nele: *Editar Conexão*) |
| `Unknown database 'bd_vacinas_ubs'` | banco não criado ou apagado: rode o passo 4 |
| `Public Key Retrieval is not allowed` | falta `allowPublicKeyRetrieval=true` na `db.url` |
| `Communications link failure` / `Can't connect` | serviço do MySQL parado (passo 1); use sempre `127.0.0.1` (não `localhost`) |
| `No suitable driver found for jdbc:mysql` | falta o `.jar` em `lib\` ou o classpath não inclui `lib/*` |
| Números do dashboard diferentes entre devs | as consultas usam `CURDATE()`; os dados de teste têm referência 20/09/2026. Testar a aba Rotinas também muda os dados (aplica, cancela e baixa doses); para voltar ao original, rode o passo 4 de novo |
| `NoSuchFileException: config\app.properties` ou página 404 em `/` | servidor iniciado fora da raiz do projeto: `cd` para a pasta HEALTH-SEC e rode de novo |
| `Address already in use` | a porta 8080 já está em uso (outro servidor aberto): feche-o ou mude `server.port` no **seu** `app.properties` |
| `cannot find symbol: Map` ao compilar | falta `import java.util.Map;` no topo do arquivo (o VSCode pode apagá-lo em "Organize Imports") |
| Acentos como `├ú` no terminal | só exibição do PowerShell: rode `chcp 65001`; no navegador não acontece |
| Console do navegador não deixa colar código | digite `allow pasting` (ou `permitir colar`) e Enter |

> ⚠️ **DBeaver:** para sair, use **Desconectar**. **Excluir** com o banco selecionado apaga o banco inteiro.
