# ArrPulse — Guia de instalação

Instalação via Docker usando a imagem publicada em `ghcr.io/carlosj188/arrpulse`. Não precisa clonar repositório nem buildar nada.

---

## 1. Pré-requisitos

- Docker + Docker Compose v2.
- Acesso de rede aos serviços que vai monitorar (Radarr, Sonarr, etc.).
- (Opcional) Nginx Proxy Manager / Cloudflare se quiser publicar com domínio + HTTPS.

---

## 2. Arquivos

Crie uma pasta (ex.: `/opt/arrpulse`) e coloque dentro os dois arquivos deste kit:

- `docker-compose.yml`
- `.env` (copiado de `.env.example`)

```bash
mkdir -p /opt/arrpulse && cd /opt/arrpulse
# copie docker-compose.yml e .env.example pra cá
cp .env.example .env
```

---

## 3. Configurar o `.env`

Edite o `.env`. O **único obrigatório** é o `APP_SECRET` — gere um valor forte e **nunca mude depois** (mudar torna ilegíveis as credenciais já salvas no banco):

```bash
openssl rand -hex 32
```

Cole o resultado em `APP_SECRET=`. Os demais campos têm default sensato (veja comentários no `.env.example`). Notificações (ntfy/Discord/Telegram), quiet hours e digest também podem ser configurados **depois, pela própria UI** — não precisa pôr no `.env`.

---

## 4. Subir

```bash
docker compose up -d
docker compose logs -f      # deve mostrar "ArrPulse ouvindo em 0.0.0.0:8080"
```

Acesse `http://IP-DO-HOST:8080`.

---

## 5. Primeiro acesso

1. A tela inicial pede pra **criar o usuário** (login único). Defina usuário e senha (mín. 6 caracteres).
2. Em **Adicionar serviço**, cadastre cada serviço (tipo, nome, URL base, credencial). Use **Testar conexão** antes de salvar.
3. Ajuste o **Timeout (s)** por serviço se algum tiver WebUI lenta (vazio = automático: qBit 12s, demais 6s).
4. (Opcional) Em **Settings**, ative push (ntfy/Discord/Telegram), quiet hours e digest diário.
5. (Opcional) Configure os webhooks dos arr — ver README.

---

## 6. Publicar com domínio (opcional)

No Nginx Proxy Manager:
- **Proxy Host** → domínio (ex.: `watch.seudominio.com`) → encaminha pra `http://IP-DO-HOST:8080`.
- SSL via Let's Encrypt (DNS challenge se usar Cloudflare).

---

## 7. Atualizar

```bash
cd /opt/arrpulse
docker compose pull
docker compose up -d
```

(Ou troque a tag fixa no `docker-compose.yml` pela versão desejada e suba de novo.)

---

## 8. Backup

Tudo (serviços, credenciais cifradas, settings, eventos) fica em **`./data/arr-watch.db`**. Para backup:

```bash
# cópia consistente do SQLite
docker compose exec arrpulse sh -c 'apk add --no-cache sqlite >/dev/null 2>&1; true'  # se necessário
cp -a ./data ./data-backup-$(date +%F)
```

Guarde junto o `APP_SECRET` — sem ele o banco é inútil (credenciais não descriptografam).

---

## Variáveis de ambiente

| Variável | Default | Descrição |
|---|---|---|
| `APP_SECRET` | — (**obrigatório**) | Chave de criptografia das credenciais. Fixa e secreta. |
| `PORT` | `8080` | Porta de escuta dentro do container. |
| `HOST` | `0.0.0.0` | Interface de escuta. |
| `DB_PATH` | `/app/data/arr-watch.db` | Caminho do SQLite (montado no volume `./data`). |
| `POLL_INTERVAL` | `60` | Intervalo de verificação em segundos (mín. 15). |
| `TZ` | — | Fuso (ex.: `America/Sao_Paulo`) — usado pelo quiet hours/digest. |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | — | Opcional: semeia o login via env em vez da tela de cadastro. |
| `AUTH_RESET` | — | `1` reseta o login no boot (use para destravar e remova depois). |
| `DEFAULT_LANGUAGE` | `pt` | Idioma padrão da detecção de imports. |
| `NTFY_URL` / `NTFY_TOPIC` / `NTFY_TOKEN` | — | Opcional: pré-preenche o push ntfy (também dá pra fazer na UI). |

Quiet hours, Discord, Telegram, digest e detecção de idioma ficam guardados **no banco** e são configurados pela UI.
