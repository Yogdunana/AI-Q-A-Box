# 部署

正式网站的部署和运行使用下面这一台服务器。GitHub Actions 只负责 CI。

| 项 | 值 |
| --- | --- |
| 主机 | `103.236.72.119` |
| SSH 端口 | `29244` |
| 系统 | Ubuntu 22.04 |
| 登录用户 | `root` |
| 域名 | `https://ai-box.yogdunana.cn` |
| 当前站点目录 | `/var/www/ai-box` |
| Nginx 配置 | `/etc/nginx/sites-available/ai-box.conf` |
| 证书 | Let's Encrypt，由 `certbot.timer` 自动续期 |

域名已经解析到这台主机。HTTP 会跳转到 HTTPS。证书颁给 `ai-box.yogdunana.cn`，本次有效期到 2027-02-12 22:22（Asia/Shanghai）。续期任务是 `certbot.timer`。

站点目录由前端发布工作流替换，见下一节。API 跑在同一台机器的 `127.0.0.1:8787`，由 Nginx 把 `/api/` 反代过去。不要把这个端口暴露到公网，也不要把 CI 改到这台机器上。示例配置在 [`deploy/nginx/ai-box.conf`](../deploy/nginx/ai-box.conf)，进程示例在 [`deploy/askme.service`](../deploy/askme.service)。仓库不会替所有者执行这些变更。

## 前端发布

工作流 `.github/workflows/deploy-web.yml` 只能由所有者手动触发：Actions → deploy-web → Run workflow，分支选 `main`。它会：

1. 在 GitHub Actions 上对 `web/` 运行 lint、类型检查、测试和构建。
2. 用 Actions secret `DEPLOY_SSH_KEY` 登录服务器。主机公钥写死在工作流里（ED25519，`SHA256:oteKPYqz0SpeGeEE/6GHQ4EDIn1u3faBSrr7ihheoVw`），指纹对不上会直接失败。
3. 把构建产物解压到 `/var/www/ai-box.next`，再整体替换 `/var/www/ai-box`。上一版保留在 `/var/www/ai-box.prev`，`.release` 文件记录版本号。
4. 检查 `/`、`/lin`、`/app` 都返回应用页面，并能下载入口脚本。
5. 检查 `/api/health` 返回 JSON `{"ok":true}`。如果不是，工作流会把站点目录切回上一版并失败。

前端是单页应用。未知页面路径回落到 `index.html`。`/api/` 必须先反代到 `127.0.0.1:8787`，不能落入这段回退。生产构建使用 `VITE_APP_INTENT=production` 和 `VITE_API_MODE=http`。

发布前，所有者需要：

1. 准备 `/etc/askme.env`，不要提交。至少包括 32 位以上的 `SESSION_SECRET`、`NODE_ENV=production`、`HOST=127.0.0.1`、`COOKIE_SECURE=true`、`TRUST_PROXY=true`、`WEB_ORIGINS=https://ai-box.yogdunana.cn`、`PUBLIC_REPLIES_ENABLED=false`。
2. 在服务器上放置后端并执行 `npm run migrate`。`002_reply_access.sql` 只增加列和表。旧的 `private_reserved` 记录不会变成已读，也没有可查看快照。
3. 用 [`deploy/askme.service`](../deploy/askme.service) 启动 API，并按 [`deploy/nginx/ai-box.conf`](../deploy/nginx/ai-box.conf) 增加 `/api/` 反代。不要把数据库或密钥放进 `/var/www/ai-box`。

健康检查：

```bash
curl -fsS -D - https://ai-box.yogdunana.cn/api/health
```

`Content-Type` 必须包含 `application/json`。

回滚静态文件：

```bash
mv /var/www/ai-box /var/www/ai-box.bad && mv /var/www/ai-box.prev /var/www/ai-box
```

回滚 API 时停掉新进程并启动上一版。`002` 增加的列有默认值，旧进程可以继续读原来的列。不要为了回滚删除数据库。只有在需要退回纯静态站点时，才去掉 `/api/` 反代并恢复原来的 Nginx 备份。

登录凭据由所有者保管。不要把 root 密码、SSH 私钥或 `/etc/letsencrypt` 里的私钥写入仓库、Pull Request、文档或命令输出。

## 凭据放在哪里

GitHub 的 Deploy keys 只登记一把用于访问本仓库的 SSH 公钥。密码放不进去。GitHub 也不保存这把钥匙的私钥，更不能把它限定成“只有四位真人可用”。拿到私钥的人都能用。

部署私钥放在本仓库的 Actions secret，名字是 `DEPLOY_SSH_KEY`。这是加密的仓库 secret：公开页面上看不到，API 也不能把值读回来。四位真人没有各自的 GitHub 写权限，他们的 Bot 同样不能把私钥取出来。服务器登录由所有者触发的工作流在运行时使用这把钥匙。

当前的 Cloud Agent 安装令牌没有 secrets 和 deploy keys 的管理权限，写不进这项设置。所有者在本机用有 administration 权限的 `GH_TOKEN` 配置：

```bash
ssh-keygen -t ed25519 -f ai-box-deploy -N "" -C "ai-box-deploy"
# 把 ai-box-deploy.pub 追加到服务器 /root/.ssh/authorized_keys
GH_TOKEN="<administration token>" gh secret set DEPLOY_SSH_KEY < ai-box-deploy
rm -P ai-box-deploy ai-box-deploy.pub
```

root 密码留在所有者手里，作为这把钥匙失效时的备用入口。密码不写入 secret，也不贴进对话。
