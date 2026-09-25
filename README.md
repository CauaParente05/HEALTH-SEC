# HEALTH-SEC · Sala de Vacina (UBS)

MVP de dashboard de vacinação sobre o banco **`bd_vacinas_ubs`**.

| Camada | Tecnologia |
|---|---|
| Banco | MySQL **8.0.16+** (MariaDB/XAMPP **não** serve: o projeto depende de CHECK e triggers do MySQL 8) |
| Backend | Java **21** puro, servidor HTTP do JDK (`com.sun.net.httpserver`), JDBC puro, sem frameworks |
| Frontend | HTML + CSS + JavaScript vanilla, gráficos SVG desenhados à mão |
| Dependência externa | apenas o driver MySQL Connector/J **9.7.0** (`lib/`) |

- **Preparar o ambiente (primeira vez):** este arquivo.

## Estrutura atual

```
HEALTH-SEC/
├── config/app.properties.example   modelo de configuração (copie para app.properties)
├── db/00_usuario_app.sql.example   cria o usuário da aplicação (copie e ponha sua senha)
├── db/criacao_tabelas.sql          script 1: banco, 12 tabelas, 7 triggers
├── db/insercao_tabelas.sql         script 2: dados de teste (reexecutável)
└── lib/                            driver JDBC (local, não versionado; crie a pasta, veja o passo 6)
```

---

## Preparar o ambiente no Windows 10/11

Cada dev roda **o próprio MySQL local**. O que é igual para o time está no repositório;
senhas ficam só na sua máquina.

| Igual para todos (versionado) | Individual (nunca vai para o Git) |
|---|---|
| Banco `bd_vacinas_ubs` · `utf8mb4` / `utf8mb4_0900_ai_ci` | senha do `root` |
| Usuário `ubs_vacinas_app@localhost` (só SELECT/INSERT/UPDATE/DELETE) | senha do `ubs_vacinas_app` |
| MySQL 8.0.16+ na porta 3306, escutando só em `127.0.0.1` | `config/app.properties` |
| Scripts em `db/` (fonte única da estrutura e dos dados) | `db/00_usuario_app.sql` |
| Versão do driver: Connector/J 9.7.0 | o arquivo `.jar` |

### Pré-requisitos

| Item | Conferir no PowerShell |
|---|---|
| MySQL Server 8.0.16+ (serviço `MySQL80`) | `mysql --version` → `MySQL Community Server`, **não** `MariaDB` |
| JDK 21 | `javac -version` → `21.x` |
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
   cmd /c "mysql -u root -p --default-character-set=utf8mb4 < db\00_usuario_app.sql"
   ```

**Verificar:** a saída termina com `GRANT SELECT, INSERT, UPDATE, DELETE ON bd_vacinas_ubs.* TO ubs_vacinas_app@localhost`.

> O nome do usuário diferencia maiúsculas: sempre `ubs_vacinas_app`.
> Esqueceu a senha do `ubs_vacinas_app`? Rode este script de novo com uma senha nova: ele redefine.

### Passo 4 · Criar as tabelas e carregar os dados

O PowerShell **não** aceita `<` como redirecionamento; por isso o `cmd /c`:

```powershell
cmd /c "mysql -u root -p --default-character-set=utf8mb4 < db\criacao_tabelas.sql"
cmd /c "mysql -u root -p --default-character-set=utf8mb4 < db\insercao_tabelas.sql"
```

O segundo imprime várias tabelas (contagens e demonstrações que terminam em `ROLLBACK`): é normal.

> Rode os scripts **pelo terminal**, não pelo DBeaver: a seção de triggers usa `DELIMITER`, comando do cliente `mysql`.
> Os scripts são **reexecutáveis**: rode de novo sempre que alguém mudar algo em `db/`
> (o `criacao_tabelas.sql` também recria o banco, se ele tiver sido apagado).

**Verificar** (login como a aplicação, senha do passo 3):

```powershell
mysql -h 127.0.0.1 -u ubs_vacinas_app -p bd_vacinas_ubs -e "SELECT CURRENT_USER(), (SELECT COUNT(*) FROM UBS) ubs, (SELECT COUNT(*) FROM Registro_Dose) doses;"
```

Esperado: `ubs_vacinas_app@localhost`, `31` UBS e `657` doses. Como root, `SHOW TRIGGERS FROM bd_vacinas_ubs;` lista **7** triggers.

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

## Problemas comuns

| Sintoma | Causa provável / solução |
|---|---|
| `Access denied for user 'ubs_vacinas_app'` | senha errada ou nome com maiúscula. Esqueceu? Rode o passo 3 de novo com senha nova |
| `Access denied for user 'root'` | senha do root errada (se o DBeaver conecta como root, ela está salva nele: *Editar Conexão*) |
| `Unknown database 'bd_vacinas_ubs'` | banco não criado ou apagado: rode o passo 4 |
| `Public Key Retrieval is not allowed` | falta `allowPublicKeyRetrieval=true` na `db.url` |
| `Communications link failure` / `Can't connect` | serviço `MySQL80` parado; use sempre `127.0.0.1` (não `localhost`) |
| `No suitable driver found for jdbc:mysql` | falta o `.jar` em `lib\` ou o classpath não inclui `lib/*` |
| Números do dashboard diferentes entre devs | as consultas usam `CURDATE()`; os dados de teste têm referência 20/09/2026 |

> ⚠️ **DBeaver:** para sair, use **Desconectar**. **Excluir** com o banco selecionado apaga o banco inteiro.
